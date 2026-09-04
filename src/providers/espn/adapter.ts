import { z } from 'zod'
import type {
  FantasyLeague,
  FantasyMatchup,
  FantasyRosterPlayer,
  FantasyTeam,
  Sport,
} from '../../domain/types'
import { injuryCode } from '../../domain/injury'
import type { EspnConnection } from './parse'
import { loadSleeperPlayers } from '../sleeper/adapter'
import { EspnError, espnFantasyGet, espnLeagueUrl } from './client'
import { buildEspnIdIndex, resolveEspnCanonicalId } from './mapPlayer'
import { espnNflTeamAbbr } from './proTeams'
import { espnPositionName, espnSlotIsStarter, espnSlotName } from './slots'
import type { EspnLeague, EspnMatchupSide, EspnRosterEntry, EspnStat } from './types'

const CONNECT_VIEWS = ['mSettings', 'mTeam']
const BUNDLE_VIEWS = ['mTeam', 'mRoster', 'mMatchup', 'mSettings', 'mScoreboard']

const EspnLeagueSchema = z.object({
  id: z.number().optional(),
  seasonId: z.number().optional(),
  scoringPeriodId: z.number().optional(),
  members: z
    .array(
      z.object({
        id: z.string().optional(),
        displayName: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
      }),
    )
    .optional(),
  teams: z
    .array(
      z.object({
        id: z.number().optional(),
        abbrev: z.string().optional(),
        name: z.string().optional(),
        location: z.string().optional(),
        nickname: z.string().optional(),
        logo: z.string().optional(),
        primaryOwner: z.string().optional(),
        roster: z
          .object({
            entries: z
              .array(
                z.object({
                  playerId: z.number().optional(),
                  lineupSlotId: z.number().optional(),
                  playerPoolEntry: z
                    .object({
                      playerId: z.number().optional(),
                      appliedStatTotal: z.number().optional(),
                      player: z
                        .object({
                          id: z.number().optional(),
                          fullName: z.string().optional(),
                          defaultPositionId: z.number().optional(),
                          proTeamId: z.number().optional(),
                          injuryStatus: z.string().optional(),
                          stats: z
                            .array(
                              z.object({
                                scoringPeriodId: z.number().optional(),
                                seasonId: z.number().optional(),
                                statSourceId: z.number().optional(),
                                statSplitTypeId: z.number().optional(),
                                appliedTotal: z.number().optional(),
                              }),
                            )
                            .optional(),
                        })
                        .optional(),
                    })
                    .optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  schedule: z
    .array(
      z.object({
        id: z.number().optional(),
        matchupPeriodId: z.number().optional(),
        home: z
          .object({
            teamId: z.number().optional(),
            totalPoints: z.number().optional(),
            totalPointsLive: z.number().optional(),
            totalProjectedPointsLive: z.number().optional(),
          })
          .optional(),
        away: z
          .object({
            teamId: z.number().optional(),
            totalPoints: z.number().optional(),
            totalPointsLive: z.number().optional(),
            totalProjectedPointsLive: z.number().optional(),
          })
          .optional(),
      }),
    )
    .optional(),
  settings: z
    .object({
      name: z.string().optional(),
      size: z.number().optional(),
      isPublic: z.boolean().optional(),
      scoringSettings: z
        .object({
          scoringItems: z
            .array(
              z.object({
                statId: z.number().optional(),
                points: z.number().optional(),
              }),
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
  status: z
    .object({
      currentMatchupPeriod: z.number().optional(),
      latestScoringPeriod: z.number().optional(),
      firstScoringPeriod: z.number().optional(),
    })
    .optional(),
})

function leagueKey(leagueId: string, season: number): string {
  return `espn:${leagueId}:${season}`
}

function teamKey(leagueId: string, season: number, teamId: number): string {
  return `espn:${leagueId}:${season}:${teamId}`
}

function ownerName(
  ownerId: string | undefined,
  members: Map<string, { displayName?: string; firstName?: string; lastName?: string }>,
): string | undefined {
  if (!ownerId) return undefined
  const member = members.get(ownerId)
  if (!member) return undefined
  const combined = [member.firstName, member.lastName].filter(Boolean).join(' ').trim()
  return member.displayName || combined || undefined
}

function teamName(team: {
  name?: string
  location?: string
  nickname?: string
  abbrev?: string
  id?: number
}): string {
  const combined = [team.location, team.nickname].filter(Boolean).join(' ').trim()
  return team.name || combined || team.abbrev || `Team ${team.id ?? ''}`
}

function scoringFrom(raw: EspnLeague): Record<string, number> {
  const items = raw.settings?.scoringSettings?.scoringItems ?? []
  const scoring: Record<string, number> = {}
  for (const item of items) {
    if (item.statId == null || item.points == null) continue
    scoring[`stat${item.statId}`] = item.points
  }
  return scoring
}

function scoringPeriodOf(raw: EspnLeague): number {
  const current = raw.status?.currentMatchupPeriod
  const latest = raw.status?.latestScoringPeriod
  const reported = raw.scoringPeriodId
  if (reported && reported > 0) return reported
  if (latest && latest > 0) return latest
  if (current && current > 0) return current
  return 1
}

function weekPoints(stats: EspnStat[] | undefined, scoringPeriod: number, source: 0 | 1): number | undefined {
  if (!stats?.length) return undefined
  const exact = stats.find(
    (row) =>
      row.scoringPeriodId === scoringPeriod &&
      row.statSourceId === source &&
      (row.statSplitTypeId === 1 || row.statSplitTypeId == null),
  )
  if (exact?.appliedTotal != null) return exact.appliedTotal
  const loose = stats.find((row) => row.scoringPeriodId === scoringPeriod && row.statSourceId === source)
  return loose?.appliedTotal
}

function sidePoints(side: EspnMatchupSide | undefined): { points: number; projected?: number } {
  if (!side) return { points: 0 }
  const live = side.totalPointsLive
  const total = side.totalPoints
  const points = live != null && live > 0 ? live : (total ?? 0)
  const projected = side.totalProjectedPointsLive
  return { points, projected }
}

async function readLeague(
  sport: Sport,
  season: number,
  leagueId: string,
  views: string[],
): Promise<EspnLeague> {
  const raw = await espnFantasyGet<unknown>(espnLeagueUrl(sport, season, leagueId, views))
  const parsed = EspnLeagueSchema.safeParse(raw)
  if (!parsed.success) {
    throw new EspnError('We could not read that ESPN league.')
  }
  return parsed.data
}

export async function lookupEspnLeague(input: {
  leagueId: string
  season: number
  sport: Sport
  teamId?: string
  teamUrl: string
}): Promise<EspnConnection> {
  const raw = await readLeague(input.sport, input.season, input.leagueId, CONNECT_VIEWS)
  const name = raw.settings?.name?.trim() || `ESPN league ${input.leagueId}`
  if (input.teamId) {
    const numeric = Number(input.teamId)
    const exists = (raw.teams ?? []).some((team) => team.id === numeric)
    if (!exists) {
      throw new EspnError('That team ID is not in this ESPN league.')
    }
  }
  return {
    leagueId: input.leagueId,
    season: raw.seasonId ?? input.season,
    sport: input.sport,
    teamId: input.teamId,
    teamUrl: input.teamUrl,
    leagueName: name,
  }
}

function teamLogo(logo: string | undefined): string | undefined {
  const value = logo?.trim()
  if (!value) return undefined
  if (value.startsWith('http')) return value
  if (value.startsWith('//')) return `https:${value}`
  return undefined
}

function mapLeague(raw: EspnLeague, conn: EspnConnection, scoringPeriod: number): FantasyLeague {
  return {
    id: leagueKey(conn.leagueId, conn.season),
    provider: 'espn',
    name: raw.settings?.name?.trim() || conn.leagueName || `ESPN league ${conn.leagueId}`,
    sport: conn.sport,
    season: raw.seasonId ?? conn.season,
    scoringPeriod,
    teamCount: raw.settings?.size ?? raw.teams?.length ?? 0,
    scoring: scoringFrom(raw),
  }
}

function mapRosterEntry(
  entry: EspnRosterEntry,
  fantasyTeamId: string,
  leagueId: string,
  scoringPeriod: number,
  catalog: Awaited<ReturnType<typeof loadSleeperPlayers>>,
  byEspnId: Map<string, string>,
): FantasyRosterPlayer | null {
  const playerId = entry.playerId ?? entry.playerPoolEntry?.playerId ?? entry.playerPoolEntry?.player?.id
  if (playerId == null) return null
  const player = entry.playerPoolEntry?.player
  const name = player?.fullName?.trim() || String(playerId)
  const position = espnPositionName(player?.defaultPositionId)
  const proTeam = espnNflTeamAbbr(player?.proTeamId)
  const canonicalPlayerId = resolveEspnCanonicalId(
    playerId,
    name,
    position,
    proTeam,
    catalog,
    byEspnId,
  )
  const slot = espnSlotName(entry.lineupSlotId)
  return {
    providerPlayerId: String(playerId),
    canonicalPlayerId,
    fantasyTeamId,
    leagueId,
    name,
    position: position || slot,
    rosterSlot: slot,
    proTeam,
    starter: espnSlotIsStarter(entry.lineupSlotId),
    points: weekPoints(player?.stats, scoringPeriod, 0),
    projectedPoints: weekPoints(player?.stats, scoringPeriod, 1),
    injuryStatus:
      injuryCode(player?.injuryStatus) ?? injuryCode(catalog[canonicalPlayerId]?.injury_status),
  }
}

export async function loadEspnLeagueBundle(conn: EspnConnection): Promise<{
  league: FantasyLeague
  teams: FantasyTeam[]
  matchups: FantasyMatchup[]
  rostersByTeamId: Map<string, FantasyRosterPlayer[]>
  ownedTeamIds: string[]
}> {
  const raw = await readLeague(conn.sport, conn.season, conn.leagueId, BUNDLE_VIEWS)
  const scoringPeriod = scoringPeriodOf(raw)
  const league = mapLeague(raw, conn, scoringPeriod)
  const catalog = await loadSleeperPlayers(conn.sport)
  const byEspnId = buildEspnIdIndex(catalog)
  const members = new Map((raw.members ?? []).map((member) => [member.id ?? '', member]))
  const leagueId = league.id

  const teams: FantasyTeam[] = []
  const rostersByTeamId = new Map<string, FantasyRosterPlayer[]>()
  const ownedTeamIds: string[] = []
  const ownedRaw = conn.teamId ? Number(conn.teamId) : undefined

  for (const team of raw.teams ?? []) {
    if (team.id == null) continue
    const id = teamKey(conn.leagueId, conn.season, team.id)
    teams.push({
      id,
      leagueId,
      name: teamName(team),
      ownerName: ownerName(team.primaryOwner, members),
      logoUrl: teamLogo(team.logo),
    })
    if (ownedRaw == null || team.id === ownedRaw) ownedTeamIds.push(id)

    const mapped: FantasyRosterPlayer[] = []
    for (const entry of team.roster?.entries ?? []) {
      const row = mapRosterEntry(entry, id, leagueId, scoringPeriod, catalog, byEspnId)
      if (row) mapped.push(row)
    }
    rostersByTeamId.set(id, mapped)
  }

  const mappedMatchups: FantasyMatchup[] = []
  for (const row of raw.schedule ?? []) {
    if (row.matchupPeriodId !== scoringPeriod) continue
    const homeId = row.home?.teamId
    const awayId = row.away?.teamId
    if (homeId == null) continue
    const homeTeamId = teamKey(conn.leagueId, conn.season, homeId)
    const home = sidePoints(row.home)
    if (awayId == null) {
      mappedMatchups.push({
        leagueId,
        scoringPeriod,
        teamId: homeTeamId,
        opponentTeamId: '',
        points: home.points,
        opponentPoints: 0,
        projectedPoints: home.projected,
      })
      continue
    }
    const awayTeamId = teamKey(conn.leagueId, conn.season, awayId)
    const away = sidePoints(row.away)
    mappedMatchups.push({
      leagueId,
      scoringPeriod,
      teamId: homeTeamId,
      opponentTeamId: awayTeamId,
      points: home.points,
      opponentPoints: away.points,
      projectedPoints: home.projected,
      opponentProjectedPoints: away.projected,
    })
    mappedMatchups.push({
      leagueId,
      scoringPeriod,
      teamId: awayTeamId,
      opponentTeamId: homeTeamId,
      points: away.points,
      opponentPoints: home.points,
      projectedPoints: away.projected,
      opponentProjectedPoints: home.projected,
    })
  }

  const matched = new Set(mappedMatchups.map((row) => row.teamId))
  for (const team of teams) {
    if (matched.has(team.id)) continue
    mappedMatchups.push({
      leagueId,
      scoringPeriod,
      teamId: team.id,
      opponentTeamId: '',
      points: 0,
      opponentPoints: 0,
    })
  }

  return { league, teams, matchups: mappedMatchups, rostersByTeamId, ownedTeamIds }
}
