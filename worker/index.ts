type Env = {
  YAHOO_CLIENT_ID: string
  YAHOO_CLIENT_SECRET: string
  YAHOO_REDIRECT_URI: string
  TOKEN_ENCRYPTION_KEY: string
  FRONTEND_ORIGIN: string
}

type TokenSet = {
  access_token: string
  refresh_token: string
  expires_at: number
}

const YAHOO_AUTH = 'https://api.login.yahoo.com/oauth2/request_auth'
const YAHOO_TOKEN = 'https://api.login.yahoo.com/oauth2/get_token'
const YAHOO_API = 'https://fantasysports.yahooapis.com/fantasy/v2'
const STATE_MAX_AGE_MS = 15 * 60 * 1000

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return cors(request, env, new Response(null, { status: 204 }))

    try {
      if (request.method === 'GET' && url.pathname === '/auth') return redirectToYahoo(url, env)
      if (request.method === 'GET' && url.pathname === '/callback') return handleCallback(url, env)
      if (url.pathname === '/yahoo' || url.pathname.startsWith('/yahoo/')) {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)
        return proxyYahoo(request, url, env)
      }
      return json({ error: 'Not found' }, 404)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Yahoo worker error'
      return cors(request, env, json({ error: message }, 500))
    }
  },
}

function frontendAllowlist(env: Env): string[] {
  return [
    env.FRONTEND_ORIGIN.replace(/\/$/, ''),
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:4173',
    'http://localhost:4173',
  ]
}

function allowedReturnTo(raw: string, env: Env): string | null {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const origin = parsed.origin
  if (!frontendAllowlist(env).includes(origin)) return null
  if (origin === env.FRONTEND_ORIGIN.replace(/\/$/, '') && !parsed.pathname.startsWith('/fantasy-hub')) {
    return `${origin}/fantasy-hub`
  }
  return `${origin}${parsed.pathname.replace(/\/$/, '')}`
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') ?? ''
  const allow = frontendAllowlist(env).includes(origin) ? origin : frontendAllowlist(env)[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Expose-Headers': 'X-Yahoo-Session',
    Vary: 'Origin',
  }
}

function cors(request: Request, env: Env, response: Response): Response {
  const next = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders(request, env))) next.set(key, value)
  return new Response(response.body, { status: response.status, headers: next })
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function redirectToYahoo(url: URL, env: Env): Promise<Response> {
  const returnTo = allowedReturnTo(url.searchParams.get('from') ?? env.FRONTEND_ORIGIN, env)
  if (!returnTo) return json({ error: 'That return URL is not allowed.' }, 400)
  const state = await signState(env, { from: returnTo, t: Date.now() })
  const auth = new URL(YAHOO_AUTH)
  auth.searchParams.set('client_id', env.YAHOO_CLIENT_ID)
  auth.searchParams.set('redirect_uri', env.YAHOO_REDIRECT_URI)
  auth.searchParams.set('response_type', 'code')
  auth.searchParams.set('scope', 'fspt-w')
  auth.searchParams.set('state', state)
  auth.searchParams.set('language', 'en-us')
  return Response.redirect(auth.toString(), 302)
}

async function handleCallback(url: URL, env: Env): Promise<Response> {
  const error = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const payload = state ? await readState(env, state) : null
  const returnTo = payload?.from ?? `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/fantasy-hub`
  if (error || !code || !payload) {
    const reason = encodeURIComponent(error || 'Yahoo sign-in was cancelled.')
    return Response.redirect(`${returnTo}/yahoo/callback#error=${reason}`, 302)
  }
  const tokens = await exchangeCode(env, code)
  const session = await encryptTokens(env, tokens)
  return Response.redirect(`${returnTo}/yahoo/callback#session=${encodeURIComponent(session)}`, 302)
}

async function proxyYahoo(request: Request, url: URL, env: Env): Promise<Response> {
  const header = request.headers.get('Authorization') ?? ''
  const blob = header.startsWith('Bearer ') ? header.slice(7).trim() : url.searchParams.get('session') ?? ''
  if (!blob) return cors(request, env, json({ error: 'Connect Yahoo again.' }, 401))

  let tokens: TokenSet
  try {
    tokens = await decryptTokens(env, blob)
  } catch {
    return cors(request, env, json({ error: 'Connect Yahoo again.' }, 401))
  }

  let rotated = blob
  if (tokens.expires_at < Date.now() + 60_000) {
    tokens = await refreshTokens(env, tokens.refresh_token)
    rotated = await encryptTokens(env, tokens)
  }

  const path = yahooPath(url)
  if (!path) return cors(request, env, json({ error: 'That Yahoo path is not allowed.' }, 400))

  const yahooUrl = `${YAHOO_API}/${path}${path.includes('format=') ? '' : (path.includes('?') ? '&' : '?') + 'format=json'}`
  const yahooRes = await fetch(yahooUrl, {
    headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' },
  })
  const text = await yahooRes.text()
  const headers = new Headers(corsHeaders(request, env))
  headers.set('Content-Type', 'application/json; charset=utf-8')
  if (rotated !== blob) headers.set('X-Yahoo-Session', rotated)
  if (!yahooRes.ok) {
    const detail = safeYahooError(text, yahooRes.status)
    return new Response(JSON.stringify({ error: detail, yahooStatus: yahooRes.status, path }), {
      status: yahooRes.status === 401 ? 401 : 502,
      headers,
    })
  }
  return new Response(text || '{}', { status: 200, headers })
}

/** Strip secrets; keep a short Yahoo error description for SPA debugging. */
function safeYahooError(body: string, status: number): string {
  const trimmed = body.trim().slice(0, 800)
  let description = ''
  try {
    const parsed = JSON.parse(trimmed) as {
      error?: { description?: string; detail?: string } | string
      description?: string
    }
    if (typeof parsed.error === 'string') description = parsed.error
    else if (parsed.error && typeof parsed.error === 'object') {
      description = parsed.error.description || parsed.error.detail || ''
    } else if (parsed.description) description = parsed.description
  } catch {
    const xml = trimmed.match(/<description>([^<]+)<\/description>/i)
    if (xml?.[1]) description = xml[1]
  }
  description = description.replace(/[\x00-\x1f]/g, ' ').trim().slice(0, 240)
  if (/access[_-]?token|refresh[_-]?token|bearer\s+\S+/i.test(description)) {
    description = ''
  }
  // App-level Fantasy API gate (not OAuth/session): Yahoo blocks every fantasy
  // endpoint until the app is approved at sports.yahoo.com/developer/access.
  if (
    status === 403 &&
    /not authorized to perform this action/i.test(description || trimmed)
  ) {
    return (
      'Yahoo Fantasy API access is not approved for this app. ' +
      'Request Fantasy Sports access at sports.yahoo.com/developer/access ' +
      '(include your existing App ID). Re-connecting alone will not fix this.'
    )
  }
  if (description) return `Yahoo ${status}: ${description}`
  return `Yahoo could not load that data (${status}).`
}

function yahooPath(url: URL): string | null {
  const fromQuery = url.searchParams.get('path')
  const fromRest = url.pathname.replace(/^\/yahoo\/?/, '')
  const raw = (fromQuery || fromRest).replace(/^\/+/, '')
  if (!raw) return null
  if (raw.includes('://') || raw.includes('..')) return null
  const pathOnly = raw.split('?')[0] ?? ''
  if (!/^(users|games|game|league|team)([/;,]|$)/.test(pathOnly)) return null
  if (!/^[a-z0-9_.;,=\-/]+$/i.test(raw)) return null
  return raw
}

async function exchangeCode(env: Env, code: string): Promise<TokenSet> {
  return tokenRequest(env, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.YAHOO_REDIRECT_URI,
  })
}

async function refreshTokens(env: Env, refreshToken: string): Promise<TokenSet> {
  return tokenRequest(env, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
}

async function tokenRequest(env: Env, body: Record<string, string>): Promise<TokenSet> {
  const basic = btoa(`${env.YAHOO_CLIENT_ID}:${env.YAHOO_CLIENT_SECRET}`)
  const res = await fetch(YAHOO_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  })
  const data = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    error?: string
  }
  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new Error('Yahoo would not issue tokens. Check the app redirect URI.')
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + Math.max(30, data.expires_in ?? 3600) * 1000,
  }
}

async function signState(env: Env, payload: { from: string; t: number }): Promise<string> {
  const body = btoaUrl(JSON.stringify(payload))
  const sig = await hmac(env.TOKEN_ENCRYPTION_KEY, body)
  return `${body}.${sig}`
}

async function readState(env: Env, state: string): Promise<{ from: string; t: number } | null> {
  const at = state.lastIndexOf('.')
  if (at < 0) return null
  const body = state.slice(0, at)
  const sig = state.slice(at + 1)
  const expected = await hmac(env.TOKEN_ENCRYPTION_KEY, body)
  if (sig !== expected) return null
  try {
    const payload = JSON.parse(atobUrl(body)) as { from: string; t: number }
    if (Date.now() - payload.t > STATE_MAX_AGE_MS) return null
    return allowedReturnTo(payload.from, env) ? payload : null
  } catch {
    return null
  }
}

async function encryptTokens(env: Env, tokens: TokenSet): Promise<string> {
  const key = await aesKey(env.TOKEN_ENCRYPTION_KEY)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(tokens)),
  )
  const packed = new Uint8Array(iv.length + cipher.byteLength)
  packed.set(iv, 0)
  packed.set(new Uint8Array(cipher), iv.length)
  return btoaUrl(packed)
}

async function decryptTokens(env: Env, blob: string): Promise<TokenSet> {
  const packed = atobBytes(blob)
  const iv = packed.slice(0, 12)
  const data = packed.slice(12)
  const key = await aesKey(env.TOKEN_ENCRYPTION_KEY)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  const parsed = JSON.parse(new TextDecoder().decode(plain)) as TokenSet
  if (!parsed.access_token || !parsed.refresh_token) throw new Error('bad session')
  return parsed
}

async function aesKey(secret: string): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

async function hmac(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  return btoaUrl(new Uint8Array(sig))
}

function btoaUrl(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value
  let bin = ''
  for (const byte of bytes) bin += String.fromCharCode(byte)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function atobUrl(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4)
  return atob(padded)
}

function atobBytes(value: string): Uint8Array {
  const bin = atobUrl(value)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}
