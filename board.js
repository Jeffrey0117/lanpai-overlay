// 便籤板:輸入框打 #標題 建立。便籤拖進來自動排成清單、拖標題列整組移動、刪板整組刪。
const BOARD_DEFAULT_WIDTH = 280
const BOARD_MIN_WIDTH = 160
const BOARD_DEFAULT_COLOR = '#ffd400'
const BOARD_TITLE_FONT = '16px'
const BOARD_ITEM_FONT = '20px'

let dropTarget = null

const dropLine = document.createElement('div')
dropLine.className = 'drop-line'

function applyBoardColor(board, color) {
  board.dataset.color = color
  const titleBar = board.querySelector('.board-title')
  titleBar.style.background = hexToRgba(color, 0.92)
  titleBar.style.color = shadowContrastColor(color)
}

function buildBoardItem(data) {
  const item = document.createElement('div')
  if (data.kind === 'text') {
    item.className = 'item text'
    item.style.fontSize = data.fontSize || BOARD_ITEM_FONT
    const content = document.createElement('span')
    content.className = 'content'
    content.textContent = data.text
    item.appendChild(content)
    applyStyleTo(item, data.style || getCurrentStyle())
    return item
  }
  item.className = 'item image'
  const img = document.createElement('img')
  img.className = 'content'
  img.dataset.lastGood = data.src
  img.src = data.src
  item.appendChild(img)
  return item
}

function buildBoardElement({ title, x, y, width, color, titleFontSize, items, collapsed }) {
  const el = document.createElement('div')
  el.className = 'el board'
  if (collapsed) el.classList.add('collapsed')
  placeElement(el, x, y)
  el.style.width = width || `${BOARD_DEFAULT_WIDTH}px`

  const titleBar = document.createElement('div')
  titleBar.className = 'board-title'
  titleBar.style.fontSize = titleFontSize || BOARD_TITLE_FONT
  const fold = document.createElement('span')
  fold.className = 'board-fold'
  fold.title = '摺疊 / 展開'
  fold.addEventListener('click', () => toggleBoardCollapsed(el))
  const titleContent = document.createElement('span')
  titleContent.className = 'content'
  titleContent.textContent = title
  titleBar.appendChild(fold)
  titleBar.appendChild(titleContent)
  el.appendChild(titleBar)

  const list = document.createElement('div')
  list.className = 'board-items'
  el.appendChild(list)
  ;(items || []).forEach((data) => list.appendChild(buildBoardItem(data)))

  appendWithHandle(el)
  applyBoardColor(el, color || BOARD_DEFAULT_COLOR)
  syncFold(el)
  return el
}

function syncFold(board) {
  board.querySelector('.board-fold').textContent = board.classList.contains('collapsed') ? '▸' : '▾'
}

function toggleBoardCollapsed(board) {
  board.classList.toggle('collapsed')
  syncFold(board)
  saveSnapshot()
}

function serializeBoardItem(item) {
  if (item.classList.contains('text')) {
    const content = item.querySelector('.content')
    return { kind: 'text', fontSize: item.style.fontSize, text: content.textContent, style: getElementStyle(item) }
  }
  const img = item.querySelector('img.content')
  return { kind: 'image', src: img.dataset.lastGood || img.src }
}

function serializeBoard(board) {
  const titleBar = board.querySelector('.board-title')
  return {
    kind: 'board',
    x: parseFloat(board.style.left) || 0,
    y: parseFloat(board.style.top) || 0,
    width: board.style.width,
    title: titleBar.querySelector('.content').textContent,
    color: board.dataset.color || BOARD_DEFAULT_COLOR,
    titleFontSize: titleBar.style.fontSize,
    collapsed: board.classList.contains('collapsed'),
    items: [...board.querySelectorAll('.item')].map(serializeBoardItem)
  }
}

// 板內項目 ↔ 自由便籤 互轉:拖出去變自由,拖進來變清單項目。keepOriginal = Alt+拖曳複製。
function detachItemToElement(item, keepOriginal) {
  const rect = item.getBoundingClientRect()
  const data = serializeBoardItem(item)
  if (!keepOriginal) item.remove()
  if (data.kind === 'text') {
    return buildTextElement({ ...data, x: rect.left, y: rect.top })
  }
  return buildImageElement({ ...data, x: rect.left, y: rect.top, width: `${Math.round(rect.width)}px` })
}

function elementToItemData(el) {
  if (el.classList.contains('text')) {
    const content = el.querySelector('.content')
    return { kind: 'text', fontSize: el.style.fontSize, text: content.textContent, style: getElementStyle(el) }
  }
  const img = el.querySelector('img.content')
  return { kind: 'image', src: img.dataset.lastGood || img.src }
}

function dropElementIntoBoard(el, board, before) {
  const item = buildBoardItem(elementToItemData(el))
  const list = board.querySelector('.board-items')
  if (before) list.insertBefore(item, before)
  else list.appendChild(item)
  el.remove()
  return item
}

function findDropTarget(event, dragged) {
  for (const board of document.querySelectorAll('.el.board')) {
    if (board === dragged || board.classList.contains('collapsed')) continue
    const rect = board.getBoundingClientRect()
    const inside =
      event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    if (!inside) continue
    const items = [...board.querySelectorAll('.item')]
    const before = items.find((item) => {
      const r = item.getBoundingClientRect()
      return event.clientY < r.top + r.height / 2
    })
    return { board, before: before || null }
  }
  return null
}

function updateDropIndicator(event, dragged) {
  if (dragged.classList.contains('board')) return
  dropTarget = findDropTarget(event, dragged)
  if (!dropTarget) {
    dropLine.remove()
    return
  }
  const list = dropTarget.board.querySelector('.board-items')
  list.appendChild(dropLine)
  dropLine.style.top = dropTarget.before ? `${dropTarget.before.offsetTop - 5}px` : `${list.clientHeight - 5}px`
}

function clearDropIndicator() {
  dropTarget = null
  dropLine.remove()
}

// 整板等比縮放:標題、每個文字項目一起調,寬度跟著縮
function scaleBoard(board, factor) {
  board.style.width = `${Math.max(BOARD_MIN_WIDTH, Math.round(board.offsetWidth * factor))}px`
  const titleBar = board.querySelector('.board-title')
  scaleTextSize(titleBar, factor)
  board.querySelectorAll('.item.text').forEach((item) => scaleTextSize(item, factor))
}
