const { test } = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const { createLicense, effectivePlan, GRACE_MS } = require('../license.js')

const API = 'https://api.test'
const NOW = 1_800_000_000_000

function memoryStore(initial = null) {
  let value = initial
  return { load: () => value, save: (next) => { value = next }, peek: () => value }
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status })
}

function build({ store = memoryStore(), fetchImpl, openExternal = async () => {}, ...rest } = {}) {
  return createLicense({ apiBase: API, store, fetchImpl, openExternal, now: () => NOW, ...rest })
}

test('effectivePlan: fresh pro cache is pro, stale or missing is free', () => {
  assert.strictEqual(effectivePlan({ pro: true, checkedAt: NOW - 1000 }, NOW), 'pro')
  assert.strictEqual(effectivePlan({ pro: true, checkedAt: NOW - GRACE_MS - 1 }, NOW), 'free')
  assert.strictEqual(effectivePlan({ pro: false, checkedAt: NOW }, NOW), 'free')
  assert.strictEqual(effectivePlan(null, NOW), 'free')
})

test('effectivePlan: a checkedAt in the future does not extend the grace period', () => {
  assert.strictEqual(effectivePlan({ pro: true, checkedAt: NOW + 365 * 86400000 }, NOW), 'free')
})

test('no session means free and no network call', async () => {
  let calls = 0
  const license = build({ fetchImpl: async () => { calls += 1; return json(200, {}) } })
  await license.refresh()
  assert.strictEqual(license.plan(), 'free')
  assert.strictEqual(calls, 0)
})

test('refresh stores a pro result and notifies once', async () => {
  const store = memoryStore({ token: 'tok' })
  const seen = []
  const license = build({
    store,
    onChange: (plan) => { seen.push(plan) },
    fetchImpl: async (url, init) => {
      assert.strictEqual(String(url), `${API}/api/license`)
      assert.strictEqual(init.headers.Authorization, 'Bearer tok')
      return json(200, { pro: true, until: '2027-01-01T00:00:00.000Z', email: 'a@b.c' })
    }
  })
  await license.refresh()
  await license.refresh()
  assert.strictEqual(license.plan(), 'pro')
  assert.deepStrictEqual(seen, ['pro'])
  assert.strictEqual(store.peek().license.checkedAt, NOW)
  assert.strictEqual(license.account().email, 'a@b.c')
})

test('network failure keeps the cached pro plan', async () => {
  const store = memoryStore({ token: 'tok', license: { pro: true, checkedAt: NOW - 1000 } })
  const license = build({ store, fetchImpl: async () => { throw new Error('offline') } })
  await license.refresh()
  assert.strictEqual(license.plan(), 'pro')
})

test('a 502 keeps the cached plan', async () => {
  const store = memoryStore({ token: 'tok', license: { pro: true, checkedAt: NOW - 1000 } })
  const license = build({ store, fetchImpl: async () => json(502, {}) })
  await license.refresh()
  assert.strictEqual(license.plan(), 'pro')
})

test('a 401 clears the session and drops to free', async () => {
  const store = memoryStore({ token: 'tok', license: { pro: true, checkedAt: NOW - 1000 } })
  const license = build({ store, fetchImpl: async () => json(401, {}) })
  await license.refresh()
  assert.strictEqual(license.plan(), 'free')
  assert.strictEqual(store.peek().token, null)
})

function loginVia(openExternalUrl, params) {
  const opened = new URL(openExternalUrl)
  const port = opened.searchParams.get('port')
  const state = params.state || opened.searchParams.get('state')
  const query = new URLSearchParams({ state, code: params.code })
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${params.path || '/callback'}?${query}`, (res) => {
      res.resume()
      res.on('end', () => resolve(res.statusCode))
    }).on('error', reject)
  })
}

test('login opens the browser on a loopback port and accepts the matching state', async () => {
  const store = memoryStore()
  let opened
  const license = build({
    store,
    openExternal: async (url) => { opened = url },
    fetchImpl: async (url, init) => {
      if (String(url).endsWith('/api/desktop/redeem')) {
        assert.deepStrictEqual(JSON.parse(init.body), { code: 'once' })
        return json(200, { token: 'session-1' })
      }
      return json(200, { pro: false, until: null, email: 'a@b.c' })
    }
  })
  const pending = license.login()
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.ok(opened.startsWith(`${API}/desktop-login?`))
  assert.match(new URL(opened).searchParams.get('state'), /^[a-f0-9]{32}$/)
  assert.strictEqual(await loginVia(opened, { code: 'once' }), 200)
  assert.strictEqual(await pending, true)
  assert.strictEqual(store.peek().token, 'session-1')
})

test('login ignores a callback with the wrong state', async () => {
  const store = memoryStore()
  let opened
  const license = build({
    store,
    loginTimeoutMs: 400,
    openExternal: async (url) => { opened = url },
    fetchImpl: async () => json(200, { pro: false })
  })
  const pending = license.login()
  await new Promise((resolve) => setTimeout(resolve, 50))
  assert.strictEqual(await loginVia(opened, { code: 'evil', state: 'f'.repeat(32) }), 400)
  assert.strictEqual(await pending, false)
  assert.ok(!store.peek() || !store.peek().token)
})

test('a rejected login code leaves the app signed out', async () => {
  const store = memoryStore()
  let opened
  const license = build({
    store,
    openExternal: async (url) => { opened = url },
    fetchImpl: async () => json(401, {})
  })
  const pending = license.login()
  await new Promise((resolve) => setTimeout(resolve, 50))
  await loginVia(opened, { code: 'expired' })
  assert.strictEqual(await pending, false)
  assert.ok(!store.peek() || !store.peek().token)
})

test('malformed license json does not hang or change the plan', async () => {
  const store = memoryStore({ token: 'tok', license: { pro: true, checkedAt: NOW - 1000 } })
  const license = build({ store, fetchImpl: async () => new Response('<html>', { status: 200 }) })
  await license.refresh()
  assert.strictEqual(license.plan(), 'pro')
})

test('a refresh finishing after logout cannot restore pro', async () => {
  const store = memoryStore({ token: 'tok' })
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const license = build({
    store,
    fetchImpl: async () => {
      await gate
      return json(200, { pro: true, until: null, email: 'a@b.c' })
    }
  })
  const pending = license.refresh()
  license.logout()
  release()
  await pending
  assert.strictEqual(license.plan(), 'free')
})

test('upgrade opens the https checkout url and polls until pro', async () => {
  const store = memoryStore({ token: 'tok' })
  const opened = []
  let paid = false
  const license = build({
    store,
    pollMs: 10,
    openExternal: async (url) => { opened.push(url); paid = true },
    fetchImpl: async (url) => {
      if (String(url).endsWith('/api/checkout')) return json(200, { checkout_url: 'https://pay.test/npay/1' })
      return json(200, { pro: paid, until: null, email: 'a@b.c' })
    }
  })
  assert.strictEqual(await license.upgrade(), 'checkout')
  assert.deepStrictEqual(opened, ['https://pay.test/npay/1'])
  await new Promise((resolve) => setTimeout(resolve, 80))
  assert.strictEqual(license.plan(), 'pro')
  license.stop()
})

test('upgrade refuses a non-https checkout url', async () => {
  const opened = []
  const license = build({
    store: memoryStore({ token: 'tok' }),
    openExternal: async (url) => { opened.push(url) },
    fetchImpl: async (url) =>
      String(url).endsWith('/api/checkout')
        ? json(200, { checkout_url: 'javascript:alert(1)' })
        : json(200, { pro: false })
  })
  await assert.rejects(license.upgrade())
  assert.deepStrictEqual(opened, [])
})

test('upgrade on an already paid account just refreshes', async () => {
  const opened = []
  const license = build({
    store: memoryStore({ token: 'tok' }),
    openExternal: async (url) => { opened.push(url) },
    fetchImpl: async (url) =>
      String(url).endsWith('/api/checkout') ? json(409, {}) : json(200, { pro: true, until: null, email: 'a@b.c' })
  })
  assert.strictEqual(await license.upgrade(), 'already-pro')
  assert.strictEqual(license.plan(), 'pro')
  assert.deepStrictEqual(opened, [])
})

test('cancel posts to the api and keeps pro until the paid period ends', async () => {
  let posted = false
  const license = build({
    store: memoryStore({ token: 'tok', license: { pro: true, checkedAt: NOW - 1000 } }),
    fetchImpl: async (url, init) => {
      if (String(url).endsWith('/api/cancel')) {
        assert.strictEqual(init.method, 'POST')
        posted = true
        return json(200, { success: true })
      }
      return json(200, { pro: true, until: '2027-01-01T00:00:00.000Z', email: 'a@b.c' })
    }
  })
  assert.strictEqual(await license.cancel(), true)
  assert.ok(posted)
  assert.strictEqual(license.plan(), 'pro')
})

test('logout forgets the session and plan', () => {
  const store = memoryStore({ token: 'tok', license: { pro: true, checkedAt: NOW - 1000 } })
  const license = build({ store, fetchImpl: async () => json(200, {}) })
  license.logout()
  assert.strictEqual(license.plan(), 'free')
  assert.strictEqual(store.peek().token, null)
})
