const BASE = (import.meta.env.VITE_YAHOO_API_URL ?? '').replace(/\/$/, '')

export class YahooError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'YahooError'
    this.status = status
  }
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

  if (res.status === 401) {
    throw new YahooError('Yahoo sign-in expired. Connect Yahoo again.', 401)
  }
  if (!res.ok) {
    throw new YahooError('We could not load your Yahoo leagues.', res.status)
  }

  try {
    return (await res.json()) as T
  } catch {
    throw new YahooError('We could not read Yahoo data.')
  }
}
