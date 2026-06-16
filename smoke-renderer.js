(async () => {
  const results = []
  const assert = (name, cond) => results.push({ name, pass: Boolean(cond) })

  // 首次啟動會自動跳歡迎卡,先關掉免得 helpOpen 影響互動斷言
  closeHelpCard()

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

  // 右鍵 = 刪除,Ctrl+Z 救回
  addTextElement('rc-del')
  const rcNote = [...document.querySelectorAll('body > .el.text')].find(
    (el) => el.querySelector('.content').textContent === 'rc-del'
  )
  rcNote.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  assert('right-click deletes element', !document.body.contains(rcNote))
  undo()
  assert('undo revives right-click delete', wallTexts().includes('rc-del'))

  // Alt+拖曳 = 拖出分身
  const srcNote = [...document.querySelectorAll('body > .el.text')].find(
    (el) => el.querySelector('.content').textContent === 'rc-del'
  )
  const sr = srcNote.getBoundingClientRect()
  srcNote.dispatchEvent(
    new MouseEvent('mousedown', { bubbles: true, button: 0, altKey: true, clientX: sr.left + 4, clientY: sr.top + 4 })
  )
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: sr.left + 150, clientY: sr.top + 150 }))
  document.dispatchEvent(new MouseEvent('mouseup', {}))
  assert('alt-drag duplicates note', wallTexts().filter((t) => t === 'rc-del').length === 2)

  // 刪 X 後移 Y:undo 第一下退位置、第二下退刪除
  document.querySelectorAll('.el').forEach((el) => el.remove())
  saveSnapshot()
  addTextElement('mv-X')
  addTextElement('mv-Y')
  const findNote = (text) =>
    [...document.querySelectorAll('body > .el.text')].find((el) => el.querySelector('.content').textContent === text)
  const yBefore = findNote('mv-Y').style.left
  findNote('mv-X').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  const yEl = findNote('mv-Y')
  const yr = yEl.getBoundingClientRect()
  yEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: yr.left + 4, clientY: yr.top + 4 }))
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: yr.left + 200, clientY: yr.top + 120 }))
  document.dispatchEvent(new MouseEvent('mouseup', {}))
  assert('setup: X deleted and Y moved', !findNote('mv-X') && findNote('mv-Y').style.left !== yBefore)
  undo()
  assert('undo #1 restores position only', findNote('mv-Y').style.left === yBefore && !findNote('mv-X'))
  undo()
  assert('undo #2 restores deletion', Boolean(findNote('mv-X')))
  redo()
  assert('redo re-deletes X', !findNote('mv-X'))
  redo()
  assert('redo re-moves Y', findNote('mv-Y').style.left !== yBefore)

  // 聚焦:只顯示一個,其他藏起來;Esc 還原
  document.querySelectorAll('.el').forEach((el) => el.remove())
  const spotA = buildTextElement({ text: 'spot-A', x: 100, y: 100 })
  const spotB = buildTextElement({ text: 'spot-B', x: 300, y: 100 })
  enterSpotlight(spotA)
  assert('spotlight shows target', getComputedStyle(spotA).display !== 'none')
  assert('spotlight hides others', getComputedStyle(spotB).display === 'none')
  assert('spotlight sets body class', document.body.classList.contains('spotlight'))
  document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 5, clientY: 5 }))
  assert('clicking empty no longer exits spotlight', document.body.classList.contains('spotlight'))
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  assert('Esc exits spotlight', getComputedStyle(spotB).display !== 'none' && !document.body.classList.contains('spotlight'))
  // 刪掉被聚焦的便籤會自動退出聚焦,不會卡在空白畫面
  enterSpotlight(spotA)
  spotA.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
  assert('deleting focused note exits spotlight', !document.body.classList.contains('spotlight') && getComputedStyle(spotB).display !== 'none')

  // 回歸:聚焦時空白處要穿透(不擋底下視窗),聚焦的便籤仍可互動
  const si1 = buildTextElement({ text: 'si1', x: 100, y: 400 })
  enterSpotlight([si1])
  assert('spotlight: empty area stays click-through', shouldBeInteractive(document.body) === false)
  assert('spotlight: focused note still interactive', shouldBeInteractive(si1) === true)
  exitSpotlight()

  // 多選聚焦:一般點選一個 + Shift 點累加,聚焦整組
  document.querySelectorAll('.el').forEach((el) => el.remove())
  const mm1 = buildTextElement({ text: 'mm1', x: 50, y: 60 })
  const mm2 = buildTextElement({ text: 'mm2', x: 200, y: 60 })
  const mm3 = buildTextElement({ text: 'mm3', x: 350, y: 60 })
  const mm4 = buildTextElement({ text: 'mm4', x: 500, y: 60 })
  mm1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 55, clientY: 65 }))
  document.dispatchEvent(new MouseEvent('mouseup', {}))
  mm2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true, clientX: 205, clientY: 65 }))
  mm3.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true, clientX: 355, clientY: 65 }))
  assert('shift-click builds multi-selection', document.querySelectorAll('.el.selected').length === 3)
  enterSpotlight(selection)
  assert(
    'multi-spotlight shows all selected',
    getComputedStyle(mm1).display !== 'none' && getComputedStyle(mm2).display !== 'none' && getComputedStyle(mm3).display !== 'none'
  )
  assert('multi-spotlight hides the rest', getComputedStyle(mm4).display === 'none')
  exitSpotlight()
  assert('exit restores all and clears selection', getComputedStyle(mm4).display !== 'none' && document.querySelectorAll('.el.selected').length === 0)

  // 回歸:點工具列(聚焦鈕)不可清掉多選,聚焦鈕要能聚焦整組
  document.querySelectorAll('.el').forEach((el) => el.remove())
  const f1 = buildTextElement({ text: 'f1', x: 50, y: 60 })
  const f2 = buildTextElement({ text: 'f2', x: 200, y: 60 })
  const f3 = buildTextElement({ text: 'f3', x: 350, y: 60 })
  f1.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 55, clientY: 65 }))
  document.dispatchEvent(new MouseEvent('mouseup', {}))
  f2.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true, clientX: 205, clientY: 65 }))
  f3.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, shiftKey: true, clientX: 355, clientY: 65 }))
  const focusBtn = [...document.querySelectorAll('#toolbar .tb-btn')].find((b) => b.textContent.includes('聚焦'))
  focusBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
  assert('clicking toolbar keeps selection', selection.length === 3)
  focusBtn.click()
  assert('focus button spotlights all 3', document.querySelectorAll('.el.spotlighted').length === 3)
  exitSpotlight()

  // 回歸:聚焦中按復原不會整個畫面消失(重建前要先退出聚焦)
  document.querySelectorAll('.el').forEach((el) => el.remove())
  saveSnapshot()
  addTextElement('undoSpot1')
  addTextElement('undoSpot2')
  enterSpotlight([document.querySelector('body > .el.text')])
  undo()
  assert(
    'undo during spotlight does not hide everything',
    !document.body.classList.contains('spotlight') &&
      [...document.querySelectorAll('body > .el.text')].length > 0 &&
      [...document.querySelectorAll('body > .el.text')].every((el) => getComputedStyle(el).display !== 'none')
  )

  // 選取組:存進 1、叫回時重新選中並聚焦、重開(序列化往返)後仍叫得回、刪掉的成員自動跳過
  localStorage.removeItem(GROUPS_KEY)
  document.querySelectorAll('.el').forEach((el) => el.remove())
  const g1 = buildTextElement({ text: 'grp1', x: 40, y: 200 })
  const g2 = buildTextElement({ text: 'grp2', x: 180, y: 200 })
  const g3 = buildTextElement({ text: 'grp3', x: 320, y: 200 })
  setSelection([g1, g2, g3])
  saveGroupSlot('1')
  assert('group slot saved', slotFilled('1'))
  assert('group stores 3 ids', (loadGroups()['1'] || []).length === 3)
  clearSelection()
  exitSpotlight()
  assert('recall returns true for a filled slot', recallGroupSlot('1') === true)
  assert('recall focuses the whole group', document.querySelectorAll('.el.spotlighted').length === 3)
  exitSpotlight()
  // 模擬重開:序列化→清空→還原,id 不變,組仍叫得回
  const grpSnap = JSON.stringify(serializeElements())
  assert('serialized elements carry ids', parseJson(grpSnap, []).every((it) => typeof it.id === 'string' && it.id.length > 0))
  document.querySelectorAll('.el').forEach((el) => el.remove())
  restoreSnapshot(parseJson(grpSnap, []))
  exitSpotlight()
  assert(
    'recall survives a serialize round-trip',
    recallGroupSlot('1') === true && document.querySelectorAll('.el.spotlighted').length === 3
  )
  exitSpotlight()
  // 刪掉組裡一個成員,叫回自動跳過
  document.querySelector('.el[data-elid="' + loadGroups()['1'][0] + '"]').remove()
  assert('recall still works with a deleted member', recallGroupSlot('1') === true)
  assert('recall skips the deleted member', document.querySelectorAll('.el.spotlighted').length === 2)
  exitSpotlight()

  // 歡迎卡:叫得出來、關掉後設旗標、之後不再自動跳
  localStorage.removeItem(ONBOARD_KEY)
  showHelpCard()
  assert('help card shows on demand', !!document.getElementById('help-card'))
  closeHelpCard()
  assert('help card dismisses and sets flag', !document.getElementById('help-card') && localStorage.getItem(ONBOARD_KEY) === '1')
  initOnboarding()
  assert('onboarding does not re-show once flagged', !document.getElementById('help-card'))

  // 歷史面板
  showHistoryPanel()
  assert('history panel lists versions', document.querySelectorAll('#history-panel .hp-row').length > 0)
  closeHistoryPanel()
  assert('history panel closes', !document.getElementById('history-panel'))

  return JSON.stringify(results, null, 2)
})()
