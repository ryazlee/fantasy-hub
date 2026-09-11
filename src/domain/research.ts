/** Subreddits offered on the Research tab. Ids are Reddit slugs. */
export const RESEARCH_SUBREDDITS = [
  { id: 'fantasyfootball', label: 'r/fantasyfootball' },
  { id: 'nfl', label: 'r/nfl' },
  { id: 'dynastyff', label: 'r/DynastyFF' },
  { id: 'fantasy_football', label: 'r/Fantasy_Football' },
  { id: 'ffcommish', label: 'r/FFCommish' },
  { id: 'fantasyfootballers', label: 'r/fantasyfootballers' },
] as const

/** Reddit search can only match so many players before the query stops being useful. */
export const RESEARCH_PLAYER_CAP = 8
