import type { Sport } from '../domain/types'

const LABELS: Record<Sport, string> = {
  nfl: 'NFL',
  nba: 'NBA',
  mlb: 'MLB',
  nhl: 'NHL',
}

export function sportLabel(sport: Sport): string {
  return LABELS[sport] ?? sport.toUpperCase()
}

export function providerLabel(provider: string): string {
  if (provider === 'sleeper') return 'Sleeper'
  if (provider === 'yahoo') return 'Yahoo'
  if (provider === 'espn') return 'ESPN'
  return provider
}

/** Missing and zero both mean no fantasy points yet — keep ESPN/Sleeper/Yahoo identical. */
export function formatPoints(value: number | null | undefined): string {
  const points = value == null || Number.isNaN(value) ? 0 : value
  return points.toFixed(1)
}

export function headerPeriodLabel(week: number | undefined, weekday: string): string {
  if (!week) return weekday
  return `${weekday}, Week ${week}`
}
