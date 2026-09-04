export const queryKeys = {
  dashboard: ['dashboard'] as const,
  team: (teamId: string) => ['team', teamId] as const,
  nflGames: ['nfl', 'games'] as const,
}
