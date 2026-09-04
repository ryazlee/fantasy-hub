const ALIASES: Record<string, string> = {
  WSH: 'WAS',
  WAS: 'WAS',
  JAC: 'JAX',
  JAX: 'JAX',
}

export function normalizeTeamAbbr(abbr: string | undefined): string {
  const raw = (abbr ?? '').toUpperCase()
  return ALIASES[raw] ?? raw
}
