export const queryKeys = {
  dashboard: ['dashboard'] as const,
  team: (teamId: string, week?: number | null) => ['team', teamId, week ?? 'current'] as const,
  matchup: (teamId: string, opponentId: string, week?: number | null) =>
    ['matchup', teamId, opponentId, week ?? 'current'] as const,
  nflGames: (week?: number | null) => ['nfl', 'games', week ?? 'current'] as const,
  nflPlayerStats: (week?: number | null) => ['nfl', 'playerStats', week ?? 'current'] as const,
  redditSearch: (query: string, subreddits: string, sort: string) =>
    ['reddit', 'search', query, subreddits, sort] as const,
}
