export type SleeperUser = {
  user_id: string
  username: string
  display_name?: string
  avatar?: string
}

export type SleeperState = {
  week?: number
  season?: string
  season_type?: string
  display_week?: number
}

export type SleeperLeague = {
  league_id: string
  name: string
  season: string
  sport?: string
  total_rosters?: number
  roster_positions?: string[]
  scoring_settings?: Record<string, number>
  settings?: { playoff_week_start?: number }
}

export type SleeperRoster = {
  roster_id: number
  owner_id: string | null
  players?: string[] | null
  starters?: string[] | null
  reserve?: string[] | null
  taxi?: string[] | null
  metadata?: { team_name?: string } | null
}

export type SleeperLeagueUser = {
  user_id: string
  display_name?: string
  metadata?: { team_name?: string; avatar?: string } | null
  avatar?: string
}

export type SleeperMatchup = {
  roster_id: number
  matchup_id: number | null
  points?: number
  players_points?: Record<string, number>
}

export type SleeperPlayer = {
  player_id?: string
  first_name?: string
  last_name?: string
  full_name?: string
  position?: string
  team?: string
  fantasy_positions?: string[]
  espn_id?: number | string | null
  injury_status?: string | null
}
