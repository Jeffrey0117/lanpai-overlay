// 第一次開啟跳一張歡迎卡 + 快捷鍵小抄;按「知道了」後設旗標,之後不再自動跳。
// 托盤選單「使用說明」或 Esc 可隨時叫回/關掉。
const ONBOARD_KEY = 'lanpai-onboarded'
let helpOpen = false
let helpCard = null

function closeHelpCard() {
  if (!helpOpen) return
  helpOpen = false
  if (helpCard) helpCard.remove()
  helpCard = null
  localStorage.setItem(ONBOARD_KEY, '1')
  setInteractive(false)
}

function showHelpCard() {
  if (helpOpen) return
  helpOpen = true
  setInteractive(true)

  const card = document.createElement('div')
  card.id = 'help-card'

  const title = document.createElement('div')
  title.className = 'help-title'
  title.textContent = '歡迎使用懶拍 ✨'
  card.appendChild(title)

  const desc = document.createElement('div')
  desc.className = 'help-desc'
  desc.textContent = '去背的螢幕便籤,平常隱形,要用才出現。'
  card.appendChild(desc)

  const list = document.createElement('div')
  list.className = 'help-list'
  const rows = [
    ['Ctrl+Shift+Space', '加文字 / 貼圖片網址 / 打 #標題 開便籤板'],
    ['Ctrl+Shift+V', '把剪貼簿的圖直接釘上來'],
    ['點 · 雙擊 · 右鍵', '調樣式 · 改字 · 刪除'],
    ['拖曳 · 滾輪 · Alt+拖', '移動 · 縮放 · 複製'],
    ['Ctrl+Z', '復原(誤刪、誤清都救得回)'],
    ['Ctrl+Shift+↑ / ↓', '置頂最前面 / 退到背景']
  ]
  rows.forEach(([key, desc]) => {
    const row = document.createElement('div')
    row.className = 'help-row'
    const kbd = document.createElement('kbd')
    kbd.textContent = key
    const span = document.createElement('span')
    span.textContent = desc
    row.appendChild(kbd)
    row.appendChild(span)
    list.appendChild(row)
  })
  card.appendChild(list)

  const foot = document.createElement('div')
  foot.className = 'help-foot'
  foot.textContent = '便籤板、聚焦、選取組⋯更多都在右下角托盤的藍點選單裡。'
  card.appendChild(foot)

  const btn = document.createElement('button')
  btn.className = 'help-btn'
  btn.textContent = '知道了'
  btn.addEventListener('click', closeHelpCard)
  card.appendChild(btn)

  document.body.appendChild(card)
  helpCard = card
}

function initOnboarding() {
  if (localStorage.getItem(ONBOARD_KEY) !== '1') showHelpCard()
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && helpOpen) closeHelpCard()
})
