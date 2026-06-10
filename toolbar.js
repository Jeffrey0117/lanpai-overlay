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

const BACKGROUNDS = [
  { key: 'none', label: '無底', css: 'transparent' },
  { key: 'dark', label: '黑底', css: 'rgba(0, 0, 0, 0.65)' },
  { key: 'light', label: '白底', css: 'rgba(255, 255, 255, 0.85)' }
]

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
  const bg = BACKGROUNDS.find((b) => b.key === merged.bg) || BACKGROUNDS[0]
  content.style.color = merged.color
  content.style.fontWeight = String(merged.weight)
  content.style.textShadow = shadow.css(shadowContrastColor(merged.color))
  content.style.background = bg.css
  content.style.padding = merged.bg === 'none' ? '0' : '0.2em 0.45em'
  content.style.borderRadius = merged.bg === 'none' ? '0' : '0.18em'
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
  const index = BACKGROUNDS.findIndex((b) => b.key === bg)
  const next = BACKGROUNDS[(index + 1) % BACKGROUNDS.length]
  updateTargetStyle({ bg: next.key })
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
  const bg = BACKGROUNDS.find((b) => b.key === style.bg) || BACKGROUNDS[0]
  weightBtn.textContent = weight.label
  shadowBtn.textContent = shadow.label
  bgBtn.textContent = bg.label
}

function showToolbarFor(el) {
  toolbarTarget = el
  const isText = el.classList.contains('text')
  swatchRow.style.display = isText ? '' : 'none'
  controlRow.style.display = isText ? '' : 'none'
  templateRow.style.display = isText ? '' : 'none'
  urlRow.style.display = isText ? 'none' : ''
  toolbar.style.display = 'flex'
  if (isText) syncToolbarState()
  else urlInput.value = ''
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

toolbar.appendChild(swatchRow)
toolbar.appendChild(controlRow)
toolbar.appendChild(templateRow)
toolbar.appendChild(urlRow)
document.body.appendChild(toolbar)
renderTemplates()
