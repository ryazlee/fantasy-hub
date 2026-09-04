import type { Sport } from './types'

const NFL_ORDER = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPER_FLEX', 'REC_FLEX', 'WRRB_FLEX', 'K', 'DEF', 'DL', 'LB', 'DB', 'IDP_FLEX', 'BN', 'IR', 'TAXI']

export function slotOrder(sport: Sport): string[] {
  if (sport === 'nba') {
    return ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL', 'BN', 'IR']
  }
  if (sport === 'mlb') {
    return ['C', '1B', '2B', '3B', 'SS', 'OF', 'UTIL', 'P', 'SP', 'RP', 'BN', 'IL']
  }
  if (sport === 'nhl') {
    return ['C', 'LW', 'RW', 'D', 'G', 'UTIL', 'BN', 'IR']
  }
  return NFL_ORDER
}

export function compareSlots(sport: Sport, a: string, b: string): number {
  const order = slotOrder(sport)
  const ai = order.indexOf(a)
  const bi = order.indexOf(b)
  const av = ai === -1 ? order.length : ai
  const bv = bi === -1 ? order.length : bi
  if (av !== bv) return av - bv
  return a.localeCompare(b)
}

export function isBenchSlot(slot: string): boolean {
  return slot === 'BN' || slot === 'BE' || slot === 'BENCH' || slot === 'IR' || slot === 'IL' || slot === 'TAXI'
}
