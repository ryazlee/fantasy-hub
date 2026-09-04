import { z } from 'zod'
import type {
  FantasyLeague,
  FantasyMatchup,
  FantasyRosterPlayer,
  FantasyTeam,
  Sport,
} from '../../domain/types'
import { injuryCode } from '../../domain/injury'
import { sleeperAvatarUrl } from '../../domain/media'
import { sleeperGet, SleeperError } from './client'
import type {
  SleeperLeague,
  SleeperLeagueUser,
  SleeperMatchup,
  SleeperPlayer,
  SleeperRoster,
  SleeperState,
  SleeperUser,
} from './types'

const SPORTS: Sport[] = ['nfl', 'nba', 'mlb', 'nhl']

const playerCache = new Map<Sport, Record<string, SleeperPlayer>>()
const slotCache = new Map<string, string[]>()

function leagueId(raw: string): string {
  return `sleeper:${raw}`
}

function teamId(rawLeagueId: string, rosterId: number): string {
  return `sleeper:${rawLeagueId}:${rosterId}`
}

function parseSport(value: string | undefined): Sport | null {
  if (value === 'nfl' || value === 'nba' || value === 'mlb' || value === 'nhl') {
    return value
  }
  return null
}

function playerName(player: SleeperPlayer | undefined, id: string): string {
  if (!player) return id
  if (player.full_name) return player.full_name
  const combined = [player.first_name, player.last_name].filter(Boolean).join(' ')
  return combined || id
}

const SleeperUserSchema = z.object({
  user_id: z.string(),
  username: z.string().optional(),
  display_name: z.string().optional(),
  avatar: z.string().optional(),
})

export async function lookupSleeperUser(username: string): Promise<SleeperUser> {
  const trimmed = username.trim()
  if (!trimmed) {
    throw new SleeperError('Enter a Sleeper username.')
  }
  const user = await sleeperGet<unknown>(`/user/${encodeURIComponent(trimmed)}`)
  const parsed = SleeperUserSchema.safeParse(user)
  if (!parsed.success) {
    throw new SleeperError('We could not find that Sleeper username.')
  }
  return { ...parsed.data, username: parsed.data.username ?? trimmed }
}

export async function loadSleeperPlayers(sport: Sport): Promise<Record<string, SleeperPlayer>> {
  const cached = playerCache.get(sport)
  if (cached) return cached
  const catalog = await sleeperGet<Record<string, SleeperPlayer>>(`/players/${sport}`)
  playerCache.set(sport, catalog ?? {})
  return catalog ?? {}
}

async function loadPlayers(sport: Sport): Promise<Record<string, SleeperPlayer>> {
  return loadSleeperPlayers(sport)
}

async function sportState(sport: Sport): Promise<SleeperState | null> {
  try {
    return await sleeperGet<SleeperState>(`/state/${sport}`)
  } catch {
    return null
  }
}

function mapLeague(raw: SleeperLeague, scoringPeriod: number): FantasyLeague | null {
  const sport = parseSport(raw.sport) ?? 'nfl'
  const season = Number(raw.season)
  if (!raw.league_id || Number.isNaN(season)) return null
  const id = leagueId(raw.league_id)
  slotCache.set(id, raw.roster_positions ?? [])
  return {
    id,
    provider: 'sleeper',
    name: raw.name || 'Sleeper league',
    sport,
    season,
    scoringPeriod,
    teamCount: raw.total_rosters ?? 0,
    scoring: raw.scoring_settings ?? {},
  }
}

function teamName(
  roster: SleeperRoster,
  owner: SleeperLeagueUser | undefined,
): { name: string; ownerName?: string; logoUrl?: string } {
  const fromRoster = roster.metadata?.team_name?.trim()
  const fromOwner = owner?.metadata?.team_name?.trim()
  const ownerName = owner?.display_name
  return {
    name: fromRoster || fromOwner || ownerName || `Team ${roster.roster_id}`,
    ownerName,
    logoUrl: sleeperAvatarUrl(owner?.metadata?.avatar || owner?.avatar),
  }
}

export async function loadSleeperLeagues(userId: string): Promise<FantasyLeague[]> {
  const leagues: FantasyLeague[] = []

  await Promise.all(
    SPORTS.map(async (sport) => {
      const state = await sportState(sport)
      const season = state?.season
      if (!season) return
      const week = Number(state.display_week ?? state.week ?? 1)
      const list = await sleeperGet<SleeperLeague[]>(
        `/user/${userId}/leagues/${sport}/${season}`,
      )
      for (const raw of list ?? []) {
        const mapped = mapLeague({ ...raw, sport: raw.sport ?? sport }, week)
        if (mapped) leagues.push(mapped)
      }
    }),
  )

  return leagues
}

export async function loadSleeperLeagueBundle(
  rawLeagueId: string,
  scoringPeriod: number,
  sport: Sport,
  userId: string,
): Promise<{
  teams: FantasyTeam[]
  matchups: FantasyMatchup[]
  rostersByTeamId: Map<string, FantasyRosterPlayer[]>
  ownedTeamIds: string[]
}> {
  const [rosters, users, matchups, players] = await Promise.all([
    sleeperGet<SleeperRoster[]>(`/league/${rawLeagueId}/rosters`),
    sleeperGet<SleeperLeagueUser[]>(`/league/${rawLeagueId}/users`),
    sleeperGet<SleeperMatchup[]>(`/league/${rawLeagueId}/matchups/${scoringPeriod}`),
    loadPlayers(sport),
  ])

  const usersById = new Map((users ?? []).map((user) => [user.user_id, user]))
  const leagueKey = leagueId(rawLeagueId)
  const ownedTeamIds: string[] = []

  const teams: FantasyTeam[] = (rosters ?? []).map((roster) => {
    const owner = roster.owner_id ? usersById.get(roster.owner_id) : undefined
    const names = teamName(roster, owner)
    const id = teamId(rawLeagueId, roster.roster_id)
    if (roster.owner_id === userId) ownedTeamIds.push(id)
    return {
      id,
      leagueId: leagueKey,
      name: names.name,
      ownerName: names.ownerName,
      logoUrl: names.logoUrl,
    }
  })

  const matchupRows = matchups ?? []
  const mappedMatchups: FantasyMatchup[] = []

  const grouped = new Map<number, SleeperMatchup[]>()
  for (const row of matchupRows) {
    if (row.matchup_id == null) continue
    const list = grouped.get(row.matchup_id) ?? []
    list.push(row)
    grouped.set(row.matchup_id, list)
  }

  for (const pair of grouped.values()) {
    if (pair.length < 2) continue
    const [a, b] = pair
    mappedMatchups.push({
      leagueId: leagueKey,
      scoringPeriod,
      teamId: teamId(rawLeagueId, a.roster_id),
      opponentTeamId: teamId(rawLeagueId, b.roster_id),
      points: a.points ?? 0,
      opponentPoints: b.points ?? 0,
    })
    mappedMatchups.push({
      leagueId: leagueKey,
      scoringPeriod,
      teamId: teamId(rawLeagueId, b.roster_id),
      opponentTeamId: teamId(rawLeagueId, a.roster_id),
      points: b.points ?? 0,
      opponentPoints: a.points ?? 0,
    })
  }

  const matched = new Set(mappedMatchups.map((row) => row.teamId))
  for (const row of matchupRows) {
    const id = teamId(rawLeagueId, row.roster_id)
    if (matched.has(id)) continue
    mappedMatchups.push({
      leagueId: leagueKey,
      scoringPeriod,
      teamId: id,
      opponentTeamId: '',
      points: row.points ?? 0,
      opponentPoints: 0,
    })
  }

  let slotNames = slotCache.get(leagueKey)
  if (!slotNames) {
    const leagueMeta = await sleeperGet<SleeperLeague>(`/league/${rawLeagueId}`)
    slotNames = leagueMeta.roster_positions ?? []
    slotCache.set(leagueKey, slotNames)
  }

  const rostersByTeamId = new Map<string, FantasyRosterPlayer[]>()
  for (const roster of rosters ?? []) {
    const id = teamId(rawLeagueId, roster.roster_id)
    const starters = roster.starters ?? []
    const starterSet = new Set(starters)
    const points = matchupRows.find((row) => row.roster_id === roster.roster_id)?.players_points ?? {}
    const mapped: FantasyRosterPlayer[] = []

    starters.forEach((playerId, index) => {
      if (!playerId || playerId === '0') return
      const player = players[playerId]
      mapped.push({
        providerPlayerId: playerId,
        canonicalPlayerId: playerId,
        fantasyTeamId: id,
        leagueId: leagueKey,
        name: playerName(player, playerId),
        position: player?.position ?? '',
        rosterSlot: slotNames[index] ?? 'BN',
        proTeam: player?.team ?? '',
        starter: true,
        points: points[playerId],
        injuryStatus: injuryCode(player?.injury_status),
      })
    })

    for (const playerId of roster.players ?? []) {
      if (!playerId || starterSet.has(playerId)) continue
      const player = players[playerId]
      const slot = (roster.reserve ?? []).includes(playerId)
        ? 'IR'
        : (roster.taxi ?? []).includes(playerId)
          ? 'TAXI'
          : 'BN'
      mapped.push({
        providerPlayerId: playerId,
        canonicalPlayerId: playerId,
        fantasyTeamId: id,
        leagueId: leagueKey,
        name: playerName(player, playerId),
        position: player?.position ?? '',
        rosterSlot: slot,
        proTeam: player?.team ?? '',
        starter: false,
        points: points[playerId],
        injuryStatus: injuryCode(player?.injury_status),
      })
    }

    rostersByTeamId.set(id, mapped)
  }

  return { teams, matchups: mappedMatchups, rostersByTeamId, ownedTeamIds }
}

export function rawLeagueIdFrom(id: string): string {
  return id.replace(/^sleeper:/, '').split(':')[0] ?? id
}
