import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppHeader from '../AppHeader'
import Button from '../Button'
import ProviderIcon from '../ProviderIcon'
import SectionCard from '../SectionCard'
import { queryKeys } from '../../hooks/queryKeys'
import { queryClient } from '../../lib/queryClient'
import type { ProviderName } from '../../domain/types'
import { applyShareMeta } from '../../utils/shareMeta'
import {
  disconnectProvider,
  espnLeagues,
  espnLeaguesDetail,
  loadConfig,
} from '../../utils/storage'

function ProviderLabel({
  provider,
  detail,
}: {
  provider: ProviderName
  detail: string
}) {
  return (
    <span className="settings-provider">
      <ProviderIcon provider={provider} size={22} />
      <span>
        {provider === 'sleeper' ? 'Sleeper' : provider === 'yahoo' ? 'Yahoo' : 'ESPN'}
        <span className="settings-provider__meta">{detail}</span>
      </span>
    </span>
  )
}

export default function SettingsScreen() {
  const navigate = useNavigate()
  const [config, setConfig] = useState(() => loadConfig())

  useEffect(() => {
    applyShareMeta('Settings')
  }, [])

  function disconnect(provider: ProviderName) {
    const next = disconnectProvider(provider)
    setConfig(next)
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    if (!next.providers.sleeper && !next.providers.yahoo && !espnLeagues(next).length) {
      navigate('/')
    }
  }

  return (
    <div className="app-shell">
      <AppHeader title="Settings" />
      <main className="app-main">
        <div className="shell-inner page-stack">
          <p className="notice">
            <Link to="/dashboard">← Dashboard</Link>
          </p>

          <SectionCard title="Connected platforms">
            <div className="stack">
              <div className="settings-row">
                <ProviderLabel
                  provider="sleeper"
                  detail={config.providers.sleeper ? `@${config.providers.sleeper.username}` : 'not connected'}
                />
                {config.providers.sleeper ? (
                  <Button label="Disconnect" variant="danger" onClick={() => disconnect('sleeper')} />
                ) : (
                  <Button label="Connect" variant="ghost" to="/" />
                )}
              </div>
              <div className="settings-row">
                <ProviderLabel
                  provider="yahoo"
                  detail={config.providers.yahoo ? 'connected' : 'not connected'}
                />
                {config.providers.yahoo ? (
                  <Button label="Disconnect" variant="danger" onClick={() => disconnect('yahoo')} />
                ) : null}
              </div>
              <div className="settings-row">
                <ProviderLabel
                  provider="espn"
                  detail={
                    espnLeagues(config).length
                      ? espnLeaguesDetail(espnLeagues(config))
                      : 'not connected'
                  }
                />
                {espnLeagues(config).length ? (
                  <Button label="Disconnect" variant="danger" onClick={() => disconnect('espn')} />
                ) : (
                  <Button label="Connect" variant="ghost" to="/" />
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  )
}
