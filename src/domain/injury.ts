const TITLES: Record<string, string> = {
  Q: 'Questionable',
  D: 'Doubtful',
  O: 'Out',
  IR: 'Injured reserve',
  PUP: 'Physically unable to perform',
  NFI: 'Non-football injury',
  SUS: 'Suspended',
  COVID: 'COVID-19',
  P: 'Probable',
  DTD: 'Day-to-day',
}

const ALIASES: Record<string, string> = {
  questionable: 'Q',
  q: 'Q',
  doubtful: 'D',
  d: 'D',
  out: 'O',
  o: 'O',
  ir: 'IR',
  'injured reserve': 'IR',
  'injury reserve': 'IR',
  injuryreserve: 'IR',
  pup: 'PUP',
  'physically unable to perform': 'PUP',
  nfi: 'NFI',
  'non football injury': 'NFI',
  'non-football injury': 'NFI',
  suspended: 'SUS',
  suspension: 'SUS',
  covid: 'COVID',
  'covid 19': 'COVID',
  'covid-19': 'COVID',
  cov: 'COVID',
  probable: 'P',
  p: 'P',
  'day to day': 'DTD',
  'day-to-day': 'DTD',
  dtd: 'DTD',
}

const IGNORE = new Set(['active', 'healthy', 'normal', 'na', 'n/a', ''])

export function injuryCode(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const key = raw.trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ')
  if (IGNORE.has(key)) return undefined
  const mapped = ALIASES[key] ?? ALIASES[key.replace(/-/g, ' ')]
  if (mapped) return mapped
  const compact = key.replace(/[^a-z0-9]/g, '').toUpperCase()
  if (compact.length >= 1 && compact.length <= 4) return compact
  return undefined
}

export function injuryTitle(code: string): string {
  return TITLES[code] ?? code
}

export function injuryFlagClass(_code: string): string {
  return 'roster-flag roster-flag--injury'
}
