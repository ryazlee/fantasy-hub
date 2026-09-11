import type {
  DashboardData,
  DashboardTeam,
  FantasyLeague,
  FantasyMatchup,
  FantasyRosterPlayer,
  FantasyTeam,
  LeagueSlate,
  LeagueSlateMatchup,
  LeagueSlateSide,
  MatchupDetail,
  TeamDetail,
} from '../domain/types'
import { loadEspnLeagueBundle } from '../providers/espn/adapter'
import { EspnError } from '../providers/espn/client'
import {
  loadSleeperLeagueBundle,
  loadSleeperLeagues,
  loadNflSeasonWeek,
  rawLeagueIdFrom,
} from '../providers/sleeper/adapter'
import { SleeperError } from '../providers/sleeper/client'
import { loadYahooLeagueBundles, loadYahooRoster } from '../providers/yahoo/adapter'
import { onYahooSession, YahooError } from '../providers/yahoo/client'
import { clampWeek } from '../domain/weeks'
import { espnLeagues, loadConfig, loadYahooSession, saveYahooSession } from '../utils/storage'

type LeagueBundle = {
  league: FantasyLeague
  teams: FantasyTeam[]
  matchups: FantasyMatchup[]
  rostersByTeamId: Map<string, FantasyRosterPlayer[]>
  ownedTeamIds: string[]
}

function userMessage(error: unknown, fallback: string): string {
  if (error instanceof SleeperError || error instanceof EspnError || error instanceof YahooError) {
    return error.message
  }
  return fallback
}

function pairKey(teamId: string, opponentTeamId: string): string {
  if (!opponentTeamId) return teamId
  return teamId < opponentTeamId ? `${teamId}\0${opponentTeamId}` : `${opponentTeamId}\0${teamId}`
}

function slateSide(
  team: FantasyTeam,
  points: number,
  projectedPoints?: number,
): LeagueSlate['matchups'][number]['home'] {
  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    points,
    projectedPoints,
    rank: team.rank,
    wins: team.wins,
    losses: team.losses,
    ties: team.ties,
  }
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
      home: slateSide(homeTeam, row.points, row.projectedPoints),
      away: awayTeam ? slateSide(awayTeam, row.opponentPoints, row.opponentProjectedPoints) : undefined,
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
    const bundle = await loadEspnLeagueBundle(conn, league.scoringPeriod)
    return bundle.rostersByTeamId.get(teamId) ?? []
  }
  if (league.provider === 'yahoo') {
    const session = loadYahooSession()
    if (!session) return []
    return loadYahooRoster(session, teamId, league)
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

export async function loadDashboard(week?: number | null): Promise<DashboardData> {
  const config = loadConfig()
  const teams: DashboardTeam[] = []
  const leagues: LeagueSlate[] = []
  const errors: DashboardData['errors'] = []
  onYahooSession(saveYahooSession)

  const season = await loadNflSeasonWeek().catch(() => ({ current: 1, count: 18 }))
  const viewWeek =
    week != null && week > 0 ? clampWeek(week, season.count) : season.current

  const sleeper = config.providers.sleeper
  if (sleeper) {
    try {
      const sleeperLeagues = await loadSleeperLeagues(sleeper.userId)
      const bundles = await Promise.all(
        sleeperLeagues.map(async (league) => {
          const bundle = await loadSleeperLeagueBundle(
            rawLeagueIdFrom(league.id),
            viewWeek,
            league.sport,
            sleeper.userId,
          )
          return { league: { ...league, scoringPeriod: viewWeek }, ...bundle }
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
    const results = await Promise.allSettled(
      espn.map((league) => loadEspnLeagueBundle(league, viewWeek)),
    )
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

  const yahooSession = loadYahooSession()
  if (config.providers.yahoo && yahooSession) {
    try {
      const bundles = await loadYahooLeagueBundles(yahooSession, viewWeek)
      for (const bundle of bundles) {
        collectOwned(teams, bundle)
        leagues.push(toLeagueSlate(bundle))
      }
    } catch (error) {
      errors.push({
        provider: 'yahoo',
        message: userMessage(error, 'We could not load your Yahoo leagues.'),
        code: error instanceof YahooError ? error.code : undefined,
      })
    }
  }

  return { teams, leagues, errors, currentWeek: season.current, weekCount: season.count, viewWeek }
}

function teamSide(team: FantasyTeam, points: number | undefined): LeagueSlateSide {
  return {
    id: team.id,
    name: team.name,
    logoUrl: team.logoUrl,
    points: points ?? 0,
    rank: team.rank,
    wins: team.wins,
    losses: team.losses,
    ties: team.ties,
  }
}

async function rosterFor(slate: LeagueSlate, teamId: string): Promise<FantasyRosterPlayer[]> {
  return slate.rostersByTeamId[teamId] ?? (await loadRosterFromAdapter(slate.league, teamId))
}

export async function loadMatchupDetail(
  teamId: string,
  opponentTeamId: string,
  week?: number | null,
): Promise<MatchupDetail | null> {
  const dashboard = await loadDashboard(week)

  for (const slate of dashboard.leagues) {
    const pair = slate.matchups.find(
      (row) =>
        (row.home.id === teamId && row.away?.id === opponentTeamId) ||
        (row.home.id === opponentTeamId && row.away?.id === teamId),
    )
    if (!pair?.away) continue
    const team = pair.home.id === teamId ? pair.home : pair.away
    const opponent = pair.home.id === teamId ? pair.away : pair.home
    const ownedIds = new Set(slate.ownedTeamIds)
    const [roster, opponentRoster] = await Promise.all([
      rosterFor(slate, team.id),
      rosterFor(slate, opponent.id),
    ])
    return {
      league: slate.league,
      team,
      opponent,
      teamMine: ownedIds.has(team.id),
      opponentMine: ownedIds.has(opponent.id),
      roster,
      opponentRoster,
    }
  }

  const owned = dashboard.teams.find(
    (row) => row.team.id === teamId && row.matchup?.opponentTeamId === opponentTeamId,
  )
  if (owned?.matchup) {
    return {
      league: owned.league,
      team: teamSide(owned.team, owned.matchup.points),
      opponent: teamSide(
        {
          id: opponentTeamId,
          leagueId: owned.league.id,
          name: owned.opponentName ?? 'Opponent',
          logoUrl: owned.opponentLogoUrl,
        },
        owned.matchup.opponentPoints,
      ),
      teamMine: true,
      opponentMine: dashboard.teams.some((row) => row.team.id === opponentTeamId),
      roster: owned.roster,
      opponentRoster: owned.opponentRoster,
    }
  }

  return null
}

export async function loadTeamDetail(teamId: string, week?: number | null): Promise<TeamDetail | null> {
  const dashboard = await loadDashboard(week)
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
