const SCOREBOARD =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

export class NflError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NflError'
  }
}

export async function espnGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new NflError('We could not load NFL games.')
  }
  return res.json() as Promise<T>
}

export function scoreboardUrl(): string {
  return SCOREBOARD
}
