import { useQuery } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { loadDashboard, loadTeamDetail } from '../services/fantasy'
import { getNflScoreboard } from '../providers/nfl/adapter'
import { hasAnyProvider, loadConfig } from '../utils/storage'

export function useDashboard() {
  const config = loadConfig()
  const connected = hasAnyProvider(config)

  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: loadDashboard,
    enabled: connected,
    refetchInterval: config.prefs.refresh === 'auto' ? 30_000 : false,
  })
}

export function useTeam(teamId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.team(teamId ?? ''),
    queryFn: () => loadTeamDetail(teamId ?? ''),
    enabled: Boolean(teamId),
  })
}

export function useNflGames(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.nflGames,
    queryFn: getNflScoreboard,
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
}
