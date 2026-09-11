import { espnGet, scoreboardUrl, NflError } from './client'
import { sleeperGet } from '../sleeper/client'
import type { SleeperState } from '../sleeper/types'
import type { NFLGame, NFLGameStatus, NFLPlayerWeekStats } from './types'

type EspnCompetitor = {
  homeAway?: string
  score?: string
  team?: { abbreviation?: string }
}

type EspnEvent = {
  id?: string
  date?: string
  competitions?: Array<{
    competitors?: EspnCompetitor[]
    status?: {
      period?: number
      displayClock?: string
      type?: { state?: string; shortDetail?: string }
    }
  }>
}

type EspnScoreboard = {
  events?: EspnEvent[]
}

function statusFrom(state: string | undefined): NFLGameStatus {
  if (state === 'in') return 'live'
  if (state === 'post') return 'final'
  return 'scheduled'
}

export async function getNflScoreboard(week?: number): Promise<NFLGame[]> {
  try {
    const data = await espnGet<EspnScoreboard>(scoreboardUrl(week))
    return (data.events ?? []).flatMap((event) => {
      const competition = event.competitions?.[0]
      if (!event.id || !competition) return []
      const home = competition.competitors?.find((row) => row.homeAway === 'home')
      const away = competition.competitors?.find((row) => row.homeAway === 'away')
      const state = competition.status?.type?.state
      const status = statusFrom(state)
      const homeScore = home?.score != null ? Number(home.score) : undefined
      const awayScore = away?.score != null ? Number(away.score) : undefined
      const started = status !== 'scheduled'
      return [
        {
          id: event.id,
          startTime: event.date ?? '',
          status,
          home: {
            abbr: home?.team?.abbreviation ?? '',
            score: started && Number.isFinite(homeScore) ? homeScore : undefined,
          },
          away: {
            abbr: away?.team?.abbreviation ?? '',
            score: started && Number.isFinite(awayScore) ? awayScore : undefined,
          },
          clockLabel: competition.status?.type?.shortDetail,
        },
      ]
    })
  } catch (error) {
    if (error instanceof NflError) throw error
    throw new NflError('We could not load NFL games.')
  }
}

function asWeekStats(raw: unknown): Record<string, NFLPlayerWeekStats> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, NFLPlayerWeekStats> = {}
  for (const [id, row] of Object.entries(raw as Record<string, unknown>)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const stats: NFLPlayerWeekStats = {}
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value)) stats[key] = value
    }
    if (Object.keys(stats).length) out[id] = stats
  }
  return out
}

export async function getNflPlayerStats(week?: number): Promise<Record<string, NFLPlayerWeekStats>> {
  try {
    const state = await sleeperGet<SleeperState>('/state/nfl')
    const season = state?.season
    if (!season) return {}
    const current = Number(state.display_week ?? state.week ?? 1)
    const view =
      week && week > 0 ? week : Number.isFinite(current) && current > 0 ? current : 1
    const path =
      view > 18 ? `/stats/nfl/post/${season}/${view - 18}` : `/stats/nfl/regular/${season}/${view}`
    return asWeekStats(await sleeperGet<unknown>(path))
  } catch {
    return {}
  }
}
