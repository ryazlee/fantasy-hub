import { useEffect, useState } from 'react'
import { nflTeamLogoUrl, playerPhotoUrl } from '../domain/media'
import type { FantasyRosterPlayer, Sport } from '../domain/types'

type PlayerPhotoProps = {
  player: FantasyRosterPlayer
  sport?: Sport
  size?: number
}

export default function PlayerPhoto({ player, sport = 'nfl', size = 28 }: PlayerPhotoProps) {
  const primary = playerPhotoUrl(sport, player.canonicalPlayerId, player.position, player.proTeam)
  const fallback = nflTeamLogoUrl(player.proTeam)
  const [src, setSrc] = useState(primary ?? fallback)

  useEffect(() => {
    setSrc(primary ?? fallback)
  }, [primary, fallback])

  if (!src) {
    return <span className="player-photo player-photo--empty" aria-hidden />
  }

  return (
    <img
      className={src === fallback ? 'player-photo player-photo--team' : 'player-photo'}
      src={src}
      alt=""
      width={size}
      height={size}
      onError={() => {
        if (fallback && src !== fallback) setSrc(fallback)
        else setSrc(undefined)
      }}
    />
  )
}
