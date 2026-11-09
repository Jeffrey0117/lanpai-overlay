// 額度牆:功能人人可按,超過額度才跳升級卡,推銷只出現在這張卡上。
let currentPlan = 'free'
let upgradeCard = null

const WALL_TEXT = {
  elements: `免費版同時釘 ${PLAN_LIMITS.free.elements} 個`,
  boards: `免費版 ${PLAN_LIMITS.free.boards} 個便籤板`,
  templates: `免費版 ${PLAN_LIMITS.free.templates} 組模板`,
  groups: `免費版 ${PLAN_LIMITS.free.groups} 組選取組`
}

const PRO_BENEFITS = [
  '同時釘不限',
  `樣式模板 ${PLAN_LIMITS.pro.templates} 組`,
  `選取組 ${PLAN_LIMITS.pro.groups} 組`,
  '便籤板不限'
]

function pinnedCount() {
  return document.querySelectorAll('.el:not(.board), .el.board .item').length
}

function boardCount() {
  return document.querySelectorAll('.el.board').length
}

function closeUpgradeCard() {
  if (!upgradeCard) return
  upgradeCard.remove()
  upgradeCard = null
  setInteractive(false)
}

async function startUpgrade(button, note) {
  button.disabled = true
  note.textContent = '正在開啟瀏覽器'
  const result = await api.startUpgrade()
  button.disabled = false
  const messages = {
    checkout: '在瀏覽器付款完成後,這裡會自動開通。',
    'login-failed': '沒有登入成功,再按一次試試。',
    error: '現在連不上,稍後再試一次。'
  }
  if (result === 'already-pro') closeUpgradeCard()
  else note.textContent = messages[result] || messages.error
}

function showUpgradeCard(kind) {
  if (upgradeCard) return
  setInteractive(true)

  const card = document.createElement('div')
  card.id = 'upgrade-card'

  const title = document.createElement('div')
  title.className = 'upgrade-title'
  title.textContent = WALL_TEXT[kind]
  card.appendChild(title)

  const price = document.createElement('div')
  price.className = 'upgrade-price'
  price.textContent = 'Pro NT$99 / 月'
  card.appendChild(price)

  const list = document.createElement('ul')
  list.className = 'upgrade-list'
  PRO_BENEFITS.forEach((text) => {
    const item = document.createElement('li')
    item.textContent = text
    list.appendChild(item)
  })
  card.appendChild(list)

  const note = document.createElement('div')
  note.className = 'upgrade-note'

  const button = document.createElement('button')
  button.className = 'upgrade-btn'
  button.textContent = '升級'
  button.addEventListener('click', () => startUpgrade(button, note))
  card.appendChild(button)
  card.appendChild(note)

  const close = document.createElement('button')
  close.className = 'upgrade-close'
  close.textContent = '之後再說'
  close.addEventListener('click', closeUpgradeCard)
  card.appendChild(close)

  document.body.appendChild(card)
  upgradeCard = card
}

// 回傳 true 代表可以繼續;false 代表撞牆,卡片已經跳出來了
function passWall(kind, count) {
  if (canAdd(currentPlan, kind, count)) return true
  showUpgradeCard(kind)
  return false
}

const allowPin = () => passWall('elements', pinnedCount())
const allowBoard = () => passWall('boards', boardCount())
const allowTemplate = (count) => passWall('templates', count)

function allowGroupSave(groups, slot) {
  if (canSaveGroup(currentPlan, groups, slot)) return true
  showUpgradeCard('groups')
  return false
}

function setPlan(plan) {
  currentPlan = plan === 'pro' ? 'pro' : 'free'
  if (currentPlan === 'pro') closeUpgradeCard()
}

function initPlan() {
  api.onPlanChanged(setPlan)
  api.getPlan().then(setPlan)
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && upgradeCard) closeUpgradeCard()
})
