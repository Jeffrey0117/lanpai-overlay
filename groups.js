// 選取組:Shift 多選後存進 1~7,點數字一鍵叫回並聚焦。
// 組存的是元素 id(穩定身分證),重開還在;被刪的便籤叫回時自動跳過。
const GROUPS_KEY = 'lanpai-groups'
const SLOT_COUNT = 7

function loadGroups() {
  const groups = parseJson(localStorage.getItem(GROUPS_KEY), {})
  return groups && typeof groups === 'object' ? groups : {}
}

function persistGroups(groups) {
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups))
  renderSlots()
}

function slotFilled(slot) {
  return (loadGroups()[slot] || []).length > 0
}

function saveGroupSlot(slot) {
  if (!selection.length) return
  const groups = loadGroups()
  if (!allowGroupSave(groups, slot)) return
  groups[slot] = selection.map((el) => el.dataset.elid)
  persistGroups(groups)
}

function clearGroupSlot(slot) {
  const groups = loadGroups()
  delete groups[slot]
  persistGroups(groups)
}

function recallGroupSlot(slot) {
  const ids = loadGroups()[slot] || []
  const els = ids.map((id) => document.querySelector(`.el[data-elid="${id}"]`)).filter(Boolean)
  if (!els.length) return false
  if (entryOpen) closeEntry()
  enterSpotlight(els)
  return true
}

// 點:叫回並聚焦(空格則存入) · Shift+點:存入目前選取 · 右鍵:清空
function makeSlotRow() {
  const row = document.createElement('div')
  row.className = 'tb-row slot-row'
  for (let i = 1; i <= SLOT_COUNT; i += 1) {
    const chip = document.createElement('button')
    chip.className = 'slot-chip'
    chip.dataset.slot = String(i)
    chip.textContent = String(i)
    chip.title = '點:叫回並聚焦 · Shift+點:存入目前選取 · 右鍵:清空'
    chip.addEventListener('click', (event) => {
      const slot = chip.dataset.slot
      if (event.shiftKey || !slotFilled(slot)) saveGroupSlot(slot)
      else recallGroupSlot(slot)
    })
    chip.addEventListener('contextmenu', (event) => {
      event.preventDefault()
      event.stopPropagation()
      clearGroupSlot(chip.dataset.slot)
    })
    row.appendChild(chip)
  }
  return row
}

function renderSlots() {
  const groups = loadGroups()
  document.querySelectorAll('.slot-chip').forEach((chip) => {
    chip.classList.toggle('filled', (groups[chip.dataset.slot] || []).length > 0)
  })
}

// 工具列(有選取時)放一排,方便存;輸入框面板也放一排,方便閒置時叫回
toolbar.appendChild(makeSlotRow())

const entryPanel = document.getElementById('text-entry')
const entrySlotHint = document.createElement('div')
entrySlotHint.className = 'slot-hint'
entrySlotHint.textContent = '選取組:點數字叫回並聚焦 · Shift+點存入目前選取'
entryPanel.appendChild(entrySlotHint)
entryPanel.appendChild(makeSlotRow())

renderSlots()
