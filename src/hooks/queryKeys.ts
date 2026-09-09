export const queryKeys = {
  dashboard: ['dashboard'] as const,
  team: (teamId: string, week?: number | null) => ['team', teamId, week ?? 'current'] as const,
  nflGames: (week?: number | null) => ['nfl', 'games', week ?? 'current'] as const,
  redditSearch: (query: string, subreddits: string, sort: string) =>
    ['reddit', 'search', query, subreddits, sort] as const,
}
