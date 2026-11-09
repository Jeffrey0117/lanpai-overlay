// 登入與訂閱狀態,跑在主程序。沒有 Electron 依賴,外部能力都由呼叫端注入。
const http = require('http')
const crypto = require('crypto')

const GRACE_MS = 7 * 24 * 3600 * 1000
const REQUEST_TIMEOUT_MS = 10_000
const DEFAULT_LOGIN_TIMEOUT_MS = 5 * 60_000
const DEFAULT_POLL_MS = 20_000
const POLL_WINDOW_MS = 15 * 60_000

const CALLBACK_PAGE = `<!doctype html><meta charset="utf-8"><title>懶拍</title>
<body style="background:#111316;color:#f2f3f5;font-family:system-ui,sans-serif;text-align:center;padding-top:20vh">
<h1>登入成功</h1><p>可以關掉這一頁,回到懶拍了。</p></body>`

// 離線也能用:上次確認過是 Pro,七天內都算數。未來的時間戳不算數。
function effectivePlan(license, now) {
  if (!license || license.pro !== true) return 'free'
  const age = now - license.checkedAt
  return age >= 0 && age <= GRACE_MS ? 'pro' : 'free'
}

function createLicense({
  apiBase,
  store,
  fetchImpl = fetch,
  openExternal,
  now = Date.now,
  onChange = () => {},
  loginTimeoutMs = DEFAULT_LOGIN_TIMEOUT_MS,
  pollMs = DEFAULT_POLL_MS
}) {
  let state = store.load() || { token: null, license: null }
  let pollTimer = null
  let lastPlan = effectivePlan(state.license, now())

  function commit(next) {
    state = next
    store.save(state)
    const plan = effectivePlan(state.license, now())
    if (plan !== lastPlan) {
      lastPlan = plan
      onChange(plan)
    }
  }

  const plan = () => effectivePlan(state.license, now())

  const account = () => ({
    signedIn: Boolean(state.token),
    email: state.license ? state.license.email || null : null,
    until: state.license ? state.license.until || null : null,
    plan: plan()
  })

  function request(path, method = 'GET') {
    return fetchImpl(`${apiBase}${path}`, {
      method,
      headers: { Authorization: `Bearer ${state.token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    })
  }

  function logout() {
    stop()
    commit({ token: null, license: null })
  }

  async function refresh() {
    if (!state.token) return
    const tokenAtStart = state.token
    let res
    try {
      res = await request('/api/license')
    } catch (error) {
      return
    }
    if (state.token !== tokenAtStart) return // 查詢途中登出或換了帳號,這個結果作廢
    if (res.status === 401) return logout()
    if (!res.ok) return
    let body
    try {
      body = await res.json()
    } catch (error) {
      return
    }
    if (state.token !== tokenAtStart) return
    commit({
      ...state,
      license: { pro: body.pro === true, until: body.until || null, email: body.email || null, checkedAt: now() }
    })
  }

  async function redeemCode(code) {
    try {
      const res = await fetchImpl(`${apiBase}/api/desktop/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      })
      if (!res.ok) return null
      return (await res.json()).token || null
    } catch (error) {
      return null
    }
  }

  function login() {
    return new Promise((resolve) => {
      const expected = crypto.randomBytes(16).toString('hex')
      let settled = false
      let timer = null
      const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1')
        const code = url.searchParams.get('code')
        if (url.pathname !== '/callback' || url.searchParams.get('state') !== expected || !code) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Invalid login callback')
          return
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' })
        res.end(CALLBACK_PAGE)
        finish(code)
      })

      async function finish(code) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        server.close()
        server.closeAllConnections()
        const token = code ? await redeemCode(code) : null
        if (!token) return resolve(false)
        commit({ ...state, token, license: null })
        await refresh()
        return resolve(true)
      }

      timer = setTimeout(() => finish(null), loginTimeoutMs)
      server.on('error', () => finish(null))
      server.listen(0, '127.0.0.1', () => {
        const query = new URLSearchParams({ port: String(server.address().port), state: expected })
        Promise.resolve(openExternal(`${apiBase}/desktop-login?${query}`)).catch(() => finish(null))
      })
    })
  }

  function stop() {
    clearInterval(pollTimer)
    pollTimer = null
  }

  // 付款在瀏覽器完成,app 這邊輪詢到開通為止
  function pollUntilPro() {
    stop()
    const deadline = now() + POLL_WINDOW_MS
    pollTimer = setInterval(async () => {
      await refresh()
      if (plan() === 'pro' || now() > deadline) stop()
    }, pollMs)
    if (pollTimer.unref) pollTimer.unref()
  }

  async function upgrade() {
    if (!state.token && !(await login())) return 'login-failed'
    if (plan() === 'pro') return 'already-pro'
    const res = await request('/api/checkout', 'POST')
    if (res.status === 409) {
      await refresh()
      return 'already-pro'
    }
    if (res.status === 401) {
      logout()
      return 'login-failed'
    }
    if (!res.ok) throw new Error(`Checkout failed with ${res.status}`)
    const { checkout_url: checkoutUrl } = await res.json()
    if (new URL(checkoutUrl).protocol !== 'https:') throw new Error('Unexpected checkout url')
    await openExternal(checkoutUrl)
    pollUntilPro()
    return 'checkout'
  }

  async function cancel() {
    const res = await request('/api/cancel', 'POST')
    if (!res.ok) return false
    await refresh()
    return true
  }

  return { plan, account, refresh, login, upgrade, cancel, logout, stop }
}

module.exports = { createLicense, effectivePlan, GRACE_MS }
