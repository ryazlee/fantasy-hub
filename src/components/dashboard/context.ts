import type { DashboardTeam, LeagueSlate, NFLGame } from '../../domain/types'

export type LeagueSlateView = Pick<LeagueSlate, 'league' | 'ownedTeamIds' | 'matchups'>

export type DashboardContext = {
  teams: DashboardTeam[]
  games: NFLGame[]
  leagues: LeagueSlateView[]
}
