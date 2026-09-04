import type { Sport } from '../../domain/types'

const BASE = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games'

export class EspnError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'EspnError'
    this.status = status
  }
}

export function espnGameSlug(sport: Sport): string {
  if (sport === 'nba') return 'fba'
  if (sport === 'mlb') return 'flb'
  if (sport === 'nhl') return 'fhl'
  return 'ffl'
}

export function espnLeagueUrl(
  sport: Sport,
  season: number,
  leagueId: string,
  views: string[],
): string {
  const params = new URLSearchParams()
  for (const view of views) params.append('view', view)
  return `${BASE}/${espnGameSlug(sport)}/seasons/${season}/segments/0/leagues/${encodeURIComponent(leagueId)}?${params}`
}

export async function espnFantasyGet<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new EspnError('We could not reach ESPN. Try again in a moment.')
  }

  if (res.status === 401) {
    throw new EspnError(
      'That ESPN league is private. Make it public on ESPN, then connect again.',
      401,
    )
  }
  if (res.status === 404) {
    throw new EspnError('We could not find that ESPN league. Check the ID and season.', 404)
  }
  if (!res.ok) {
    throw new EspnError('We could not reach ESPN. Try again in a moment.', res.status)
  }

  const text = await res.text()
  if (!text) {
    throw new EspnError('We could not read that ESPN league.')
  }
  try {
    return JSON.parse(text) as T
  } catch {
    throw new EspnError('We could not read that ESPN league.')
  }
}
