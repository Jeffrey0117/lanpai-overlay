// 快照歷史:內容變更存成里程碑,純移動位置只更新最新一筆(避免拖曳灌爆 30 格)。
// Ctrl+Z 回退、Ctrl+Shift+Z 前進;托盤「還原較早版本」開面板挑舊版。
const HIST_KEY = 'lanpai-history'
const HIST_MAX = 30

let histSuspended = false
let histCursor = -1 // -1 = 在最新狀態
let historyOpen = false

function loadHistory() {
  const hist = parseJson(localStorage.getItem(HIST_KEY), [])
  return Array.isArray(hist) ? hist : []
}

function storeHistory(hist) {
  try {
    localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(-HIST_MAX)))
  } catch (error) {
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(-5)))
    } catch (retryError) {
      // 連 5 筆都存不下就放棄這次,不影響使用
    }
  }
}

// 去掉座標後的內容指紋:指紋相同 = 只是移動,不值得多佔一格歷史
function sigOf(item) {
  const { x, y, items, ...rest } = item
  return items ? { ...rest, items: items.map(sigOf) } : rest
}

function contentSignature(json) {
  return JSON.stringify(parseJson(json, []).map(sigOf))
}

function pushHistory(json) {
  if (histSuspended) return
  const hist = loadHistory()
  const last = hist[hist.length - 1]
  if (last && last.json === json) return
  histCursor = -1
  if (last && contentSignature(last.json) === contentSignature(json)) {
    storeHistory([...hist.slice(0, -1), { t: Date.now(), json }])
    return
  }
  storeHistory([...hist, { t: Date.now(), json }])
}

function rebuildFromJson(json) {
  finishTextEdit()
  hideToolbar()
  document.querySelectorAll('.el').forEach((el) => el.remove())
  histSuspended = true
  restoreSnapshot(parseJson(json, []))
  histSuspended = false
}

function historyStep(direction) {
  const hist = loadHistory()
  if (!hist.length) return
  const current = histCursor === -1 ? hist.length - 1 : histCursor
  const target = current + direction
  if (target < 0 || target > hist.length - 1) return
  histCursor = target
  rebuildFromJson(hist[target].json)
}

function undo() {
  historyStep(-1)
}

function redo() {
  historyStep(1)
}

function formatHistTime(t) {
  const d = new Date(t)
  const pad = (n) => String(n).padStart(2, '0')
  const sameDay = d.toDateString() === new Date().toDateString()
  const day = sameDay ? '' : `${d.getMonth() + 1}/${d.getDate()} `
  return `${day}${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function describeHistEntry(json) {
  const items = parseJson(json, [])
  const texts = []
  const walk = (list) =>
    list.forEach((it) => {
      if (it.kind === 'text') texts.push(it.text)
      else if (it.kind === 'board') {
        texts.push(`#${it.title}`)
        walk(it.items || [])
      } else texts.push('圖')
    })
  walk(items)
  if (!items.length) return '0 項(空白)'
  const head = texts.slice(0, 3).join('、')
  return `${items.length} 項 · ${head.slice(0, 24)}${head.length > 24 ? '…' : ''}`
}

function closeHistoryPanel() {
  historyOpen = false
  const panel = document.getElementById('history-panel')
  if (panel) panel.remove()
  setInteractive(false)
}

function showHistoryPanel() {
  if (historyOpen) return
  historyOpen = true
  setInteractive(true)

  const panel = document.createElement('div')
  panel.id = 'history-panel'

  const title = document.createElement('div')
  title.className = 'hp-title'
  title.textContent = '還原較早版本'
  panel.appendChild(title)

  const list = document.createElement('div')
  list.className = 'hp-list'
  const hist = loadHistory()
  if (!hist.length) {
    const empty = document.createElement('div')
    empty.className = 'hp-empty'
    empty.textContent = '還沒有歷史'
    list.appendChild(empty)
  }
  hist
    .map((entry, index) => ({ entry, index }))
    .reverse()
    .forEach(({ entry, index }) => {
      const row = document.createElement('button')
      row.className = 'hp-row'
      row.textContent = `${formatHistTime(entry.t)} · ${describeHistEntry(entry.json)}`
      row.addEventListener('click', () => {
        histCursor = index
        rebuildFromJson(entry.json)
        closeHistoryPanel()
      })
      list.appendChild(row)
    })
  panel.appendChild(list)

  const close = document.createElement('button')
  close.className = 'hp-close'
  close.textContent = '關閉 (Esc)'
  close.addEventListener('click', closeHistoryPanel)
  panel.appendChild(close)

  document.body.appendChild(panel)
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && historyOpen) closeHistoryPanel()
})
