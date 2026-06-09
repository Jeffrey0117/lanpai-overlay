const api = window.lanpai

const entry = document.getElementById('text-entry')
const entryInput = entry.querySelector('input')

let interactive = false
let entryOpen = false
let editingContent = null
let dragState = null
let cascade = 0

function setInteractive(on) {
  if (on === interactive) return
  interactive = on
  api.setIgnoreMouse(!on)
}

function shouldBeInteractive(target) {
  if (entryOpen || editingContent || dragState) return true
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('.el'))
}

function nextPosition() {
  const offset = (cascade % 8) * 28
  cascade += 1
  return {
    x: Math.round(window.innerWidth * 0.35) + offset,
    y: Math.round(window.innerHeight * 0.35) + offset
  }
}

function createElement(type) {
  const el = document.createElement('div')
  el.className = `el ${type}`
  const { x, y } = nextPosition()
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  return el
}

function addTextElement(text) {
  const el = createElement('text')
  el.style.fontSize = '32px'
  const content = document.createElement('span')
  content.className = 'content'
  content.textContent = text
  el.appendChild(content)
  appendWithHandle(el)
}

function toFileUrl(filePath) {
  const normalized = filePath.replace(/\\/g, '/')
  return `file:///${encodeURI(normalized).replace(/#/g, '%23')}`
}

function addImageElement(filePath) {
  const el = createElement('image')
  const img = document.createElement('img')
  img.className = 'content'
  img.addEventListener('error', () => el.remove())
  img.addEventListener('load', () => {
    const maxWidth = Math.round(window.innerWidth * 0.4)
    el.style.width = `${Math.min(img.naturalWidth, maxWidth)}px`
  })
  img.src = toFileUrl(filePath)
  el.appendChild(img)
  appendWithHandle(el)
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
    const text = entryInput.value.trim()
    if (text !== '') addTextElement(text)
    closeEntry()
  } else if (event.key === 'Escape') {
    closeEntry()
  }
})

document.addEventListener('mousemove', (event) => {
  if (dragState) {
    applyDrag(event)
    return
  }
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
  if (el) startDrag(el, event)
})

document.addEventListener('mouseup', () => {
  dragState = null
})

document.addEventListener('dblclick', (event) => {
  const el = event.target.closest('.el.text')
  if (el) startTextEdit(el)
})

document.addEventListener('contextmenu', (event) => {
  const el = event.target.closest('.el')
  if (!el) return
  event.preventDefault()
  el.remove()
  setInteractive(false)
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && editingContent && !event.shiftKey) {
    event.preventDefault()
    finishTextEdit()
    setInteractive(false)
  }
})

window.addEventListener('blur', () => {
  finishTextEdit()
  if (entryOpen) closeEntry()
})

api.onAddText(openEntry)
api.onAddImage(addImageElement)
api.onClearAll(() => {
  document.querySelectorAll('.el').forEach((el) => el.remove())
  setInteractive(false)
})
