import { Link } from 'react-router-dom'
import { formatPoints } from '../../domain/sportDisplay'

type MatchupScorelineProps = {
  teamName: string
  teamLogoUrl?: string
  teamTo?: string
  teamMine?: boolean
  opponentName: string
  opponentLogoUrl?: string
  opponentTo?: string
  opponentMine?: boolean
  points?: number
  opponentPoints?: number
  teamTally?: string
  opponentTally?: string
  emptyOpponent?: boolean
}

function whoClass(opts: {
  opp?: boolean
  empty?: boolean
  mine?: boolean
  status: 'winning' | 'losing' | null
}): string {
  const parts = ['h2h__who']
  if (opts.opp) parts.push('h2h__who--opp')
  if (opts.empty) parts.push('h2h__who--empty')
  if (opts.mine) parts.push('h2h__who--mine')
  if (opts.status === 'winning') parts.push('h2h__who--winning')
  if (opts.status === 'losing') parts.push('h2h__who--losing')
  return parts.join(' ')
}

function whoLabel(name: string, mine?: boolean) {
  return (
    <span className="h2h__id">
      <span className="h2h__name">{name}</span>
      {mine ? <span className="h2h__you">You</span> : null}
    </span>
  )
}

export default function MatchupScoreline({
  teamName,
  teamLogoUrl,
  teamTo,
  teamMine = false,
  opponentName,
  opponentLogoUrl,
  opponentTo,
  opponentMine = false,
  points,
  opponentPoints,
  teamTally,
  opponentTally,
  emptyOpponent = false,
}: MatchupScorelineProps) {
  let yours: 'winning' | 'losing' | null = null
  let theirs: 'winning' | 'losing' | null = null
  if (!emptyOpponent && points != null && opponentPoints != null) {
    if (points > opponentPoints) {
      yours = 'winning'
      theirs = 'losing'
    } else if (points < opponentPoints) {
      yours = 'losing'
      theirs = 'winning'
    }
  }

  const you = (
    <>
      {teamLogoUrl ? <img className="team-mark" src={teamLogoUrl} alt="" width={22} height={22} /> : null}
      {whoLabel(teamName, teamMine)}
    </>
  )

  const them = (
    <>
      {!emptyOpponent && opponentLogoUrl ? (
        <img className="team-mark" src={opponentLogoUrl} alt="" width={22} height={22} />
      ) : null}
      {whoLabel(opponentName, opponentMine)}
    </>
  )

  const showTally = teamTally != null || opponentTally != null

  return (
    <div className="h2h__scores">
      {teamTo ? (
        <Link className={whoClass({ mine: teamMine, status: yours })} to={teamTo}>
          {you}
        </Link>
      ) : (
        <span className={whoClass({ mine: teamMine, status: yours })}>{you}</span>
      )}
      <div className="h2h__mid">
        <span className={yours ? `h2h__pts h2h__pts--${yours}` : 'h2h__pts'}>{formatPoints(points)}</span>
        <span className="h2h__mid-rule" aria-hidden />
        {emptyOpponent ? (
          <span className="h2h__pts h2h__pts--empty">—</span>
        ) : (
          <span className={theirs ? `h2h__pts h2h__pts--${theirs}` : 'h2h__pts'}>
            {formatPoints(opponentPoints)}
          </span>
        )}
      </div>
      {opponentTo && !emptyOpponent ? (
        <Link className={whoClass({ opp: true, mine: opponentMine, status: theirs })} to={opponentTo}>
          {them}
        </Link>
      ) : (
        <span className={whoClass({ opp: true, empty: emptyOpponent, mine: opponentMine, status: theirs })}>
          {them}
        </span>
      )}
      {showTally ? (
        <>
          <span className="h2h__tally">{teamTally ?? ''}</span>
          <span className="h2h__tally-gap" aria-hidden />
          <span className="h2h__tally h2h__tally--opp">{opponentTally ?? ''}</span>
        </>
      ) : null}
    </div>
  )
}
