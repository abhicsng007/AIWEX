/**
 * Shared HTTP client for AIWEX end-to-end tests.
 * Each Client instance owns an isolated cookie jar (demo run).
 */

export const baseUrl = process.env.AIWEX_BASE_URL || 'http://localhost:3000'

export class ApiClient {
  /** @param {string} [url] */
  constructor(url = baseUrl) {
    this.baseUrl = url.replace(/\/$/, '')
    /** @type {Map<string, string>} */
    this.cookies = new Map()
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  }

  /** @param {string | string[] | null} setCookie */
  storeCookies(setCookie) {
    const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
    for (const header of headers) {
      const [pair] = header.split(';')
      const eq = pair.indexOf('=')
      if (eq === -1) continue
      this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }

  get demoRunId() {
    return this.cookies.get('aiwex_demo_run') || null
  }

  /**
   * @param {string} method
   * @param {string} path
   * @param {unknown} [body]
   * @param {{ headers?: Record<string, string> }} [options]
   */
  async request(method, path, body, options = {}) {
    /** @type {Record<string, string>} */
    const headers = { Accept: 'application/json', ...(options.headers || {}) }
    const cookie = this.cookieHeader()
    if (cookie) headers.Cookie = cookie
    if (body !== undefined) headers['Content-Type'] = 'application/json'

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    })

    const setCookie = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : response.headers.get('set-cookie')
    this.storeCookies(setCookie)

    const text = await response.text()
    let json = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = { raw: text.slice(0, 800) }
    }

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      json,
      text,
      location: response.headers.get('location'),
    }
  }

  get(path) {
    return this.request('GET', path)
  }

  post(path, body) {
    return this.request('POST', path, body)
  }

  put(path, body) {
    return this.request('PUT', path, body)
  }
}

/** @returns {Promise<boolean>} */
export async function serverIsReachable(url = baseUrl) {
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/api/health`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Skip the current test file when the app is not running.
 * Call from `before` / top-level setup.
 * @param {import('node:test').TestContext | { skip: (reason?: string) => void }} t
 */
export async function requireServer(t) {
  const ok = await serverIsReachable()
  if (!ok) {
    const message = `AIWEX server not reachable at ${baseUrl}. Start with: npm run dev`
    if (process.env.AIWEX_REQUIRE_SERVER === '1') throw new Error(message)
    t.skip(message)
    return false
  }
  return true
}
