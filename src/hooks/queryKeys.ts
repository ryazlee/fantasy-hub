export const queryKeys = {
  dashboard: ['dashboard'] as const,
  team: (teamId: string) => ['team', teamId] as const,
  nflGames: ['nfl', 'games'] as const,
  redditSearch: (query: string, subreddits: string, sort: string) =>
    ['reddit', 'search', query, subreddits, sort] as const,
}
