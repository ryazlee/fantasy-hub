import type { ProviderName } from '../domain/types'
import sleeperMark from '../assets/providers/sleeper.png'
import espnMark from '../assets/providers/espn.svg'

type ProviderIconProps = {
  provider: ProviderName
  size?: number
}

export default function ProviderIcon({ provider, size = 20 }: ProviderIconProps) {
  if (provider === 'yahoo') {
    return (
      <svg
        className="provider-icon provider-icon--yahoo"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="currentColor"
          d="M18.86 1.56 14.27 11.87H19.4L24 1.56h-5.14M0 6.71l5.15 11.56L3.3 22.44h4.53L14.69 6.71h-4.5L7.39 13.44 4.62 6.71H0m15.62 6.16c-1.67 0-2.91 1.25-2.91 2.71 0 1.42 1.2 2.61 2.79 2.61 1.68 0 2.93-1.23 2.93-2.69 0-1.47-1.2-2.63-2.81-2.63z"
        />
      </svg>
    )
  }

  if (provider === 'espn') {
    return (
      <img
        className="provider-icon provider-icon--espn"
        src={espnMark}
        alt=""
        width={Math.round(size * 2.2)}
        height={size}
      />
    )
  }

  return (
    <img
      className="provider-icon provider-icon--sleeper"
      src={sleeperMark}
      alt=""
      width={size}
      height={size}
    />
  )
}
