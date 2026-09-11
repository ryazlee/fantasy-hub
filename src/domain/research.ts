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

const NAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'])

function lastNameOf(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => !NAME_SUFFIXES.has(part.toLowerCase()))
  const last = parts.at(-1) ?? ''
  // Short names ("Ojo", "Fant") collide with ordinary words too often to match alone.
  return last.length >= 4 ? last : ''
}

function containsWord(haystack: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(haystack)
}

/**
 * Which of the searched players a post actually names. A bare last name only counts
 * when no other pick shares it, since "Harrison" says nothing once two are selected.
 */
export function playerMentions(text: string, players: string[]): string[] {
  if (!text) return []
  const lower = text.toLowerCase()
  const shared = new Set<string>()
  const seen = new Set<string>()
  for (const name of players) {
    const last = lastNameOf(name).toLowerCase()
    if (!last) continue
    if (seen.has(last)) shared.add(last)
    seen.add(last)
  }
  return players.filter((name) => {
    if (lower.includes(name.trim().toLowerCase())) return true
    const last = lastNameOf(name).toLowerCase()
    if (!last || shared.has(last)) return false
    return containsWord(lower, last)
  })
}
