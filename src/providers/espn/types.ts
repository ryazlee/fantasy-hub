export type EspnMember = {
  id?: string
  displayName?: string
  firstName?: string
  lastName?: string
}

export type EspnStat = {
  scoringPeriodId?: number
  seasonId?: number
  statSourceId?: number
  statSplitTypeId?: number
  appliedTotal?: number
}

export type EspnPlayer = {
  id?: number
  fullName?: string
  defaultPositionId?: number
  proTeamId?: number
  injuryStatus?: string
  stats?: EspnStat[]
}

export type EspnPlayerPoolEntry = {
  playerId?: number
  appliedStatTotal?: number
  player?: EspnPlayer
}

export type EspnRosterEntry = {
  playerId?: number
  lineupSlotId?: number
  playerPoolEntry?: EspnPlayerPoolEntry
}

export type EspnRoster = {
  entries?: EspnRosterEntry[]
}

export type EspnTeam = {
  id?: number
  abbrev?: string
  name?: string
  location?: string
  nickname?: string
  logo?: string
  primaryOwner?: string
  roster?: EspnRoster
}

export type EspnMatchupSide = {
  teamId?: number
  totalPoints?: number
  totalPointsLive?: number
  totalProjectedPointsLive?: number
}

export type EspnScheduleItem = {
  id?: number
  matchupPeriodId?: number
  home?: EspnMatchupSide
  away?: EspnMatchupSide
}

export type EspnScoringItem = {
  statId?: number
  points?: number
}

export type EspnLeagueSettings = {
  name?: string
  size?: number
  isPublic?: boolean
  rosterSettings?: { lineupSlotCounts?: Record<string, number> }
  scoringSettings?: { scoringItems?: EspnScoringItem[] }
}

export type EspnLeagueStatus = {
  currentMatchupPeriod?: number
  latestScoringPeriod?: number
  firstScoringPeriod?: number
}

export type EspnLeague = {
  id?: number
  seasonId?: number
  scoringPeriodId?: number
  members?: EspnMember[]
  teams?: EspnTeam[]
  schedule?: EspnScheduleItem[]
  settings?: EspnLeagueSettings
  status?: EspnLeagueStatus
}
