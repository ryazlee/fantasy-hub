const NFL_REGULAR_WEEKS = 18

export function nflWeekCount(currentWeek: number): number {
  return Math.max(NFL_REGULAR_WEEKS, currentWeek)
}

export function clampWeek(week: number, count: number): number {
  if (!Number.isFinite(week)) return 1
  return Math.min(count, Math.max(1, Math.trunc(week)))
}
