import type { FantasyTeam } from './types'

export type StandingBits = {
  rank?: number
  wins?: number
  losses?: number
  ties?: number
  pointsFor?: number
}

export function formatRecord(standing: StandingBits): string | undefined {
  if (standing.wins == null && standing.losses == null) return undefined
  const wins = standing.wins ?? 0
  const losses = standing.losses ?? 0
  const ties = standing.ties ?? 0
  return ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`
}

export function formatPlacement(standing: StandingBits): string | undefined {
  const rank = standing.rank != null && standing.rank > 0 ? `#${standing.rank}` : undefined
  const record = formatRecord(standing)
  if (rank && record) return `${rank} · ${record}`
  return rank ?? record
}

function winPct(standing: StandingBits): number {
  const wins = standing.wins ?? 0
  const losses = standing.losses ?? 0
  const ties = standing.ties ?? 0
  const games = wins + losses + ties
  if (!games) return 0
  return (wins + 0.5 * ties) / games
}

function compareStandings(a: StandingBits, b: StandingBits): number {
  const byPct = winPct(b) - winPct(a)
  if (byPct) return byPct
  const byWins = (b.wins ?? 0) - (a.wins ?? 0)
  if (byWins) return byWins
  const byLosses = (a.losses ?? 0) - (b.losses ?? 0)
  if (byLosses) return byLosses
  return (b.pointsFor ?? 0) - (a.pointsFor ?? 0)
}

/** Fill missing ranks from W-L-T then points for. Provider ranks are kept. */
export function withComputedRanks(teams: FantasyTeam[]): FantasyTeam[] {
  if (teams.length === 0 || teams.every((team) => team.rank != null && team.rank > 0)) {
    return teams
  }
  const order = teams
    .map((team, index) => ({ team, index }))
    .sort((a, b) => compareStandings(a.team, b.team) || a.index - b.index)
  const ranks = new Map<number, number>()
  order.forEach((row, place) => {
    ranks.set(row.index, place + 1)
  })
  return teams.map((team, index) => ({
    ...team,
    rank: team.rank != null && team.rank > 0 ? team.rank : ranks.get(index),
  }))
}
