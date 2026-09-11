const SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

export class NflError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NflError'
  }
}

export async function espnGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    throw new NflError('We could not load NFL games.')
  }
  return res.json() as Promise<T>
}

export function scoreboardUrl(week?: number): string {
  if (!week || week < 1) return SCOREBOARD
  const params = new URLSearchParams()
  if (week <= 18) {
    params.set('seasontype', '2')
    params.set('week', String(week))
  } else {
    params.set('seasontype', '3')
    params.set('week', String(week - 18))
  }
  return `${SCOREBOARD}?${params}`
}
