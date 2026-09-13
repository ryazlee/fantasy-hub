import type {
  FantasyLeague,
  FantasyMatchup,
  FantasyRosterPlayer,
  FantasyTeam,
  Sport,
} from '../../domain/types'
import { injuryCode } from '../../domain/injury'
import { withComputedRanks } from '../../domain/standings'
import { loadSleeperPlayers } from '../sleeper/adapter'
import type { SleeperPlayer } from '../sleeper/types'
import { yahooGet, YahooError } from './client'
import { buildYahooIdIndex, resolveYahooCanonicalId } from './mapPlayer'
import { num, text, yahooMerge, yahooResources } from './parse'

type LeagueBundle = {
  league: FantasyLeague
  teams: FantasyTeam[]
  matchups: FantasyMatchup[]
  rostersByTeamId: Map<string, FantasyRosterPlayer[]>
  ownedTeamIds: string[]
}

function sportFromCode(code: string | undefined): Sport | null {
  if (code === 'nfl' || code === 'nba' || code === 'mlb' || code === 'nhl') return code
  return null
}

function leagueId(key: string): string {
  return `yahoo:${key}`
}

function teamId(teamKey: string): string {
  return `yahoo:${teamKey}`
}

function rawTeamKey(id: string): string {
  return id.replace(/^yahoo:/, '')
}

function benchSlot(position: string): boolean {
  const slot = position.toUpperCase()
  return slot === 'BN' || slot === 'IR' || slot === 'IL' || slot === 'NA' || slot === 'TAXI'
}

function logoFromTeam(team: Record<string, unknown>): string | undefined {
  const logos = yahooResources(team.team_logos, 'team_logo')
  const url = text(logos[0]?.url)
  return url || undefined
}

function content(raw: unknown): Record<string, unknown> {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return yahooMerge(root.fantasy_content ?? root)
}

function yahooFlag(value: unknown): boolean {
  return value === true || num(value) === 1 || text(value) === '1'
}

function isOwnedTeam(team: Record<string, unknown>, ownedKeys: Set<string>): boolean {
  if (yahooFlag(team.is_owned) || yahooFlag(team.is_owned_by_current_login)) return true
  const key = text(team.team_key)
  if (key && ownedKeys.has(key)) return true
  const managers = yahooResources(team.managers, 'manager')
  return managers.some((m) => yahooFlag(m.is_current_login))
}

function managerNames(team: Record<string, unknown>): string | undefined {
  const names = yahooResources(team.managers, 'manager')
    .map((row) => text(row.nickname) || text(row.guid))
    .filter((name): name is string => Boolean(name))
  return names.length ? names.join(' & ') : undefined
}

function leagueKeyFromTeamKey(teamKey: string): string {
  const cut = teamKey.lastIndexOf('.t.')
  return cut > 0 ? teamKey.slice(0, cut) : ''
}

function collectOwnedYahooTeamKeys(raw: unknown): Set<string> {
  const keys = new Set<string>()
  if (raw == null) return keys
  const users = yahooResources(content(raw).users, 'user')
  const games = yahooResources(users[0]?.games, 'game')
  for (const game of games) {
    for (const team of yahooResources(game.teams, 'team')) {
      const key = text(team.team_key)
      if (key) keys.add(key)
    }
  }
  return keys
}

type YahooLeagueJob = {
  sport: Sport
  season: number
  league: Record<string, unknown>
}

function yahooGames(raw: unknown): Record<string, unknown>[] {
  const users = yahooResources(content(raw).users, 'user')
  return yahooResources(users[0]?.games, 'game')
}

function collectYahooLeagueJobs(leaguesRaw: unknown): { jobs: YahooLeagueJob[]; seen: Set<string> } {
  const jobs: YahooLeagueJob[] = []
  const seen = new Set<string>()
  const year = new Date().getFullYear()
  for (const game of yahooGames(leaguesRaw)) {
    const sport = sportFromCode(text(game.code) || text(game.name).toLowerCase())
    if (!sport) continue
    const season = num(game.season) ?? year
    for (const league of yahooResources(game.leagues, 'league')) {
      const key = text(league.league_key)
      if (!key || seen.has(key)) continue
      seen.add(key)
      jobs.push({ sport, season, league })
    }
  }
  return { jobs, seen }
}

function missingYahooLeaguesFromTeams(
  teamsRaw: unknown,
  seen: Set<string>,
): { sport: Sport; season: number; leagueKey: string }[] {
  const missing: { sport: Sport; season: number; leagueKey: string }[] = []
  if (teamsRaw == null) return missing
  const year = new Date().getFullYear()
  for (const game of yahooGames(teamsRaw)) {
    const sport = sportFromCode(text(game.code) || text(game.name).toLowerCase())
    if (!sport) continue
    const season = num(game.season) ?? year
    for (const team of yahooResources(game.teams, 'team')) {
      const leagueKey = leagueKeyFromTeamKey(text(team.team_key))
      if (!leagueKey || seen.has(leagueKey)) continue
      seen.add(leagueKey)
      missing.push({ sport, season, leagueKey })
    }
  }
  return missing
}

function applyYahooStanding(team: FantasyTeam, row: Record<string, unknown>): FantasyTeam {
  const standing = yahooMerge(row.team_standings)
  const totals = yahooMerge(standing.outcome_totals)
  const rank = num(standing.rank)
  return {
    ...team,
    rank: rank && rank > 0 ? rank : team.rank,
    wins: num(totals.wins) ?? team.wins,
    losses: num(totals.losses) ?? team.losses,
    ties: num(totals.ties) ?? team.ties,
    pointsFor: num(standing.points_for) ?? num(row.points_for) ?? team.pointsFor,
  }
}

function mergeYahooStandings(teams: FantasyTeam[], standingsRaw: unknown): FantasyTeam[] {
  if (standingsRaw == null) return teams
  const league = yahooMerge(content(standingsRaw).league)
  const standings = yahooMerge(league.standings)
  const rows = [
    ...yahooResources(standings.teams, 'team'),
    ...yahooResources(league.teams, 'team'),
  ]
  if (rows.length === 0) return teams
  const byId = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const key = text(row.team_key)
    if (!key) continue
    byId.set(teamId(key), row)
  }
  return teams.map((team) => {
    const row = byId.get(team.id)
    return row ? applyYahooStanding(team, row) : team
  })
}

export async function loadYahooLeagueBundles(
  session: string,
  scoringPeriodOverride?: number,
): Promise<LeagueBundle[]> {
  const year = new Date().getFullYear()
  const seasons = `${year - 1},${year}`
  const gamesFilter = `users;use_login=1/games;game_codes=nfl,nba,mlb,nhl;seasons=${seasons}`
  // Yahoo documents users→games→leagues and users→games→teams, not games/leagues/teams.
  // Restrict to sports we map; some games reject /leagues and fail the whole collection.
  // /teams includes co-managed teams that /leagues sometimes omits.
  const [raw, teamsRaw] = await Promise.all([
    yahooGet<unknown>(`${gamesFilter}/leagues`, session),
    yahooGet<unknown>(`${gamesFilter}/teams`, session).catch(() => null),
  ])
  const ownedTeamKeys = collectOwnedYahooTeamKeys(teamsRaw)
  const { jobs, seen } = collectYahooLeagueJobs(raw)
  for (const missing of missingYahooLeaguesFromTeams(teamsRaw, seen)) {
    try {
      const leagueRaw = await yahooGet<unknown>(
        `league/${encodeURIComponent(missing.leagueKey)}`,
        session,
      )
      jobs.push({
        sport: missing.sport,
        season: missing.season,
        league: yahooMerge(content(leagueRaw).league),
      })
    } catch {
      // Skip co-managed leagues Yahoo will not return.
    }
  }

  const bundles: LeagueBundle[] = []
  const catalogBySport = new Map<Sport, Awaited<ReturnType<typeof loadSleeperPlayers>>>()

  for (const job of jobs) {
    const { sport, season, league } = job
    const key = text(league.league_key)
    if (!key) continue
    if (sport === 'nfl' && !catalogBySport.has('nfl')) {
      catalogBySport.set('nfl', await loadSleeperPlayers('nfl'))
    }
    const catalog = catalogBySport.get(sport) ?? {}
    const byYahooId = buildYahooIdIndex(catalog)

    const nativeWeek = num(league.current_week) ?? num(league.start_week) ?? 1
    const scoringPeriod =
      scoringPeriodOverride && scoringPeriodOverride > 0 ? scoringPeriodOverride : nativeWeek
    const id = leagueId(key)
    const mappedLeague: FantasyLeague = {
      id,
      provider: 'yahoo',
      name: text(league.name) || 'Yahoo league',
      sport,
      season,
      scoringPeriod,
      teamCount: num(league.num_teams) ?? 0,
      scoring: {},
    }

    const nestedTeams = yahooResources(league.teams, 'team')
    const teamRows =
      nestedTeams.length > 0
        ? nestedTeams
        : yahooResources(
            yahooMerge(
              content(await yahooGet<unknown>(`league/${encodeURIComponent(key)}/teams`, session)).league,
            ).teams,
            'team',
          )
    mappedLeague.teamCount = mappedLeague.teamCount || teamRows.length

    const teams: FantasyTeam[] = []
    const ownedTeamIds: string[] = []
    for (const team of teamRows) {
      const teamKey = text(team.team_key)
      if (!teamKey) continue
      const idForTeam = teamId(teamKey)
      teams.push({
        id: idForTeam,
        leagueId: id,
        name: text(team.name) || `Team ${text(team.team_id)}`,
        ownerName: managerNames(team),
        logoUrl: logoFromTeam(team),
      })
      if (isOwnedTeam(team, ownedTeamKeys)) ownedTeamIds.push(idForTeam)
    }
    if (ownedTeamIds.length === 0 && teams.length === 1) ownedTeamIds.push(teams[0].id)

      const [scoreboardRaw, standingsRaw] = await Promise.all([
        yahooGet<unknown>(
          `league/${encodeURIComponent(key)}/scoreboard;week=${scoringPeriod}`,
          session,
        ),
        yahooGet<unknown>(`league/${encodeURIComponent(key)}/standings`, session).catch(() => null),
      ])
      const scoreboardLeague = yahooMerge(content(scoreboardRaw).league)
      const scoreboard = yahooMerge(scoreboardLeague.scoreboard)
      const matchupRows = yahooResources(scoreboard.matchups, 'matchup')
      const matchups: FantasyMatchup[] = []
      const seen = new Set<string>()

      for (const row of matchupRows) {
        const sides = yahooResources(row.teams, 'team')
        const a = sides[0]
        const b = sides[1]
        if (!a) continue
        const aKey = text(a.team_key)
        const bKey = b ? text(b.team_key) : ''
        if (!aKey) continue
        const aId = teamId(aKey)
        const bId = bKey ? teamId(bKey) : ''
        const pair = bId && aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`
        if (seen.has(pair || aId)) continue
        seen.add(pair || aId)
        const aPts = num(yahooMerge(a.team_points).total) ?? 0
        const bPts = b ? (num(yahooMerge(b.team_points).total) ?? 0) : 0
        matchups.push({
          leagueId: id,
          scoringPeriod,
          teamId: aId,
          opponentTeamId: bId,
          points: aPts,
          opponentPoints: bPts,
        })
        if (bId) {
          matchups.push({
            leagueId: id,
            scoringPeriod,
            teamId: bId,
            opponentTeamId: aId,
            points: bPts,
            opponentPoints: aPts,
          })
        }
      }

      const rostersByTeamId = new Map<string, FantasyRosterPlayer[]>()
      for (const team of teams) {
        const rosterRaw = await yahooGet<unknown>(
          `team/${encodeURIComponent(rawTeamKey(team.id))}/roster;week=${scoringPeriod}`,
          session,
        )
        const rosterTeam = yahooMerge(content(rosterRaw).team)
        const roster = yahooMerge(rosterTeam.roster)
        const players = yahooResources(roster.players, 'player')
        const mapped: FantasyRosterPlayer[] = []
        for (const player of players) {
          const selected = yahooMerge(player.selected_position)
          const slot = text(selected.position) || 'BN'
          const yahooPlayerId = text(player.player_id)
          const name = text(player.name) || text(yahooMerge(player.name).full)
          const position = text(player.display_position) || text(player.primary_position) || slot
          const proTeam = text(player.editorial_team_abbr) || text(player.display_team)
          const points = num(yahooMerge(player.player_points).total)
          const canonical =
            sport === 'nfl'
              ? resolveYahooCanonicalId(yahooPlayerId, name, position, proTeam, catalog, byYahooId)
              : yahooPlayerId
          const sleeper: SleeperPlayer | undefined = canonical ? catalog[canonical] : undefined
          mapped.push({
            providerPlayerId: yahooPlayerId || name,
            canonicalPlayerId: canonical || yahooPlayerId,
            fantasyTeamId: team.id,
            leagueId: id,
            name: name || yahooPlayerId,
            position,
            rosterSlot: slot,
            proTeam,
            starter: !benchSlot(slot),
            points,
            injuryStatus: injuryCode(text(player.status) || sleeper?.injury_status),
          })
        }
        rostersByTeamId.set(team.id, mapped)
      }

      bundles.push({
        league: mappedLeague,
        teams: withComputedRanks(mergeYahooStandings(teams, standingsRaw)),
        matchups,
        rostersByTeamId,
        ownedTeamIds,
      })
  }

  if (bundles.length === 0) {
    throw new YahooError('No Yahoo fantasy leagues found for this account.')
  }
  return bundles
}

export async function loadYahooRoster(
  session: string,
  teamKey: string,
  league: FantasyLeague,
): Promise<FantasyRosterPlayer[]> {
  const catalog = league.sport === 'nfl' ? await loadSleeperPlayers('nfl') : {}
  const byYahooId = buildYahooIdIndex(catalog)
  const rosterRaw = await yahooGet<unknown>(
    `team/${encodeURIComponent(rawTeamKey(teamKey))}/roster;week=${league.scoringPeriod}`,
    session,
  )
  const rosterTeam = yahooMerge(content(rosterRaw).team)
  const players = yahooResources(yahooMerge(rosterTeam.roster).players, 'player')
  return players.map((player) => {
    const selected = yahooMerge(player.selected_position)
    const slot = text(selected.position) || 'BN'
    const yahooPlayerId = text(player.player_id)
    const name = text(player.name) || text(yahooMerge(player.name).full)
    const position = text(player.display_position) || text(player.primary_position) || slot
    const proTeam = text(player.editorial_team_abbr)
    const canonical =
      league.sport === 'nfl'
        ? resolveYahooCanonicalId(yahooPlayerId, name, position, proTeam, catalog, byYahooId)
        : yahooPlayerId
    return {
      providerPlayerId: yahooPlayerId || name,
      canonicalPlayerId: canonical || yahooPlayerId,
      fantasyTeamId: teamId(rawTeamKey(teamKey)),
      leagueId: league.id,
      name: name || yahooPlayerId,
      position,
      rosterSlot: slot,
      proTeam,
      starter: !benchSlot(slot),
      points: num(yahooMerge(player.player_points).total),
      injuryStatus: injuryCode(text(player.status)),
    }
  })
}

export function yahooTeamKeyFrom(id: string): string {
  return rawTeamKey(id)
}
