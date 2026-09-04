import type { Sport } from '../../domain/types'
import { EspnError } from './client'

export type EspnConnectFields = {
  leagueId?: string
  season?: number
  sport: Sport
  teamId?: string
  teamUrl?: string
}

export type EspnConnection = {
  leagueId: string
  season: number
  sport: Sport
  teamId?: string
  teamUrl: string
  leagueName?: string
}

const SPORT_FROM_PATH: Record<string, Sport> = {
  football: 'nfl',
  basketball: 'nba',
  baseball: 'mlb',
  hockey: 'nhl',
}

const PATH_FROM_SPORT: Record<Sport, string> = {
  nfl: 'football',
  nba: 'basketball',
  mlb: 'baseball',
  nhl: 'hockey',
}

export function defaultEspnSeason(now = new Date()): number {
  const year = now.getFullYear()
  return now.getMonth() <= 1 ? year - 1 : year
}

function isEspnHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'espn.com' || host.endsWith('.espn.com')
}

function tryUrl(raw: string): URL | null {
  try {
    return new URL(raw)
  } catch {
    try {
      return new URL(`https://${raw}`)
    } catch {
      return null
    }
  }
}

function firstQuery(raw: string, key: string): string | undefined {
  const match = raw.match(new RegExp(`(?:[?&#]|^|,|\\s)${key}=(\\d+)`, 'i'))
  return match?.[1]
}

function sportFromPath(pathname: string): Sport | undefined {
  const parts = pathname.toLowerCase().split('/').filter(Boolean)
  for (const part of parts) {
    const sport = SPORT_FROM_PATH[part]
    if (sport) return sport
  }
  return undefined
}

export function parseEspnConnectInput(raw: string): EspnConnectFields {
  const trimmed = raw.trim()
  const result: EspnConnectFields = { sport: 'nfl' }
  if (!trimmed) return result

  if (/^\d+$/.test(trimmed)) {
    result.leagueId = trimmed
    return result
  }

  const leagueId = firstQuery(trimmed, 'leagueId')
  const seasonId = firstQuery(trimmed, 'seasonId')
  const teamId = firstQuery(trimmed, 'teamId')
  if (leagueId) result.leagueId = leagueId
  if (seasonId) result.season = Number(seasonId)
  if (teamId) result.teamId = teamId

  const url = tryUrl(trimmed)
  if (url && isEspnHost(url.hostname)) {
    result.teamUrl = url.href
    const sport = sportFromPath(url.pathname)
    if (sport) result.sport = sport
    const league = url.searchParams.get('leagueId')
    const season = url.searchParams.get('seasonId')
    const team = url.searchParams.get('teamId')
    if (league && /^\d+$/.test(league)) result.leagueId = league
    if (season && /^\d+$/.test(season)) result.season = Number(season)
    if (team && /^\d+$/.test(team)) result.teamId = team
  }

  return result
}

export function espnPublicUrl(fields: {
  leagueId: string
  season: number
  sport: Sport
  teamId?: string
}): string {
  const path = PATH_FROM_SPORT[fields.sport] ?? 'football'
  const page = fields.teamId ? 'team' : 'league'
  const params = new URLSearchParams({
    leagueId: fields.leagueId,
    seasonId: String(fields.season),
  })
  if (fields.teamId) params.set('teamId', fields.teamId)
  return `https://fantasy.espn.com/${path}/${page}?${params.toString()}`
}

function parseSeason(raw: string | undefined, fallback?: number): number {
  const value = Number((raw ?? '').trim())
  if (Number.isFinite(value) && value >= 1990 && value <= 2100) return Math.trunc(value)
  if (fallback && fallback >= 1990) return fallback
  return defaultEspnSeason()
}

export function completeEspnConnect(
  raw: string,
  seasonRaw = '',
  teamRaw = '',
): EspnConnection {
  const parsed = parseEspnConnectInput(raw)
  if (!parsed.leagueId) {
    throw new EspnError('Enter a public ESPN league URL or league ID.')
  }
  const season = parseSeason(seasonRaw, parsed.season)
  const teamId = teamRaw.trim() || parsed.teamId
  if (teamId && !/^\d+$/.test(teamId)) {
    throw new EspnError('Team ID should be the number from teamId= in your ESPN team URL.')
  }
  return {
    leagueId: parsed.leagueId,
    season,
    sport: parsed.sport,
    teamId: teamId || undefined,
    teamUrl: parsed.teamUrl || espnPublicUrl({
      leagueId: parsed.leagueId,
      season,
      sport: parsed.sport,
      teamId: teamId || undefined,
    }),
  }
}
