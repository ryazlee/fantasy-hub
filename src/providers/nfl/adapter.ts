import { espnGet, scoreboardUrl, NflError } from './client'
import type { NFLGame, NFLGameStatus } from './types'

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

export async function getNflScoreboard(): Promise<NFLGame[]> {
  try {
    const data = await espnGet<EspnScoreboard>(scoreboardUrl())
    return (data.events ?? []).flatMap((event) => {
      const competition = event.competitions?.[0]
      if (!event.id || !competition) return []
      const home = competition.competitors?.find((row) => row.homeAway === 'home')
      const away = competition.competitors?.find((row) => row.homeAway === 'away')
      const state = competition.status?.type?.state
      const status = statusFrom(state)
      const homeScore = home?.score != null ? Number(home.score) : undefined
      const awayScore = away?.score != null ? Number(away.score) : undefined
      return [
        {
          id: event.id,
          startTime: event.date ?? '',
          status,
          home: { abbr: home?.team?.abbreviation ?? '', score: Number.isFinite(homeScore) ? homeScore : undefined },
          away: { abbr: away?.team?.abbreviation ?? '', score: Number.isFinite(awayScore) ? awayScore : undefined },
          clockLabel: competition.status?.type?.shortDetail,
        },
      ]
    })
  } catch (error) {
    if (error instanceof NflError) throw error
    throw new NflError('We could not load NFL games.')
  }
}
