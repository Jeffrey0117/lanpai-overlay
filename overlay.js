const api = window.lanpai

const entry = document.getElementById('text-entry')
const entryInput = entry.querySelector('input')

let interactive = false
let entryOpen = false
let editingContent = null
let dragState = null
let pendingItemDrag = null
let cascade = 0
let toolbarHideTimer = null
let wheelSaveTimer = null
let spotlightSet = null
let selection = []

// 筆記就該記得:背景一直記快照,每次開啟靜默還原。要從零開始用 Ctrl+Shift+X。
const SNAP_KEY = 'lanpai-snapshot'

function serializeElements() {
  return [...document.querySelectorAll('.el')].map((el) => {
    const x = parseFloat(el.style.left) || 0
    const y = parseFloat(el.style.top) || 0
    if (el.classList.contains('board')) return serializeBoard(el)
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
    const json = JSON.stringify(serializeElements())
    localStorage.setItem(SNAP_KEY, json)
    pushHistory(json)
  } catch (error) {
    // localStorage 滿了或不可用就跳過,不影響使用
  }
}

function setInteractive(on) {
  if (on === interactive) return
  interactive = on
  api.setIgnoreMouse(!on)
}

function shouldBeInteractive(target) {
  // 注意:聚焦中不強制整層可互動,否則空白處會擋住底下的工作視窗。
  // 只有滑鼠真的在某個元素/工具列上才攔截;聚焦中那些被藏的元素是 display:none,本來就收不到滑鼠。
  if (entryOpen || editingContent || dragState || toolbarVisible() || historyOpen) return true
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('.el, #toolbar'))
}

// 多選:Shift+點累加,被選的有外框。一般點會清掉,只留單一。
function setSelection(els) {
  selection = els
  document.querySelectorAll('.el.selected').forEach((node) => node.classList.remove('selected'))
  // 外框只在選了 2 個以上時出現:單選維持乾淨,多選才需要看出「選了哪些」
  if (els.length >= 2) els.forEach((node) => node.classList.add('selected'))
}

function clearSelection() {
  if (selection.length) setSelection([])
}

function toggleSelected(el) {
  setSelection(selection.includes(el) ? selection.filter((node) => node !== el) : [...selection, el])
}

// 聚焦:只顯示選中的這幾個,其他暫時藏起來。臨時觀看狀態,不寫進快照。
function enterSpotlight(els) {
  const list = Array.isArray(els) ? els : [els]
  if (!list.length) return
  spotlightSet = list
  document.querySelectorAll('.el').forEach((node) => node.classList.toggle('spotlighted', list.includes(node)))
  clearSelection()
  document.body.classList.add('spotlight')
  hideToolbar()
  setInteractive(true)
}

function exitSpotlight() {
  if (!spotlightSet) return
  spotlightSet = null
  document.body.classList.remove('spotlight')
  document.querySelectorAll('.el.spotlighted').forEach((node) => node.classList.remove('spotlighted'))
  setInteractive(false)
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

// Alt+拖曳用:原地長出一個分身,讓呼叫端拖走
function cloneElement(el) {
  const x = parseFloat(el.style.left) || 0
  const y = parseFloat(el.style.top) || 0
  if (el.classList.contains('board')) {
    return buildBoardElement({ ...serializeBoard(el), x, y })
  }
  if (el.classList.contains('text')) {
    const content = el.querySelector('.content')
    return buildTextElement({ text: content.textContent, x, y, fontSize: el.style.fontSize, style: getElementStyle(el) })
  }
  const img = el.querySelector('img.content')
  return buildImageElement({ src: img.dataset.lastGood || img.src, x, y, width: el.style.width })
}

function appendWithHandle(el) {
  const handle = document.createElement('div')
  handle.className = 'handle'
  el.appendChild(handle)
  document.body.appendChild(el)
}

function startDrag(el, event) {
  const rect = el.getBoundingClientRect()
  el.style.zIndex = '10'
  dragState = {
    kind: 'move',
    el,
    offsetX: Math.min(event.clientX - rect.left, Math.max(rect.width - 12, 12)),
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
  if (el.classList.contains('text')) {
    const fontSize = Math.min(400, Math.max(8, dragState.startFontSize * clamped))
    el.style.fontSize = `${fontSize}px`
  } else {
    const minWidth = el.classList.contains('board') ? BOARD_MIN_WIDTH : 24
    el.style.width = `${Math.max(minWidth, Math.round(dragState.startWidth * clamped))}px`
  }
}

function scaleTextSize(node, factor) {
  const current = parseFloat(getComputedStyle(node).fontSize)
  node.style.fontSize = `${Math.min(400, Math.max(8, current * factor))}px`
}

function finishTextEdit() {
  if (!editingContent) return
  const content = editingContent
  editingContent = null
  content.contentEditable = 'false'
  if (content.textContent.trim() === '') {
    const host = content.closest('.board-title, .item, .el')
    if (host.classList.contains('board-title')) {
      content.textContent = '未命名'
    } else {
      host.remove()
    }
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
      if (value.startsWith('#')) {
        const title = value.slice(1).trim()
        if (title !== '') {
          buildBoardElement({ title })
          saveSnapshot()
        }
      } else if (/^https?:\/\/\S+$/i.test(value)) {
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
  if (pendingItemDrag) {
    const moved =
      Math.abs(event.clientX - pendingItemDrag.x) + Math.abs(event.clientY - pendingItemDrag.y)
    if (moved > 4) {
      const el = detachItemToElement(pendingItemDrag.item, pendingItemDrag.copy)
      pendingItemDrag = null
      startDrag(el, event)
      showToolbarFor(el)
    }
    return
  }
  if (dragState) {
    applyDrag(event)
    if (dragState.kind === 'move') updateDropIndicator(event, dragState.el)
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
  if (event.target.closest('.board-fold')) return
  const item = event.target.closest('.item')
  if (item) {
    pendingItemDrag = { item, x: event.clientX, y: event.clientY, copy: event.altKey }
    showToolbarFor(item)
    return
  }
  const el = event.target.closest('.el')
  if (!el) {
    // 點工具列(例如聚焦鈕)不算點空白,不能清掉多選 — 否則聚焦鈕會在生效前先被清空
    if (!event.target.closest('#toolbar')) clearSelection()
    return
  }
  if (event.shiftKey) {
    toggleSelected(el)
    showToolbarFor(el)
    return
  }
  const target = event.altKey ? cloneElement(el) : el
  setSelection([target])
  startDrag(target, event)
  showToolbarFor(target)
})

document.addEventListener('mouseup', () => {
  pendingItemDrag = null
  if (dragState) {
    dragState.el.style.zIndex = ''
    if (dragState.kind === 'move' && dropTarget) {
      const item = dropElementIntoBoard(dragState.el, dropTarget.board, dropTarget.before)
      showToolbarFor(item)
    }
    clearDropIndicator()
    saveSnapshot()
  }
  dragState = null
})

document.addEventListener('dblclick', (event) => {
  if (event.target.closest('.board-fold')) return
  const target = event.target.closest('.board-title, .item.text, .el.text')
  if (target) startTextEdit(target)
})

// 右鍵 = 刪除(板子整組刪、板內單條刪)。刪錯了 Ctrl+Z 救回來。
document.addEventListener('contextmenu', (event) => {
  if (event.target.closest('#toolbar')) return
  if (editingContent) return
  const target = event.target.closest('.item') || event.target.closest('.el')
  if (!target) return
  event.preventDefault()
  hideToolbar()
  target.remove()
  if (spotlightSet && !document.querySelector('.el.spotlighted')) exitSpotlight()
  setInteractive(false)
  saveSnapshot()
})

// 滾輪縮放:懸停就能調,不用先選中。板內項目調單條,標題列調整板。
document.addEventListener(
  'wheel',
  (event) => {
    if (editingContent || entryOpen || dragState || pendingItemDrag) return
    const el = event.target.closest('.el')
    if (!el) return
    event.preventDefault()
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
    const item = event.target.closest('.item')
    if (el.classList.contains('board')) {
      if (item && item.classList.contains('text')) scaleTextSize(item, factor)
      else if (!item) scaleBoard(el, factor)
    } else if (el.classList.contains('image')) {
      el.style.width = `${Math.max(24, Math.round(el.offsetWidth * factor))}px`
    } else {
      scaleTextSize(el, factor)
    }
    if (toolbarVisible()) positionToolbar()
    clearTimeout(wheelSaveTimer)
    wheelSaveTimer = setTimeout(saveSnapshot, 300)
  },
  { passive: false }
)

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && editingContent && !event.shiftKey) {
    event.preventDefault()
    finishTextEdit()
    setInteractive(false)
    return
  }
  const typing = editingContent || entryOpen || event.target instanceof HTMLInputElement
  if (event.key === 'Escape' && !typing) {
    if (spotlightSet) exitSpotlight()
    else clearSelection()
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !typing) {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if (event.key === 'Delete' && toolbarTarget && !typing) {
    const el = toolbarTarget
    hideToolbar()
    el.remove()
    if (spotlightSet && !document.querySelector('.el.spotlighted')) exitSpotlight()
    setInteractive(false)
    saveSnapshot()
  }
})

window.addEventListener('blur', () => {
  finishTextEdit()
  if (entryOpen) closeEntry()
  pendingItemDrag = null
  if (dragState) {
    dragState.el.style.zIndex = ''
    clearDropIndicator()
    dragState = null
  }
})

function restoreSnapshot(items) {
  items.forEach((item) => {
    if (item.kind === 'text') buildTextElement(item)
    else if (item.kind === 'image') buildImageElement(item)
    else if (item.kind === 'board') buildBoardElement(item)
  })
  saveSnapshot()
}

function initRestore() {
  const items = parseJson(localStorage.getItem(SNAP_KEY), [])
  if (Array.isArray(items) && items.length) restoreSnapshot(items)
}

api.onAddSmart(() => openEntry())
api.onAddImage(addImageElement)
api.onClearAll(() => {
  exitSpotlight()
  hideToolbar()
  document.querySelectorAll('.el').forEach((el) => el.remove())
  setInteractive(false)
  saveSnapshot()
})
api.onUndo(undo)
api.onShowHistory(showHistoryPanel)
api.onExitSpotlight(exitSpotlight)

initRestore()
