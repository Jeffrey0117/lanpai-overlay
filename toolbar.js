const COLORS = ['#ffffff', '#111111', '#ffd400', '#ff4d4d', '#4dff88', '#4d9fff', '#ff7ad9']

const WEIGHTS = [
  { value: 400, label: '細' },
  { value: 700, label: '粗' },
  { value: 900, label: '黑' }
]

const SHADOWS = [
  { key: 'none', label: '無影', css: () => 'none' },
  { key: 'soft', label: '柔影', css: (c) => `0 0 4px ${c}, 0 1px 2px ${c}` },
  { key: 'strong', label: '強影', css: (c) => `0 0 10px ${c}, 0 2px 6px ${c}` },
  {
    key: 'outline',
    label: '描邊',
    css: (c) => `-1px -1px 0 ${c}, 1px -1px 0 ${c}, -1px 1px 0 ${c}, 1px 1px 0 ${c}`
  }
]

function shadowContrastColor(hex) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return luminance < 0.45 ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)'
}

// 底色:無 + 跟文字同一排顏色,點一下跳下一個。即時預覽,常用就存模板。
const BG_NONE = 'none'
const BG_ALPHA = 0.82
const BG_CYCLE = [BG_NONE, ...COLORS]
const LEGACY_BG = { dark: '#111111', light: '#ffffff' }

function hexToRgba(hex, alpha) {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function normalizeBg(bg) {
  if (!bg || bg === BG_NONE) return BG_NONE
  if (LEGACY_BG[bg]) return LEGACY_BG[bg]
  return /^#[0-9a-fA-F]{6}$/.test(bg) ? bg : BG_NONE
}

function bgCss(bg) {
  const norm = normalizeBg(bg)
  return norm === BG_NONE ? 'transparent' : hexToRgba(norm, BG_ALPHA)
}

const DEFAULT_STYLE = { color: '#ffffff', weight: 700, shadow: 'soft', bg: 'none' }
const MAX_TEMPLATES = 6

function parseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch (error) {
    return fallback
  }
}

function loadJson(key, fallback) {
  return parseJson(localStorage.getItem(key), fallback)
}

let currentStyle = { ...DEFAULT_STYLE, ...loadJson('lanpai-current-style', {}) }
let templates = loadJson('lanpai-templates', [])
let toolbarTarget = null

function saveCurrentStyle(style) {
  currentStyle = { ...style }
  localStorage.setItem('lanpai-current-style', JSON.stringify(currentStyle))
}

function saveTemplates(next) {
  templates = next
  localStorage.setItem('lanpai-templates', JSON.stringify(templates))
  renderTemplates()
}

function getCurrentStyle() {
  return { ...currentStyle }
}

function getElementStyle(el) {
  return { ...DEFAULT_STYLE, ...parseJson(el.dataset.style, {}) }
}

function applyStyleTo(el, style) {
  const merged = { ...DEFAULT_STYLE, ...style }
  el.dataset.style = JSON.stringify(merged)
  const content = el.querySelector('.content')
  const shadow = SHADOWS.find((s) => s.key === merged.shadow) || SHADOWS[1]
  const hasBg = normalizeBg(merged.bg) !== BG_NONE
  content.style.color = merged.color
  content.style.fontWeight = String(merged.weight)
  content.style.textShadow = shadow.css(shadowContrastColor(merged.color))
  content.style.background = bgCss(merged.bg)
  content.style.padding = hasBg ? '0.2em 0.45em' : '0'
  content.style.borderRadius = hasBg ? '0.18em' : '0'
}

function updateTargetStyle(patch) {
  if (!toolbarTarget) return
  const next = { ...getElementStyle(toolbarTarget), ...patch }
  applyStyleTo(toolbarTarget, next)
  saveCurrentStyle(next)
  syncToolbarState()
}

const toolbar = document.createElement('div')
toolbar.id = 'toolbar'

const TRASH_SVG =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>'

function makeDeleteButton() {
  const btn = document.createElement('button')
  btn.className = 'tb-icon tb-del'
  btn.title = '刪除 (Del)'
  btn.innerHTML = TRASH_SVG
  btn.addEventListener('click', () => {
    if (!toolbarTarget) return
    const el = toolbarTarget
    hideToolbar()
    el.remove()
    setInteractive(false)
    saveSnapshot()
  })
  return btn
}

const swatchRow = document.createElement('div')
swatchRow.className = 'tb-row'
COLORS.forEach((color) => {
  const swatch = document.createElement('button')
  swatch.className = 'swatch'
  swatch.style.background = color
  swatch.dataset.color = color
  swatch.addEventListener('click', () => updateTargetStyle({ color }))
  swatchRow.appendChild(swatch)
})
swatchRow.appendChild(makeDeleteButton())

const weightBtn = document.createElement('button')
weightBtn.className = 'tb-btn'
weightBtn.addEventListener('click', () => {
  if (!toolbarTarget) return
  const { weight } = getElementStyle(toolbarTarget)
  const index = WEIGHTS.findIndex((w) => w.value === weight)
  const next = WEIGHTS[(index + 1) % WEIGHTS.length]
  updateTargetStyle({ weight: next.value })
})

const shadowBtn = document.createElement('button')
shadowBtn.className = 'tb-btn'
shadowBtn.addEventListener('click', () => {
  if (!toolbarTarget) return
  const { shadow } = getElementStyle(toolbarTarget)
  const index = SHADOWS.findIndex((s) => s.key === shadow)
  const next = SHADOWS[(index + 1) % SHADOWS.length]
  updateTargetStyle({ shadow: next.key })
})

const bgBtn = document.createElement('button')
bgBtn.className = 'tb-btn'
bgBtn.addEventListener('click', () => {
  if (!toolbarTarget) return
  const { bg } = getElementStyle(toolbarTarget)
  const index = BG_CYCLE.indexOf(normalizeBg(bg))
  const next = BG_CYCLE[(index + 1) % BG_CYCLE.length]
  updateTargetStyle({ bg: next })
})

const saveBtn = document.createElement('button')
saveBtn.className = 'tb-btn'
saveBtn.textContent = '存模板'
saveBtn.addEventListener('click', () => {
  if (!toolbarTarget) return
  const style = getElementStyle(toolbarTarget)
  const next = [...templates, style].slice(-MAX_TEMPLATES)
  saveTemplates(next)
})

const templateRow = document.createElement('div')
templateRow.className = 'tb-row'

function renderTemplates() {
  templateRow.replaceChildren()
  templates.forEach((style, index) => {
    const chip = document.createElement('button')
    chip.className = 'chip'
    chip.textContent = `T${index + 1}`
    chip.style.color = style.color
    chip.title = '套用模板;右鍵刪除'
    chip.addEventListener('click', () => updateTargetStyle(style))
    chip.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      event.stopPropagation()
      saveTemplates(templates.filter((_t, i) => i !== index))
    })
    templateRow.appendChild(chip)
  })
}

function syncToolbarState() {
  if (!toolbarTarget) return
  const style = getElementStyle(toolbarTarget)
  const weight = WEIGHTS.find((w) => w.value === style.weight) || WEIGHTS[1]
  const shadow = SHADOWS.find((s) => s.key === style.shadow) || SHADOWS[1]
  weightBtn.textContent = weight.label
  shadowBtn.textContent = shadow.label
  const bgNorm = normalizeBg(style.bg)
  if (bgNorm === BG_NONE) {
    bgBtn.textContent = '無底'
    bgBtn.style.background = ''
    bgBtn.style.color = ''
  } else {
    bgBtn.textContent = '底色'
    bgBtn.style.background = hexToRgba(bgNorm, BG_ALPHA)
    bgBtn.style.color = shadowContrastColor(bgNorm)
  }
}

function showToolbarFor(el) {
  toolbarTarget = el
  const isBoard = el.classList.contains('board')
  const isText = !isBoard && el.classList.contains('text')
  const isImage = !isBoard && !isText
  swatchRow.style.display = isText ? '' : 'none'
  controlRow.style.display = isText ? '' : 'none'
  templateRow.style.display = isText ? '' : 'none'
  urlRow.style.display = isImage ? '' : 'none'
  boardRow.style.display = isBoard ? '' : 'none'
  toolbar.style.display = 'flex'
  if (isText) syncToolbarState()
  if (isImage) urlInput.value = ''
  positionToolbar()
}

function positionToolbar() {
  if (!toolbarTarget) return
  const rect = toolbarTarget.getBoundingClientRect()
  const top = Math.max(4, rect.top - toolbar.offsetHeight - 8)
  const left = Math.min(Math.max(4, rect.left), window.innerWidth - toolbar.offsetWidth - 4)
  toolbar.style.top = `${top}px`
  toolbar.style.left = `${left}px`
}

function hideToolbar() {
  toolbarTarget = null
  toolbar.style.display = 'none'
}

function toolbarVisible() {
  return toolbarTarget !== null
}

const controlRow = document.createElement('div')
controlRow.className = 'tb-row'
controlRow.appendChild(weightBtn)
controlRow.appendChild(shadowBtn)
controlRow.appendChild(bgBtn)
controlRow.appendChild(saveBtn)

const urlRow = document.createElement('div')
urlRow.className = 'tb-row'
const urlInput = document.createElement('input')
urlInput.id = 'tb-url'
urlInput.type = 'text'
urlInput.placeholder = '貼上圖片網址,Enter 換圖'
urlInput.addEventListener('keydown', (event) => {
  event.stopPropagation()
  if (event.key !== 'Enter' || !toolbarTarget) return
  const value = urlInput.value.trim()
  if (!/^https?:\/\//i.test(value)) return
  toolbarTarget.querySelector('img.content').src = value
  urlInput.value = ''
})
urlRow.appendChild(urlInput)
urlRow.appendChild(makeDeleteButton())

// 板子工具列:換標題列顏色 + 整組刪
const boardRow = document.createElement('div')
boardRow.className = 'tb-row'
COLORS.forEach((color) => {
  const swatch = document.createElement('button')
  swatch.className = 'swatch'
  swatch.style.background = color
  swatch.addEventListener('click', () => {
    if (!toolbarTarget || !toolbarTarget.classList.contains('board')) return
    applyBoardColor(toolbarTarget, color)
    saveSnapshot()
  })
  boardRow.appendChild(swatch)
})
boardRow.appendChild(makeDeleteButton())

toolbar.appendChild(swatchRow)
toolbar.appendChild(controlRow)
toolbar.appendChild(templateRow)
toolbar.appendChild(urlRow)
toolbar.appendChild(boardRow)
document.body.appendChild(toolbar)
renderTemplates()
