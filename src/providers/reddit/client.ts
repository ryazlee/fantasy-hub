const BASE = (import.meta.env.VITE_YAHOO_API_URL ?? '').replace(/\/$/, '')

export type RedditPost = {
  id: string
  title: string
  subreddit: string
  author: string
  score: number
  comments: number
  createdUtc: number
  permalink: string
  flair?: string
  selftext?: string
}

export type RedditSearchResult = {
  posts: RedditPost[]
  subreddits: string[]
  query: string
  sort: string
}

export class RedditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RedditError'
  }
}

export function redditConfigured(): boolean {
  return Boolean(BASE)
}

export async function searchRedditPosts(opts: {
  query: string
  subreddits: string[]
  sort?: string
  limit?: number
}): Promise<RedditSearchResult> {
  if (!BASE) {
    throw new RedditError('Research needs the Fantasy Hub worker URL (VITE_YAHOO_API_URL).')
  }
  const params = new URLSearchParams({
    q: opts.query,
    subreddits: opts.subreddits.join(','),
    sort: opts.sort ?? 'new',
    limit: String(opts.limit ?? 20),
  })
  let res: Response
  try {
    res = await fetch(`${BASE}/reddit/search?${params}`)
  } catch {
    throw new RedditError('We could not reach Reddit research. Try again in a moment.')
  }
  let body: { error?: string; posts?: RedditPost[]; subreddits?: string[]; query?: string; sort?: string } =
    {}
  try {
    body = (await res.json()) as typeof body
  } catch {
    body = {}
  }
  if (!res.ok) {
    throw new RedditError(body.error || 'Reddit search failed.')
  }
  return {
    posts: body.posts ?? [],
    subreddits: body.subreddits ?? opts.subreddits,
    query: body.query ?? opts.query,
    sort: body.sort ?? opts.sort ?? 'new',
  }
}

/** Build an OR query of quoted player names (Reddit search). */
export function playerSearchQuery(names: string[]): string {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  return unique.map((name) => `"${name.replace(/"/g, '')}"`).join(' OR ')
}
