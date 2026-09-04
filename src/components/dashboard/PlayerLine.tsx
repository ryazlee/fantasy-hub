import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { injuryFlagClass, injuryTitle } from '../../domain/injury'
import { formatPoints } from '../../domain/sportDisplay'
import { gameForProTeam, playerGameLabel } from '../../domain/nflGames'
import { positionTone } from '../../domain/positions'
import type { FantasyRosterPlayer, NFLGame, Sport } from '../../domain/types'
import PlayerPhoto from '../PlayerPhoto'

export type PlayerLineDetail = {
  label: string
  to?: string
}

type PlayerLineProps = {
  player: FantasyRosterPlayer
  games: NFLGame[]
  detail?: string | PlayerLineDetail[]
  detailTo?: string
  pointsLabel?: string
  highlightLive?: boolean
  showGame?: boolean
  sport?: Sport
  /** Opponent H2H column: pts toward center, who on the right */
  mirror?: boolean
}

function renderDetail(detail: string | PlayerLineDetail[], detailTo?: string): ReactNode {
  if (typeof detail === 'string') {
    return detailTo ? (
      <Link className="roster-row__team" to={detailTo}>
        {detail}
      </Link>
    ) : (
      detail
    )
  }
  return detail.map((part, index) => (
    <Fragment key={`${part.label}:${part.to ?? index}`}>
      {index > 0 ? ' · ' : null}
      {part.to ? (
        <Link className="roster-row__team" to={part.to}>
          {part.label}
        </Link>
      ) : (
        part.label
      )}
    </Fragment>
  ))
}

export default function PlayerLine({
  player,
  games,
  detail,
  detailTo,
  pointsLabel,
  highlightLive = true,
  showGame = true,
  sport = 'nfl',
  mirror = false,
}: PlayerLineProps) {
  const game = gameForProTeam(games, player.proTeam)
  const live = game?.status === 'live'
  const gameLabel = showGame ? playerGameLabel(game) : ''
  const injury = player.injuryStatus
  const detailNode = detail ? renderDetail(detail, detailTo) : null
  const hasMeta = Boolean(player.position || player.proTeam || detailNode || gameLabel)
  const tone = positionTone(player.position)
  const rowClass = [
    'roster-row',
    tone && 'roster-row--pos',
    tone,
    live && highlightLive && 'roster-row--live',
    mirror && 'roster-row--mirror',
  ]
    .filter(Boolean)
    .join(' ')

  const meta: ReactNode[] = []
  if (player.position) meta.push(<span className="pos-label">{player.position}</span>)
  if (player.proTeam) meta.push(player.proTeam)
  if (detailNode) meta.push(detailNode)
  if (gameLabel) meta.push(gameLabel)

  return (
    <div className={rowClass}>
      <span className="roster-row__who">
        <PlayerPhoto player={player} sport={sport} size={28} />
        <span className="roster-row__name">
          <span className="roster-row__identity">
            <span className="roster-row__player">{player.name}</span>
            {!player.starter ? (
              <span className="roster-flag roster-flag--bench" title="Bench">
                B
              </span>
            ) : null}
            {injury ? (
              <span className={injuryFlagClass(injury)} title={injuryTitle(injury)}>
                {injury}
              </span>
            ) : null}
          </span>
          {hasMeta ? (
            <span className="roster-row__meta">
              {meta.map((part, index) => (
                <Fragment key={index}>
                  {index > 0 ? ' · ' : null}
                  {part}
                </Fragment>
              ))}
            </span>
          ) : null}
        </span>
      </span>
      <span className="roster-row__pts">{pointsLabel ?? formatPoints(player.points)}</span>
    </div>
  )
}
