import type {
  DashboardData,
  DashboardTeam,
  FantasyLeague,
  FantasyMatchup,
  FantasyRosterPlayer,
  FantasyTeam,
  LeagueSlate,
  LeagueSlateMatchup,
  TeamDetail,
} from '../domain/types'
import { loadEspnLeagueBundle } from '../providers/espn/adapter'
import { EspnError } from '../providers/espn/client'
import {
  loadSleeperLeagueBundle,
  loadSleeperLeagues,
  rawLeagueIdFrom,
} from '../providers/sleeper/adapter'
import { SleeperError } from '../providers/sleeper/client'
import { espnLeagues, loadConfig } from '../utils/storage'

type LeagueBundle = {
  league: FantasyLeague
  teams: FantasyTeam[]
  matchups: FantasyMatchup[]
  rostersByTeamId: Map<string, FantasyRosterPlayer[]>
  ownedTeamIds: string[]
}

function userMessage(error: unknown, fallback: string): string {
  if (error instanceof SleeperError || error instanceof EspnError) return error.message
  return fallback
}

function pairKey(teamId: string, opponentTeamId: string): string {
  if (!opponentTeamId) return teamId
  return teamId < opponentTeamId ? `${teamId}\0${opponentTeamId}` : `${opponentTeamId}\0${teamId}`
}

function toLeagueSlate(bundle: LeagueBundle): LeagueSlate {
  const teamsById = new Map(bundle.teams.map((team) => [team.id, team]))
  const seen = new Set<string>()
  const matchups: LeagueSlateMatchup[] = []

  for (const row of bundle.matchups) {
    const key = pairKey(row.teamId, row.opponentTeamId)
    if (seen.has(key)) continue
    seen.add(key)
    const homeTeam = teamsById.get(row.teamId)
    if (!homeTeam) continue
    const awayTeam = row.opponentTeamId ? teamsById.get(row.opponentTeamId) : undefined
    matchups.push({
      home: {
        id: homeTeam.id,
        name: homeTeam.name,
        logoUrl: homeTeam.logoUrl,
        points: row.points,
        projectedPoints: row.projectedPoints,
      },
      away: awayTeam
        ? {
            id: awayTeam.id,
            name: awayTeam.name,
            logoUrl: awayTeam.logoUrl,
            points: row.opponentPoints,
            projectedPoints: row.opponentProjectedPoints,
          }
        : undefined,
    })
  }

  const rostersByTeamId: Record<string, FantasyRosterPlayer[]> = {}
  for (const [id, roster] of bundle.rostersByTeamId) {
    rostersByTeamId[id] = roster
  }

  return {
    league: bundle.league,
    ownedTeamIds: bundle.ownedTeamIds,
    teams: bundle.teams,
    matchups,
    rostersByTeamId,
  }
}

function collectOwned(teams: DashboardTeam[], bundle: LeagueBundle): void {
  const teamsById = new Map(bundle.teams.map((team) => [team.id, team]))
  const matchByTeam = new Map(bundle.matchups.map((matchup) => [matchup.teamId, matchup]))
  for (const id of bundle.ownedTeamIds) {
    const team = teamsById.get(id)
    if (!team) continue
    const matchup = matchByTeam.get(id)
    teams.push({
      team,
      league: bundle.league,
      matchup,
      opponentName: matchup?.opponentTeamId
        ? teamsById.get(matchup.opponentTeamId)?.name
        : undefined,
      opponentLogoUrl: matchup?.opponentTeamId
        ? teamsById.get(matchup.opponentTeamId)?.logoUrl
        : undefined,
      roster: bundle.rostersByTeamId.get(id) ?? [],
      opponentRoster: matchup?.opponentTeamId
        ? (bundle.rostersByTeamId.get(matchup.opponentTeamId) ?? [])
        : [],
    })
  }
}

function espnConnectionFor(league: FantasyLeague) {
  return espnLeagues().find((row) => `espn:${row.leagueId}:${row.season}` === league.id)
}

async function loadRosterFromAdapter(
  league: FantasyLeague,
  teamId: string,
): Promise<FantasyRosterPlayer[]> {
  if (league.provider === 'sleeper') {
    const userId = loadConfig().providers.sleeper?.userId
    if (!userId) return []
    const bundle = await loadSleeperLeagueBundle(
      rawLeagueIdFrom(league.id),
      league.scoringPeriod,
      league.sport,
      userId,
    )
    return bundle.rostersByTeamId.get(teamId) ?? []
  }
  if (league.provider === 'espn') {
    const conn = espnConnectionFor(league)
    if (!conn) return []
    const bundle = await loadEspnLeagueBundle(conn)
    return bundle.rostersByTeamId.get(teamId) ?? []
  }
  return []
}

function sideMatchup(
  league: FantasyLeague,
  self: LeagueSlate['matchups'][number]['home'],
  opp: LeagueSlate['matchups'][number]['away'],
): FantasyMatchup {
  return {
    leagueId: league.id,
    scoringPeriod: league.scoringPeriod,
    teamId: self.id,
    opponentTeamId: opp?.id ?? '',
    points: self.points,
    opponentPoints: opp?.points ?? 0,
    projectedPoints: self.projectedPoints,
    opponentProjectedPoints: opp?.projectedPoints,
  }
}

async function detailFromSlate(slate: LeagueSlate, teamId: string): Promise<TeamDetail | null> {
  const team = slate.teams.find((row) => row.id === teamId)
  if (!team) return null

  const pair = slate.matchups.find((row) => row.home.id === teamId || row.away?.id === teamId)
  const self = pair?.home.id === teamId ? pair.home : pair?.away
  const opp = pair?.home.id === teamId ? pair.away : pair?.home

  const stored = slate.rostersByTeamId[teamId]
  const roster = stored ?? (await loadRosterFromAdapter(slate.league, teamId))

  return {
    team,
    league: slate.league,
    matchup: self ? sideMatchup(slate.league, self, opp) : undefined,
    opponentName: opp?.name,
    roster,
  }
}

export async function loadDashboard(): Promise<DashboardData> {
  const config = loadConfig()
  const teams: DashboardTeam[] = []
  const leagues: LeagueSlate[] = []
  const errors: DashboardData['errors'] = []

  const sleeper = config.providers.sleeper
  if (sleeper) {
    try {
      const sleeperLeagues = await loadSleeperLeagues(sleeper.userId)
      const bundles = await Promise.all(
        sleeperLeagues.map(async (league) => {
          const bundle = await loadSleeperLeagueBundle(
            rawLeagueIdFrom(league.id),
            league.scoringPeriod,
            league.sport,
            sleeper.userId,
          )
          return { league, ...bundle }
        }),
      )

      for (const bundle of bundles) {
        collectOwned(teams, bundle)
        leagues.push(toLeagueSlate(bundle))
      }
    } catch (error) {
      errors.push({
        provider: 'sleeper',
        message: userMessage(error, 'We could not load your Sleeper leagues.'),
      })
    }
  }

  const espn = espnLeagues(config)
  if (espn.length) {
    const results = await Promise.allSettled(espn.map((league) => loadEspnLeagueBundle(league)))
    let failed = 0
    for (const result of results) {
      if (result.status === 'fulfilled') {
        collectOwned(teams, result.value)
        leagues.push(toLeagueSlate(result.value))
      } else {
        failed += 1
      }
    }
    if (failed === results.length) {
      const reason = results.find((result) => result.status === 'rejected')
      errors.push({
        provider: 'espn',
        message: userMessage(
          reason && reason.status === 'rejected' ? reason.reason : undefined,
          'We could not load your ESPN leagues.',
        ),
      })
    } else if (failed > 0) {
      errors.push({
        provider: 'espn',
        message: 'One ESPN league could not load. The rest are still on the dashboard.',
      })
    }
  }

  return { teams, leagues, errors }
}

export async function loadTeamDetail(teamId: string): Promise<TeamDetail | null> {
  const dashboard = await loadDashboard()
  const owned = dashboard.teams.find((item) => item.team.id === teamId)
  if (owned) {
    return {
      team: owned.team,
      league: owned.league,
      matchup: owned.matchup,
      opponentName: owned.opponentName,
      roster: owned.roster,
    }
  }

  const host = dashboard.teams.find((item) => item.matchup?.opponentTeamId === teamId)
  if (host?.matchup) {
    const matchup = host.matchup
    return {
      team: {
        id: teamId,
        leagueId: host.league.id,
        name: host.opponentName ?? 'Opponent',
        logoUrl: host.opponentLogoUrl,
      },
      league: host.league,
      matchup: {
        ...matchup,
        teamId,
        opponentTeamId: host.team.id,
        points: matchup.opponentPoints,
        opponentPoints: matchup.points,
        projectedPoints: matchup.opponentProjectedPoints,
        opponentProjectedPoints: matchup.projectedPoints,
      },
      opponentName: host.team.name,
      roster: host.opponentRoster,
    }
  }

  for (const slate of dashboard.leagues) {
    const detail = await detailFromSlate(slate, teamId)
    if (detail) return detail
  }

  return null
}
