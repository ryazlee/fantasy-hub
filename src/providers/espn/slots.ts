const SLOT_NAMES: Record<number, string> = {
  0: 'QB',
  1: 'QB',
  2: 'RB',
  3: 'WRRB_FLEX',
  4: 'WR',
  5: 'REC_FLEX',
  6: 'TE',
  7: 'FLEX',
  8: 'DL',
  9: 'DL',
  10: 'LB',
  11: 'DL',
  12: 'DB',
  13: 'DB',
  14: 'DB',
  15: 'IDP_FLEX',
  16: 'DEF',
  17: 'K',
  18: 'P',
  19: 'HC',
  20: 'BN',
  21: 'IR',
  22: 'FLEX',
  23: 'FLEX',
  24: 'SUPER_FLEX',
  25: 'BN',
}

const POSITION_NAMES: Record<number, string> = {
  1: 'QB',
  2: 'RB',
  3: 'WR',
  4: 'TE',
  5: 'K',
  16: 'DEF',
}

export function espnSlotName(slotId: number | undefined): string {
  if (slotId == null) return 'BN'
  return SLOT_NAMES[slotId] ?? 'BN'
}

export function espnSlotIsStarter(slotId: number | undefined): boolean {
  return slotId != null && slotId !== 20 && slotId !== 21 && slotId !== 25
}

export function espnPositionName(positionId: number | undefined): string {
  if (positionId == null) return ''
  return POSITION_NAMES[positionId] ?? ''
}
