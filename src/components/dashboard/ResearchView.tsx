import { Fragment, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Modal from '../Modal'
import PlayerPhoto from '../PlayerPhoto'
import { positionTone } from '../../domain/positions'
import { playerMentions, RESEARCH_PLAYER_CAP } from '../../domain/research'
import type { DashboardTeam, FantasyRosterPlayer, Sport } from '../../domain/types'
import { queryKeys } from '../../hooks/queryKeys'
import { useResearchFilters } from '../../hooks/useResearchFilters'
import {
  playerSearchQuery,
  redditConfigured,
  searchRedditPosts,
  type RedditPost,
} from '../../providers/reddit/client'
import { loadResearchFilters, saveResearchFilters, type ResearchSort } from '../../utils/storage'
import type { DashboardContext } from './context'

const PLAYER_CAP = RESEARCH_PLAYER_CAP

type Sort = ResearchSort

type TeamOn = {
  teamId: string
  label: string
  starter: boolean
}

type RosterOption = {
  name: string
  position: string
  sport: Sport
  player: FantasyRosterPlayer
  teams: TeamOn[]
}

type FantasyTeamOption = {
  teamId: string
  label: string
}

function playerMergeKey(player: FantasyRosterPlayer): string {
  const id = player.canonicalPlayerId.trim()
  if (id) return `id:${id}`
  return `fb:${player.name.trim().toLowerCase()}|${player.proTeam.trim().toUpperCase()}|${player.position.trim().toUpperCase()}`
}

function teamDisplayName(team: DashboardTeam, all: DashboardTeam[]): string {
  const clash = all.filter((row) => row.team.name === team.team.name).length > 1
  return clash ? `${team.team.name} (${team.league.name})` : team.team.name
}

function collectRoster(teams: DashboardTeam[]): RosterOption[] {
  const buckets = new Map<string, RosterOption>()
  for (const team of teams) {
    const label = teamDisplayName(team, teams)
    for (const player of team.roster) {
      const name = player.name.trim()
      if (!name) continue
      const key = playerMergeKey(player)
      const existing = buckets.get(key)
      const on: TeamOn = { teamId: team.team.id, label, starter: player.starter }
      if (existing) {
        if (!existing.teams.some((row) => row.teamId === on.teamId)) existing.teams.push(on)
        if (player.starter && !existing.player.starter) existing.player = player
        continue
      }
      buckets.set(key, {
        name,
        position: player.position.trim(),
        sport: team.league.sport,
        player,
        teams: [on],
      })
    }
  }
  return [...buckets.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
}

function teamPlayers(options: RosterOption[], teamId: string): RosterOption[] {
  return options
    .filter((player) => player.teams.some((team) => team.teamId === teamId))
    .sort(
      (a, b) =>
        Number(b.teams.some((team) => team.teamId === teamId && team.starter)) -
          Number(a.teams.some((team) => team.teamId === teamId && team.starter)) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    )
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

const TAG_CAP = 3

function PostCard({ post, players }: { post: RedditPost; players: string[] }) {
  // The worker reports what the archive matched, but a throttled per-player call drops names,
  // so union it with what the excerpt shows and keep the order the player chips are in.
  const matched = new Set([
    ...(post.mentions ?? []),
    ...playerMentions(`${post.title} ${post.selftext ?? ''}`, players),
  ])
  const mentions = players.filter((name) => matched.has(name))
  const shown = mentions.slice(0, TAG_CAP)
  return (
    <a className="research-post" href={post.permalink} target="_blank" rel="noopener noreferrer">
      <p className="research-post__meta">
        {shown.map((name) => (
          <span key={name} className="research-post__tag">
            {name}
          </span>
        ))}
        {mentions.length > shown.length ? (
          <span className="research-post__tag">+{mentions.length - shown.length}</span>
        ) : null}
        <span>r/{post.subreddit}</span>
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
  const { subs, players, sort } = useResearchFilters()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [playerFilter, setPlayerFilter] = useState('')
  const [submitted, setSubmitted] = useState<{
    query: string
    players: string[]
    subreddits: string[]
    sort: Sort
  } | null>(null)

  const rosterOptions = useMemo(() => collectRoster(teams), [teams])
  const fantasyTeams = useMemo<FantasyTeamOption[]>(
    () => teams.map((team) => ({ teamId: team.team.id, label: teamDisplayName(team, teams) })),
    [teams],
  )

  const filteredRoster = useMemo(() => {
    const q = playerFilter.trim().toLowerCase()
    if (!q) return rosterOptions
    return rosterOptions.filter(
      (player) =>
        player.name.toLowerCase().includes(q) ||
        player.position.toLowerCase().includes(q) ||
        player.teams.some((team) => team.label.toLowerCase().includes(q)),
    )
  }, [rosterOptions, playerFilter])

  useEffect(() => {
    if (rosterOptions.length === 0) return
    const allowed = new Set(rosterOptions.map((player) => player.name))
    const next = players.filter((name) => allowed.has(name))
    if (next.length !== players.length) saveResearchFilters({ players: next })
  }, [rosterOptions, players])

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
    if (players.length > PLAYER_CAP) return
    setSubmitted({
      query: playerSearchQuery(players),
      players,
      subreddits: subs,
      sort,
    })
  }

  function setPlayers(next: string[]) {
    saveResearchFilters({ players: next })
  }

  /** Merges against the stored list so back-to-back picks in one render can't drop each other. */
  function updatePlayers(next: (current: string[]) => string[]) {
    saveResearchFilters({ players: next(loadResearchFilters().players) })
  }

  function togglePlayer(name: string) {
    updatePlayers((current) => {
      if (current.includes(name)) return current.filter((item) => item !== name)
      if (current.length >= PLAYER_CAP) return current
      return [...current, name]
    })
  }

  function toggleTeam(teamId: string) {
    const pick = teamPlayers(rosterOptions, teamId)
      .slice(0, PLAYER_CAP)
      .map((player) => player.name)
    if (pick.length === 0) return
    setPlayers(teamChipOn(teamId) ? [] : pick)
  }

  function teamChipOn(teamId: string): boolean {
    const pick = teamPlayers(rosterOptions, teamId)
      .slice(0, PLAYER_CAP)
      .map((player) => player.name)
    if (pick.length === 0) return false
    return pick.every((name) => players.includes(name)) && players.every((name) => pick.includes(name))
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
      <div className="research-filters">
        <div className="research-filters__bar">
          <button
            type="button"
            className="chip"
            onClick={() => setPickerOpen(true)}
            disabled={rosterOptions.length === 0}
          >
            {players.length ? `Players (${players.length}/${PLAYER_CAP})` : 'Select players'}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={subs.length === 0 || players.length === 0 || query.isFetching}
            onClick={onSearch}
          >
            {query.isFetching ? 'Searching…' : 'Search Reddit'}
          </button>
          {subs.length === 0 ? (
            <span className="quiet">Pick a subreddit in the ⋯ menu.</span>
          ) : null}
        </div>

        {players.length ? (
          <div className="chips research-filters__chips" role="group" aria-label="Selected players">
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
            <button type="button" className="chip" onClick={() => setPlayers([])}>
              Clear
            </button>
          </div>
        ) : null}
      </div>

      <Modal
        title={`Select players (${players.length}/${PLAYER_CAP})`}
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
            placeholder="Search name, position, or team"
            autoComplete="off"
          />
        </label>

        {fantasyTeams.length > 0 ? (
          <div className="research-player-teams">
            <p className="research-filters__label">Select a fantasy team</p>
            <div className="chips research-filters__chips" role="group" aria-label="Fantasy teams">
              {fantasyTeams.map((team) => (
                <button
                  key={team.teamId}
                  type="button"
                  className={teamChipOn(team.teamId) ? 'chip chip--on' : 'chip'}
                  aria-pressed={teamChipOn(team.teamId)}
                  title={`Select players on ${team.label}`}
                  onClick={() => toggleTeam(team.teamId)}
                >
                  {team.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="research-player-list" role="group" aria-label="Roster players">
          {filteredRoster.length === 0 ? (
            <p className="quiet">No players match that filter.</p>
          ) : (
            filteredRoster.map((option) => {
              const selected = players.includes(option.name)
              const atCap = !selected && players.length >= PLAYER_CAP
              const allBench = option.teams.every((team) => !team.starter)
              const tone = positionTone(option.position)
              return (
                <button
                  key={playerMergeKey(option.player)}
                  type="button"
                  className={
                    selected
                      ? 'research-player-option research-player-option--on'
                      : 'research-player-option'
                  }
                  aria-pressed={selected}
                  disabled={atCap}
                  onClick={() => togglePlayer(option.name)}
                >
                  <span className="research-player-option__who">
                    <PlayerPhoto player={option.player} sport={option.sport} size={32} />
                    <span className="research-player-option__text">
                      <span className="research-player-option__identity">
                        <span className="research-player-option__name">{option.name}</span>
                        {allBench ? (
                          <span className="roster-flag roster-flag--bench" title="Bench">
                            B
                          </span>
                        ) : null}
                      </span>
                      <span className="research-player-option__meta">
                        {option.position ? (
                          <span className={['pos-label', tone].filter(Boolean).join(' ')}>
                            {option.position}
                          </span>
                        ) : null}
                        {option.teams.map((team, index) => (
                          <Fragment key={team.teamId}>
                            {option.position || index > 0 ? ' · ' : null}
                            {team.label}
                            {!team.starter && !allBench ? (
                              <span className="roster-flag roster-flag--bench" title="Bench">
                                B
                              </span>
                            ) : null}
                          </Fragment>
                        ))}
                      </span>
                    </span>
                  </span>
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
              <PostCard key={post.id} post={post} players={submitted?.players ?? []} />
            ))}
          </div>
        )
      ) : null}
    </section>
  )
}
