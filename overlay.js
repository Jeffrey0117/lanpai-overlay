const api = window.lanpai

const entry = document.getElementById('text-entry')
const entryInput = entry.querySelector('input')

let interactive = false
let entryOpen = false
let editingContent = null
let dragState = null
let cascade = 0
let toolbarHideTimer = null
let promptOpen = false

// 當機/誤關復原:背景一直記快照,只有上次「沒善終」時才問要不要還原
const SNAP_KEY = 'lanpai-snapshot'
const ALIVE_KEY = 'lanpai-alive'

function serializeElements() {
  return [...document.querySelectorAll('.el')].map((el) => {
    const x = parseFloat(el.style.left) || 0
    const y = parseFloat(el.style.top) || 0
    if (el.classList.contains('text')) {
      const content = el.querySelector('.content')
      return { kind: 'text', x, y, fontSize: el.style.fontSize, text: content.textContent, style: getElementStyle(el) }
    }
    const img = el.querySelector('img.content')
    return { kind: 'image', x, y, width: el.style.width, src: img.dataset.lastGood || img.src }
  })
}

function saveSnapshot() {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(serializeElements()))
  } catch (error) {
    // localStorage 滿了或不可用就跳過,不影響使用
  }
}

function clearSnapshot() {
  localStorage.removeItem(SNAP_KEY)
}

function setInteractive(on) {
  if (on === interactive) return
  interactive = on
  api.setIgnoreMouse(!on)
}

function shouldBeInteractive(target) {
  if (promptOpen || entryOpen || editingContent || dragState || toolbarVisible()) return true
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('.el, #toolbar'))
}

function nextPosition() {
  const offset = (cascade % 8) * 28
  cascade += 1
  return {
    x: Math.round(window.innerWidth * 0.35) + offset,
    y: Math.round(window.innerHeight * 0.35) + offset
  }
}

function placeElement(el, x, y) {
  const pos = x == null || y == null ? nextPosition() : { x, y }
  el.style.left = `${pos.x}px`
  el.style.top = `${pos.y}px`
}

function buildTextElement({ text, x, y, fontSize, style }) {
  const el = document.createElement('div')
  el.className = 'el text'
  placeElement(el, x, y)
  el.style.fontSize = fontSize || '32px'
  const content = document.createElement('span')
  content.className = 'content'
  content.textContent = text
  el.appendChild(content)
  appendWithHandle(el)
  applyStyleTo(el, style || getCurrentStyle())
  return el
}

function addTextElement(text) {
  buildTextElement({ text })
  saveSnapshot()
}

function toFileUrl(filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  return `file:///${encodeURI(normalized).replace(/#/g, '%23')}`
}

function buildImageElement({ src, x, y, width }) {
  const el = document.createElement('div')
  el.className = 'el image'
  placeElement(el, x, y)
  if (width) el.style.width = width
  const img = document.createElement('img')
  img.className = 'content'
  img.addEventListener('error', () => {
    if (img.dataset.lastGood) {
      img.src = img.dataset.lastGood
    } else {
      el.remove()
    }
  })
  img.addEventListener('load', () => {
    if (!img.dataset.lastGood && !width) {
      const maxWidth = Math.round(window.innerWidth * 0.4)
      el.style.width = `${Math.min(img.naturalWidth, maxWidth)}px`
    }
    img.dataset.lastGood = img.src
    saveSnapshot()
  })
  img.src = /^(file|https?|data):/i.test(src) ? src : toFileUrl(src)
  el.appendChild(img)
  appendWithHandle(el)
  return el
}

function addImageElement(source) {
  buildImageElement({ src: source })
}

function duplicateElement(el) {
  const x = (parseFloat(el.style.left) || 0) + 24
  const y = (parseFloat(el.style.top) || 0) + 24
  let copy
  if (el.classList.contains('text')) {
    const content = el.querySelector('.content')
    copy = buildTextElement({ text: content.textContent, x, y, fontSize: el.style.fontSize, style: getElementStyle(el) })
  } else {
    const img = el.querySelector('img.content')
    copy = buildImageElement({ src: img.dataset.lastGood || img.src, x, y, width: el.style.width })
  }
  saveSnapshot()
  setInteractive(true)
  showToolbarFor(copy)
}

function appendWithHandle(el) {
  const handle = document.createElement('div')
  handle.className = 'handle'
  el.appendChild(handle)
  document.body.appendChild(el)
}

function startDrag(el, event) {
  const rect = el.getBoundingClientRect()
  dragState = {
    kind: 'move',
    el,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top
  }
}

function startResize(el, event) {
  dragState = {
    kind: 'resize',
    el,
    startX: event.clientX,
    startWidth: el.offsetWidth,
    startFontSize: parseFloat(getComputedStyle(el).fontSize)
  }
}

function applyDrag(event) {
  const { kind, el } = dragState
  if (kind === 'move') {
    el.style.left = `${event.clientX - dragState.offsetX}px`
    el.style.top = `${event.clientY - dragState.offsetY}px`
    return
  }
  const scale = (dragState.startWidth + event.clientX - dragState.startX) / dragState.startWidth
  const clamped = Math.max(0.05, scale)
  if (el.classList.contains('image')) {
    el.style.width = `${Math.max(24, Math.round(dragState.startWidth * clamped))}px`
  } else {
    const fontSize = Math.min(400, Math.max(8, dragState.startFontSize * clamped))
    el.style.fontSize = `${fontSize}px`
  }
}

function finishTextEdit() {
  if (!editingContent) return
  const content = editingContent
  editingContent = null
  content.contentEditable = 'false'
  if (content.textContent.trim() === '') {
    content.closest('.el').remove()
  }
  saveSnapshot()
}

function startTextEdit(el) {
  const content = el.querySelector('.content')
  editingContent = content
  content.contentEditable = 'true'
  content.focus()
  const range = document.createRange()
  range.selectNodeContents(content)
  const selection = window.getSelection()
  selection.removeAllRanges()
  selection.addRange(range)
}

function openEntry() {
  entryOpen = true
  entry.style.display = 'block'
  entryInput.value = ''
  setInteractive(true)
  entryInput.focus()
}

function closeEntry() {
  entryOpen = false
  entry.style.display = 'none'
  setInteractive(false)
}

entryInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const value = entryInput.value.trim()
    if (value !== '') {
      if (/^https?:\/\/\S+$/i.test(value)) {
        addImageElement(value)
      } else {
        addTextElement(value)
      }
    }
    closeEntry()
  } else if (event.key === 'Escape') {
    closeEntry()
  }
})

function scheduleToolbarHide(target) {
  if (!toolbarVisible()) return
  const nearToolbar = target instanceof Element && target.closest('.el, #toolbar')
  if (nearToolbar) {
    clearTimeout(toolbarHideTimer)
    toolbarHideTimer = null
    return
  }
  if (toolbarHideTimer) return
  toolbarHideTimer = setTimeout(() => {
    toolbarHideTimer = null
    hideToolbar()
    setInteractive(false)
  }, 400)
}

document.addEventListener('mousemove', (event) => {
  if (dragState) {
    applyDrag(event)
    if (dragState.el === toolbarTarget) positionToolbar()
    return
  }
  scheduleToolbarHide(event.target)
  setInteractive(shouldBeInteractive(event.target))
})

document.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return
  if (event.target.classList.contains('handle')) {
    startResize(event.target.closest('.el'), event)
    return
  }
  if (editingContent) {
    if (event.target !== editingContent) finishTextEdit()
    return
  }
  const el = event.target.closest('.el')
  if (!el) return
  startDrag(el, event)
  showToolbarFor(el)
})

document.addEventListener('mouseup', () => {
  if (dragState) saveSnapshot()
  dragState = null
})

document.addEventListener('dblclick', (event) => {
  const el = event.target.closest('.el.text')
  if (el) startTextEdit(el)
})

document.addEventListener('contextmenu', (event) => {
  if (event.target.closest('#toolbar')) return
  const el = event.target.closest('.el')
  if (!el) return
  event.preventDefault()
  duplicateElement(el)
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && editingContent && !event.shiftKey) {
    event.preventDefault()
    finishTextEdit()
    setInteractive(false)
    return
  }
  const typing = editingContent || entryOpen || event.target instanceof HTMLInputElement
  if (event.key === 'Delete' && toolbarTarget && !typing) {
    const el = toolbarTarget
    hideToolbar()
    el.remove()
    setInteractive(false)
    saveSnapshot()
  }
})

window.addEventListener('blur', () => {
  finishTextEdit()
  if (entryOpen) closeEntry()
})

function restoreSnapshot(items) {
  items.forEach((item) => {
    if (item.kind === 'text') buildTextElement(item)
    else if (item.kind === 'image') buildImageElement(item)
  })
  saveSnapshot()
}

function showRestorePrompt(items) {
  promptOpen = true
  setInteractive(true)
  const panel = document.createElement('div')
  panel.id = 'restore-prompt'

  const msg = document.createElement('div')
  msg.className = 'rp-msg'
  msg.textContent = `上次沒正常關閉,要還原剛剛的 ${items.length} 個項目嗎?`

  const row = document.createElement('div')
  row.className = 'rp-row'
  const yes = document.createElement('button')
  yes.className = 'rp-btn rp-yes'
  yes.textContent = '還原'
  const no = document.createElement('button')
  no.className = 'rp-btn'
  no.textContent = '清掉'

  function dismiss() {
    promptOpen = false
    panel.remove()
    setInteractive(false)
  }
  yes.addEventListener('click', () => {
    restoreSnapshot(items)
    dismiss()
  })
  no.addEventListener('click', () => {
    clearSnapshot()
    dismiss()
  })

  row.appendChild(yes)
  row.appendChild(no)
  panel.appendChild(msg)
  panel.appendChild(row)
  document.body.appendChild(panel)
}

function initRestore() {
  const unclean = localStorage.getItem(ALIVE_KEY) === '1'
  localStorage.setItem(ALIVE_KEY, '1')
  if (!unclean) return
  const items = parseJson(localStorage.getItem(SNAP_KEY), [])
  if (Array.isArray(items) && items.length) showRestorePrompt(items)
}

window.addEventListener('pagehide', () => {
  localStorage.setItem(ALIVE_KEY, '0')
})

api.onAddSmart(() => openEntry())
api.onAddImage(addImageElement)
api.onClearAll(() => {
  hideToolbar()
  document.querySelectorAll('.el').forEach((el) => el.remove())
  setInteractive(false)
  clearSnapshot()
})

initRestore()
