import { nflTeamLogoUrl } from '../domain/media'

export default function TeamLogo({
  abbr,
  size = 22,
}: {
  abbr: string | undefined
  size?: number
}) {
  const src = nflTeamLogoUrl(abbr)
  if (!src) return null
  return (
    <img
      className="team-logo"
      src={src}
      alt=""
      width={size}
      height={size}
      onError={(event) => {
        event.currentTarget.hidden = true
      }}
    />
  )
}
