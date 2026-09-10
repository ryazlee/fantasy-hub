import { Link } from 'react-router-dom'
import { formatPointsIfStarted } from '../../domain/sportDisplay'

type MatchupScorelineProps = {
  teamName: string
  teamLogoUrl?: string
  teamTo?: string
  teamMine?: boolean
  teamPlace?: string
  opponentName: string
  opponentLogoUrl?: string
  opponentTo?: string
  opponentMine?: boolean
  opponentPlace?: string
  points?: number
  opponentPoints?: number
  teamTally?: string
  opponentTally?: string
  emptyOpponent?: boolean
  started?: boolean
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

function whoLabel(name: string, mine?: boolean, place?: string) {
  return (
    <span className="h2h__id">
      <span className="h2h__who-text">
        <span className="h2h__name">{name}</span>
        {place ? <span className="h2h__place">{place}</span> : null}
      </span>
      {mine ? <span className="h2h__you">You</span> : null}
    </span>
  )
}

export default function MatchupScoreline({
  teamName,
  teamLogoUrl,
  teamTo,
  teamMine = false,
  teamPlace,
  opponentName,
  opponentLogoUrl,
  opponentTo,
  opponentMine = false,
  opponentPlace,
  points,
  opponentPoints,
  teamTally,
  opponentTally,
  emptyOpponent = false,
  started = true,
}: MatchupScorelineProps) {
  let yours: 'winning' | 'losing' | null = null
  let theirs: 'winning' | 'losing' | null = null
  if (started && !emptyOpponent && points != null && opponentPoints != null) {
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
      {teamLogoUrl ? <img className="team-mark" src={teamLogoUrl} alt="" width={20} height={20} /> : null}
      {whoLabel(teamName, teamMine, teamPlace)}
    </>
  )

  const them = (
    <>
      {!emptyOpponent && opponentLogoUrl ? (
        <img className="team-mark" src={opponentLogoUrl} alt="" width={20} height={20} />
      ) : null}
      {whoLabel(opponentName, opponentMine, emptyOpponent ? undefined : opponentPlace)}
    </>
  )

  const showTally = teamTally != null || opponentTally != null
  const yoursPts = formatPointsIfStarted(points, started)
  const theirsPts = emptyOpponent ? '—' : formatPointsIfStarted(opponentPoints, started)

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
        <span
          className={['h2h__pts', yours && `h2h__pts--${yours}`, yoursPts === '—' && 'h2h__pts--empty']
            .filter(Boolean)
            .join(' ')}
        >
          {yoursPts}
        </span>
        <span className="h2h__mid-rule" aria-hidden />
        <span
          className={['h2h__pts', theirs && `h2h__pts--${theirs}`, theirsPts === '—' && 'h2h__pts--empty']
            .filter(Boolean)
            .join(' ')}
        >
          {theirsPts}
        </span>
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
