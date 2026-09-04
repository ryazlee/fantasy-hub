import type {
  FantasyLeague,
  FantasyMatchup,
  FantasyRosterPlayer,
  FantasyTeam,
  Sport,
} from '../../domain/types'
import { injuryCode } from '../../domain/injury'
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

export async function loadYahooLeagueBundles(session: string): Promise<LeagueBundle[]> {
  const year = new Date().getFullYear()
  const seasons = `${year - 1},${year}`
  const raw = await yahooGet<unknown>(
    `users;use_login=1/games;seasons=${seasons}/leagues/teams`,
    session,
  )
  const users = yahooResources(content(raw).users, 'user')
  const user = users[0] ?? {}
  const games = yahooResources(user.games, 'game')
  const bundles: LeagueBundle[] = []

  for (const game of games) {
    const sport = sportFromCode(text(game.code) || text(game.name).toLowerCase())
    if (!sport) continue
    const season = num(game.season) ?? year
    const leagues = yahooResources(game.leagues, 'league')
    const catalog = sport === 'nfl' ? await loadSleeperPlayers('nfl') : {}
    const byYahooId = buildYahooIdIndex(catalog)

    for (const league of leagues) {
      const key = text(league.league_key)
      if (!key) continue
      const scoringPeriod = num(league.current_week) ?? num(league.start_week) ?? 1
      const id = leagueId(key)
      const mappedLeague: FantasyLeague = {
        id,
        provider: 'yahoo',
        name: text(league.name) || 'Yahoo league',
        sport,
        season,
        scoringPeriod,
        teamCount: num(league.num_teams) ?? yahooResources(league.teams, 'team').length,
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

      const teams: FantasyTeam[] = []
      const ownedTeamIds: string[] = []
      for (const team of teamRows) {
        const teamKey = text(team.team_key)
        if (!teamKey) continue
        const idForTeam = teamId(teamKey)
        const managers = yahooResources(team.managers, 'manager')
        teams.push({
          id: idForTeam,
          leagueId: id,
          name: text(team.name) || `Team ${text(team.team_id)}`,
          ownerName: text(managers[0]?.nickname) || text(managers[0]?.guid) || undefined,
          logoUrl: logoFromTeam(team),
        })
        if (num(team.is_owned) === 1 || text(team.is_owned) === '1') ownedTeamIds.push(idForTeam)
      }
      if (ownedTeamIds.length === 0 && teams.length === 1) ownedTeamIds.push(teams[0].id)

      const scoreboardRaw = await yahooGet<unknown>(
        `league/${encodeURIComponent(key)}/scoreboard;week=${scoringPeriod}`,
        session,
      )
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
        const rosterRaw = await yahooGet<unknown>(`team/${encodeURIComponent(rawTeamKey(team.id))}/roster`, session)
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

      bundles.push({ league: mappedLeague, teams, matchups, rostersByTeamId, ownedTeamIds })
    }
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
  const rosterRaw = await yahooGet<unknown>(`team/${encodeURIComponent(rawTeamKey(teamKey))}/roster`, session)
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
