import { Check } from 'lucide-react'
import Button from './Button'
import ProviderIcon from './ProviderIcon'
import ProviderMenu, { type ProviderMenuItem } from './ProviderMenu'
import type { ProviderName } from '../domain/types'

function providerLabel(provider: ProviderName): string {
  if (provider === 'sleeper') return 'Sleeper'
  if (provider === 'yahoo') return 'Yahoo'
  return 'ESPN'
}

type ProviderRowProps = {
  provider: ProviderName
  connected: boolean
  detail?: string
  onConnect?: () => void
  menuItems?: ProviderMenuItem[]
}

export default function ProviderRow({
  provider,
  connected,
  detail,
  onConnect,
  menuItems,
}: ProviderRowProps) {
  const name = providerLabel(provider)

  return (
    <div className="account-row" aria-label={connected && detail ? `${name} connected as ${detail}` : name}>
      <ProviderIcon provider={provider} size={28} />
      <div className="account-row__text">
        <p className="account-row__name">{name}</p>
        {detail ? <p className="account-row__meta">{detail}</p> : null}
      </div>
      {connected ? (
        <Check className="account-row__check" size={18} strokeWidth={2.5} aria-hidden />
      ) : onConnect ? (
        <Button label="Connect" variant="ghost" type="button" onClick={onConnect} />
      ) : null}
      <ProviderMenu provider={provider} connected={connected} items={menuItems} />
    </div>
  )
}
