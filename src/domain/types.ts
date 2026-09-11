export type Sport = 'nfl' | 'nba' | 'mlb' | 'nhl'

export type ProviderName = 'sleeper' | 'yahoo' | 'espn'

export type FantasyScoringSettings = Record<string, number>

export interface FantasyLeague {
  id: string
  provider: ProviderName
  name: string
  sport: Sport
  season: number
  scoringPeriod: number
  teamCount: number
  scoring: FantasyScoringSettings
}

export interface FantasyTeam {
  id: string
  leagueId: string
  name: string
  ownerName?: string
  logoUrl?: string
  rank?: number
  wins?: number
  losses?: number
  ties?: number
  pointsFor?: number
}

export interface FantasyMatchup {
  leagueId: string
  scoringPeriod: number
  teamId: string
  opponentTeamId: string
  points: number
  opponentPoints: number
  projectedPoints?: number
  opponentProjectedPoints?: number
}

export interface FantasyRosterPlayer {
  providerPlayerId: string
  canonicalPlayerId: string
  fantasyTeamId: string
  leagueId: string
  name: string
  position: string
  rosterSlot: string
  proTeam: string
  starter: boolean
  points?: number
  projectedPoints?: number
  /** Compact injury code: Q, D, O, IR, PUP, … */
  injuryStatus?: string
}

export interface FantasyProvider {
  getLeagues(): Promise<FantasyLeague[]>
  getTeams(leagueId: string): Promise<FantasyTeam[]>
  getMatchups(leagueId: string, scoringPeriod: number): Promise<FantasyMatchup[]>
  getRoster(leagueId: string, teamId: string): Promise<FantasyRosterPlayer[]>
}

export type DashboardTeam = {
  team: FantasyTeam
  league: FantasyLeague
  matchup?: FantasyMatchup
  opponentName?: string
  opponentLogoUrl?: string
  roster: FantasyRosterPlayer[]
  opponentRoster: FantasyRosterPlayer[]
}

export type DashboardView = 'teams' | 'matchups' | 'leagues' | 'players' | 'live' | 'research'

export type LeagueSlateSide = {
  id: string
  name: string
  logoUrl?: string
  points: number
  projectedPoints?: number
  rank?: number
  wins?: number
  losses?: number
  ties?: number
}

export type LeagueSlateMatchup = {
  home: LeagueSlateSide
  away?: LeagueSlateSide
}

export type LeagueSlate = {
  league: FantasyLeague
  ownedTeamIds: string[]
  teams: FantasyTeam[]
  matchups: LeagueSlateMatchup[]
  rostersByTeamId: Record<string, FantasyRosterPlayer[]>
}

export type NFLGameStatus = 'scheduled' | 'live' | 'final'

export type NFLGame = {
  id: string
  startTime: string
  status: NFLGameStatus
  home: { abbr: string; score?: number }
  away: { abbr: string; score?: number }
  clockLabel?: string
  /** Pro team abbreviation of the side with the ball. Live games only. */
  possessionAbbr?: string
}

/** Weekly box-score counters keyed by Sleeper stat names (pass_yd, rec, pts_allow, …). */
export type NFLPlayerWeekStats = Record<string, number>

export type ProviderError = {
  provider: ProviderName
  message: string
  /** Stable id for dismissible warnings (e.g. Yahoo API access gate). */
  code?: string
}

export type DashboardData = {
  teams: DashboardTeam[]
  leagues: LeagueSlate[]
  errors: ProviderError[]
  currentWeek: number
  weekCount: number
  viewWeek: number
}

export type TeamDetail = {
  team: FantasyTeam
  league: FantasyLeague
  matchup?: FantasyMatchup
  opponentName?: string
  roster: FantasyRosterPlayer[]
}
