(async () => {
  const results = []
  const assert = (name, cond) => results.push({ name, pass: Boolean(cond) })

  // 建板 + 建自由便籤
  const board = buildBoardElement({ title: '測試板', x: 100, y: 100 })
  assert('board created', document.querySelector('.el.board') === board)

  const note = buildTextElement({ text: 'hello', x: 600, y: 600 })

  // 拖便籤進板:mousedown → mousemove 到板上 → mouseup
  note.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 610, clientY: 610 }))
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200, clientY: 150 }))
  document.dispatchEvent(new MouseEvent('mouseup', {}))
  assert('note dropped into board', board.querySelectorAll('.item').length === 1)
  assert('free note removed', !document.body.contains(note))

  // 滾輪放大單一項目
  const item = board.querySelector('.item')
  const sizeBefore = parseFloat(getComputedStyle(item).fontSize)
  item.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }))
  const sizeAfter = parseFloat(getComputedStyle(item).fontSize)
  assert('wheel grows item font', sizeAfter > sizeBefore)

  // 滾輪在標題列 = 整板縮放
  const titleBar = board.querySelector('.board-title')
  const widthBefore = board.offsetWidth
  titleBar.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100 }))
  assert('wheel on title scales board', board.offsetWidth > widthBefore)

  // 快照包含板子
  const snap = serializeElements()
  const boardSnap = snap.find((s) => s.kind === 'board')
  assert('snapshot has board with item', boardSnap && boardSnap.items.length === 1)

  // 拖項目出板:mousedown → 移過閾值觸發 detach → 再移遠 → mouseup
  const rect = item.getBoundingClientRect()
  item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: rect.left + 5, clientY: rect.top + 5 }))
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + 30, clientY: rect.top + 30 }))
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 800, clientY: 700 }))
  document.dispatchEvent(new MouseEvent('mouseup', {}))
  assert('item detached from board', board.querySelectorAll('.item').length === 0)
  assert('detached note is free again', document.querySelectorAll('body > .el.text').length === 1)

  // 自由文字滾輪縮放
  const freeNote = document.querySelector('body > .el.text')
  const freeBefore = parseFloat(getComputedStyle(freeNote).fontSize)
  freeNote.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 }))
  assert('wheel shrinks free note', parseFloat(getComputedStyle(freeNote).fontSize) < freeBefore)

  // 輸入框 # 開板
  openEntry()
  const input = document.querySelector('#text-entry input')
  input.value = '#待辦'
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  assert('# prefix creates board', document.querySelectorAll('.el.board').length === 2)

  // Del 整組刪板
  showToolbarFor(board)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }))
  assert('Del removes whole board', !document.body.contains(board))

  // 摺疊:點 ▾ 收合、序列化記得、再點展開
  const foldBoard = buildBoardElement({ title: '摺疊測試', x: 300, y: 300, items: [{ kind: 'text', text: 'inside' }] })
  foldBoard.querySelector('.board-fold').click()
  assert('fold hides items', getComputedStyle(foldBoard.querySelector('.board-items')).display === 'none')
  assert('collapsed state serialized', serializeElements().some((s) => s.kind === 'board' && s.collapsed))
  foldBoard.querySelector('.board-fold').click()
  assert('fold reopens items', getComputedStyle(foldBoard.querySelector('.board-items')).display !== 'none')

  // 靜默還原:清空 DOM 後從快照重建
  document.querySelectorAll('.el').forEach((el) => el.remove())
  localStorage.setItem(SNAP_KEY, JSON.stringify([{ kind: 'text', text: 'persist', x: 10, y: 10 }]))
  initRestore()
  assert(
    'silent restore on launch',
    [...document.querySelectorAll('.el.text .content')].some((c) => c.textContent === 'persist')
  )

  // Undo / Redo
  const wallTexts = () => [...document.querySelectorAll('body > .el.text .content')].map((c) => c.textContent)
  document.querySelectorAll('.el').forEach((el) => el.remove())
  addTextElement('undo-A')
  addTextElement('undo-B')
  undo()
  assert('undo removes B keeps A', wallTexts().includes('undo-A') && !wallTexts().includes('undo-B'))
  redo()
  assert('redo brings B back', wallTexts().includes('undo-B'))
  undo()
  addTextElement('undo-C')
  assert(
    'edit after undo branches cleanly',
    wallTexts().includes('undo-A') && wallTexts().includes('undo-C') && !wallTexts().includes('undo-B')
  )

  // 清空全部也能 Ctrl+Z 救回
  document.querySelectorAll('.el').forEach((el) => el.remove())
  saveSnapshot()
  assert('clear-all leaves empty wall', wallTexts().length === 0)
  undo()
  assert('undo resurrects after clear-all', wallTexts().includes('undo-C'))

  // 歷史面板
  showHistoryPanel()
  assert('history panel lists versions', document.querySelectorAll('#history-panel .hp-row').length > 0)
  closeHistoryPanel()
  assert('history panel closes', !document.getElementById('history-panel'))

  return JSON.stringify(results, null, 2)
})()
