import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { loadDashboard, loadTeamDetail } from '../services/fantasy'
import { getNflPlayerStats, getNflScoreboard } from '../providers/nfl/adapter'
import { hasAnyProvider } from '../utils/storage'
import { useSavedConfig } from './useSavedConfig'

export function useDashboard() {
  const config = useSavedConfig()
  const connected = hasAnyProvider(config)
  const week = config.prefs.scoringWeek

  return useQuery({
    queryKey: [...queryKeys.dashboard, week],
    queryFn: () => loadDashboard(week),
    enabled: connected,
    refetchInterval: config.prefs.refresh === 'auto' ? 30_000 : false,
  })
}

export function useTeam(teamId: string | undefined) {
  const week = useSavedConfig().prefs.scoringWeek
  return useQuery({
    queryKey: queryKeys.team(teamId ?? '', week),
    queryFn: () => loadTeamDetail(teamId ?? '', week),
    enabled: Boolean(teamId),
  })
}

export function useNflGames(enabled: boolean, week?: number | null) {
  return useQuery({
    queryKey: queryKeys.nflGames(week),
    queryFn: () => getNflScoreboard(week ?? undefined),
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}

export function useNflPlayerStats(enabled: boolean, week?: number | null) {
  return useQuery({
    queryKey: queryKeys.nflPlayerStats(week),
    queryFn: () => getNflPlayerStats(week ?? undefined),
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
