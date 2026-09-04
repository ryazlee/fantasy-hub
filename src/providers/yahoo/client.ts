const BASE = (import.meta.env.VITE_YAHOO_API_URL ?? '').replace(/\/$/, '')

export class YahooError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'YahooError'
    this.status = status
  }
}

/** Map Yahoo Fantasy app-gate 403s to actionable copy (portal approval, not re-auth). */
function friendlyYahooApiError(raw: string, yahooStatus?: number): string {
  if (
    yahooStatus === 403 &&
    /not authorized to perform this action|Fantasy API access is not approved/i.test(raw)
  ) {
    return (
      'Yahoo has not approved Fantasy Sports API access for this app. ' +
      'In the Yahoo Sports Developer Portal, request access at sports.yahoo.com/developer/access ' +
      'and include your existing App ID. Re-connecting Yahoo alone will not fix this.'
    )
  }
  return raw || 'We could not load your Yahoo leagues.'
}

export function yahooWorkerUrl(): string {
  return BASE
}

export function yahooConfigured(): boolean {
  return Boolean(BASE)
}

export function yahooAuthUrl(): string {
  if (!BASE) throw new YahooError('Yahoo is not configured.')
  const from = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`
  const url = new URL(`${BASE}/auth`)
  url.searchParams.set('from', from)
  return url.toString()
}

type SessionHandler = (next: string) => void

let onRotate: SessionHandler | null = null

export function onYahooSession(handler: SessionHandler): void {
  onRotate = handler
}

export async function yahooGet<T>(path: string, session: string): Promise<T> {
  if (!BASE) throw new YahooError('Yahoo is not configured.')
  if (!session) throw new YahooError('Connect Yahoo again.')

  let res: Response
  try {
    res = await fetch(`${BASE}/yahoo?path=${encodeURIComponent(path)}`, {
      headers: { Authorization: `Bearer ${session}` },
    })
  } catch {
    throw new YahooError('We could not reach Yahoo. Try again in a moment.')
  }

  const rotated = res.headers.get('X-Yahoo-Session')
  if (rotated) onRotate?.(rotated)

  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (res.status === 401) {
    throw new YahooError('Yahoo sign-in expired. Connect Yahoo again.', 401)
  }
  if (!res.ok) {
    const rawMsg =
      body &&
      typeof body === 'object' &&
      typeof (body as { error?: unknown }).error === 'string' &&
      (body as { error: string }).error
        ? (body as { error: string }).error
        : ''
    const yahooStatus =
      body && typeof body === 'object' && typeof (body as { yahooStatus?: unknown }).yahooStatus === 'number'
        ? (body as { yahooStatus: number }).yahooStatus
        : undefined
    throw new YahooError(friendlyYahooApiError(rawMsg, yahooStatus ?? res.status), res.status)
  }

  if (body == null) throw new YahooError('We could not read Yahoo data.')
  return body as T
}
