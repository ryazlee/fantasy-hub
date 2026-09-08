import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import { useSavedConfig } from '../../hooks/useSavedConfig'
import { queryKeys } from '../../hooks/queryKeys'
import {
  playerSearchQuery,
  redditConfigured,
  searchRedditPosts,
  type RedditPost,
} from '../../providers/reddit/client'
import {
  loadResearchFilters,
  saveResearchFilters,
  type ResearchSort,
} from '../../utils/storage'
import type { DashboardContext } from './context'

const SUBREDDITS = [
  { id: 'fantasyfootball', label: 'r/fantasyfootball' },
  { id: 'nfl', label: 'r/nfl' },
  { id: 'dynastyff', label: 'r/DynastyFF' },
  { id: 'fantasy_football', label: 'r/Fantasy_Football' },
  { id: 'ffcommish', label: 'r/FFCommish' },
  { id: 'fantasyfootballers', label: 'r/fantasyfootballers' },
] as const

type Sort = ResearchSort

type RosterOption = {
  name: string
  position: string
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function relativeAge(createdUtc: number): string {
  if (!createdUtc) return ''
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - createdUtc))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function PostCard({ post }: { post: RedditPost }) {
  return (
    <a className="research-post" href={post.permalink} target="_blank" rel="noopener noreferrer">
      <p className="research-post__meta">
        <span>r/{post.subreddit}</span>
        {post.flair ? <span>{post.flair}</span> : null}
        <span>{post.score} pts</span>
        <span>{post.comments} comments</span>
        <span>{relativeAge(post.createdUtc)}</span>
      </p>
      <p className="research-post__title">{post.title}</p>
      {post.selftext ? <p className="research-post__body">{post.selftext}</p> : null}
    </a>
  )
}

export default function ResearchView() {
  const { teams } = useOutletContext<DashboardContext>()
  const showBench = useSavedConfig().prefs.showBench
  const [initial] = useState(loadResearchFilters)
  const [subs, setSubs] = useState<string[]>(initial.subs)
  const [players, setPlayers] = useState<string[]>(initial.players)
  const [sort, setSort] = useState<Sort>(initial.sort)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [playerFilter, setPlayerFilter] = useState('')
  const [submitted, setSubmitted] = useState<{
    query: string
    subreddits: string[]
    sort: Sort
  } | null>(null)

  const rosterOptions = useMemo(() => {
    const byName = new Map<string, RosterOption>()
    for (const team of teams) {
      for (const player of team.roster) {
        if (!showBench && !player.starter) continue
        const name = player.name.trim()
        if (!name) continue
        const key = name.toLowerCase()
        if (byName.has(key)) continue
        byName.set(key, { name, position: player.position.trim() })
      }
    }
    return [...byName.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
  }, [teams, showBench])

  const filteredRoster = useMemo(() => {
    const q = playerFilter.trim().toLowerCase()
    if (!q) return rosterOptions
    return rosterOptions.filter(
      (player) =>
        player.name.toLowerCase().includes(q) || player.position.toLowerCase().includes(q),
    )
  }, [rosterOptions, playerFilter])

  useEffect(() => {
    if (rosterOptions.length === 0) return
    const allowed = new Set(rosterOptions.map((player) => player.name))
    setPlayers((prev) => {
      const next = prev.filter((name) => allowed.has(name))
      return next.length === prev.length ? prev : next
    })
  }, [rosterOptions])

  useEffect(() => {
    saveResearchFilters({ subs, players, sort })
  }, [subs, players, sort])

  useEffect(() => {
    if (!pickerOpen) setPlayerFilter('')
  }, [pickerOpen])

  const query = useQuery({
    queryKey: queryKeys.redditSearch(
      submitted?.query ?? '',
      submitted?.subreddits.join(',') ?? '',
      submitted?.sort ?? '',
    ),
    queryFn: () =>
      searchRedditPosts({
        query: submitted!.query,
        subreddits: submitted!.subreddits,
        sort: submitted!.sort,
      }),
    enabled: Boolean(submitted && redditConfigured()),
    staleTime: 60_000,
  })

  function onSearch() {
    if (subs.length === 0) return
    if (players.length === 0) return
    if (players.length > 8) return
    setSubmitted({
      query: playerSearchQuery(players),
      subreddits: subs,
      sort,
    })
  }

  function togglePlayer(name: string) {
    setPlayers((prev) => {
      if (prev.includes(name)) return prev.filter((item) => item !== name)
      if (prev.length >= 8) return prev
      return [...prev, name]
    })
  }

  if (!redditConfigured()) {
    return (
      <p className="notice">
        Research needs the Fantasy Hub worker URL baked into this build. Use the deployed site or set
        VITE_YAHOO_API_URL locally.
      </p>
    )
  }

  return (
    <section className="stack research">
      <p className="quiet">
        Search uses the Reddit archive (Arctic Shift) — no Reddit app. Pick subreddits and players,
        then search.
      </p>

      <div className="research-filters">
        <div className="research-filters__group">
          <p className="research-filters__label">Subreddits</p>
          <div className="chips research-filters__chips" role="group" aria-label="Subreddits">
            {SUBREDDITS.map((sub) => (
              <button
                key={sub.id}
                type="button"
                className={subs.includes(sub.id) ? 'chip chip--on' : 'chip'}
                aria-pressed={subs.includes(sub.id)}
                onClick={() => setSubs((prev) => toggleValue(prev, sub.id))}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>

        <div className="research-filters__group">
          <p className="research-filters__label">Players ({players.length}/8)</p>
          <div className="chips research-filters__chips" role="group" aria-label="Players">
            <button
              type="button"
              className="chip"
              onClick={() => setPickerOpen(true)}
              disabled={rosterOptions.length === 0}
            >
              {players.length ? 'Edit players' : 'Select players'}
            </button>
            {players.map((name) => (
              <button
                key={name}
                type="button"
                className="chip chip--on"
                onClick={() => togglePlayer(name)}
                aria-label={`Remove ${name}`}
              >
                {name}
                <span className="research-filters__remove" aria-hidden="true">
                  ×
                </span>
              </button>
            ))}
            {players.length ? (
              <button type="button" className="chip" onClick={() => setPlayers([])}>
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="research-filters__group">
          <p className="research-filters__label">Sort</p>
          <div className="chips research-filters__chips" role="group" aria-label="Sort">
            {(['new', 'relevance', 'top', 'hot'] as Sort[]).map((value) => (
              <button
                key={value}
                type="button"
                className={sort === value ? 'chip chip--on' : 'chip'}
                aria-pressed={sort === value}
                onClick={() => setSort(value)}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="research-filters__actions">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={subs.length === 0 || players.length === 0 || query.isFetching}
            onClick={onSearch}
          >
            {query.isFetching ? 'Searching…' : 'Search Reddit'}
          </button>
        </div>
      </div>

      <Modal
        title={`Select players (${players.length}/8)`}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        wide
      >
        <label className="field">
          <span className="field__label">Filter</span>
          <input
            className="input"
            type="search"
            value={playerFilter}
            onChange={(event) => setPlayerFilter(event.target.value)}
            placeholder="Search name or position"
            autoComplete="off"
          />
        </label>

        <div className="research-player-list" role="group" aria-label="Roster players">
          {filteredRoster.length === 0 ? (
            <p className="quiet">No players match that filter.</p>
          ) : (
            filteredRoster.map((player) => {
              const selected = players.includes(player.name)
              const atCap = !selected && players.length >= 8
              return (
                <button
                  key={player.name}
                  type="button"
                  className={
                    selected
                      ? 'research-player-option research-player-option--on'
                      : 'research-player-option'
                  }
                  aria-pressed={selected}
                  disabled={atCap}
                  onClick={() => togglePlayer(player.name)}
                >
                  <span className="research-player-option__name">{player.name}</span>
                  {player.position ? (
                    <span className="research-player-option__pos">{player.position}</span>
                  ) : null}
                </button>
              )
            })
          )}
        </div>

        <div className="modal__actions">
          <button type="button" className="btn btn--primary" onClick={() => setPickerOpen(false)}>
            Done
          </button>
          {players.length ? (
            <button type="button" className="btn btn--ghost" onClick={() => setPlayers([])}>
              Clear selection
            </button>
          ) : null}
        </div>
      </Modal>

      {!submitted ? (
        <p className="notice">Select at least one subreddit and one player, then search.</p>
      ) : null}

      {query.isError ? (
        <p className="notice notice--danger">
          {query.error instanceof Error ? query.error.message : 'Reddit search failed.'}
        </p>
      ) : null}

      {query.data ? (
        query.data.posts.length === 0 ? (
          <p className="notice">No posts matched those players in the selected subs.</p>
        ) : (
          <div className="research-results stack stack--tight">
            <p className="quiet">
              {query.data.posts.length} posts · {query.data.subreddits.map((s) => `r/${s}`).join(', ')}
            </p>
            {query.data.posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )
      ) : null}
    </section>
  )
}
