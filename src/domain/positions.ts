const TONES: Record<string, string> = {
  QB: 'qb',
  RB: 'rb',
  WR: 'wr',
  TE: 'te',
  K: 'k',
  PK: 'k',
  DEF: 'def',
  DST: 'def',
  D: 'def',
  FLEX: 'flex',
  SUPERFLEX: 'flex',
  RECFLEX: 'flex',
  WRRBFLEX: 'flex',
  WRT: 'flex',
  WRRB: 'flex',
  WT: 'flex',
}

export function positionTone(position: string | undefined): string {
  if (!position) return ''
  const key = position.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const tone = TONES[key]
  return tone ? `pos-${tone}` : ''
}
