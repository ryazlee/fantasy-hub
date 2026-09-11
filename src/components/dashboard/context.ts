import type { DashboardTeam, LeagueSlate, NFLGame, NFLPlayerWeekStats } from '../../domain/types'

export type LeagueSlateView = Pick<LeagueSlate, 'league' | 'ownedTeamIds' | 'matchups'>

export type DashboardContext = {
  teams: DashboardTeam[]
  games: NFLGame[]
  playerStats: Record<string, NFLPlayerWeekStats>
  leagues: LeagueSlateView[]
}
