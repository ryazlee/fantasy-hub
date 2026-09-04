import { compareSlots } from '../../domain/rosterSlots'
import type { DashboardTeam, FantasyRosterPlayer } from '../../domain/types'

export function compareRosterPlayers(
  sport: DashboardTeam['league']['sport'],
  a: FantasyRosterPlayer,
  b: FantasyRosterPlayer,
): number {
  if (a.starter !== b.starter) return a.starter ? -1 : 1
  return compareSlots(sport, a.rosterSlot, b.rosterSlot)
}

export function visibleRoster(
  players: FantasyRosterPlayer[],
  sport: DashboardTeam['league']['sport'],
  showBench: boolean,
): FantasyRosterPlayer[] {
  return players
    .filter((player) => showBench || player.starter)
    .slice()
    .sort((a, b) => compareRosterPlayers(sport, a, b))
}

export function splitStartersBench<T>(
  items: T[],
  isStarter: (item: T) => boolean,
): { starters: T[]; bench: T[] } {
  const starters: T[] = []
  const bench: T[] = []
  for (const item of items) {
    if (isStarter(item)) starters.push(item)
    else bench.push(item)
  }
  return { starters, bench }
}
