import { useCallback, useEffect, useState, type FormEvent } from 'react'
import AppHeader from '../AppHeader'
import Button from '../Button'
import MakerCredit from '../MakerCredit'
import Modal from '../Modal'
import ProviderRow from '../ProviderRow'
import type { ProviderMenuItem } from '../ProviderMenu'
import { queryKeys } from '../../hooks/queryKeys'
import { useSavedConfig } from '../../hooks/useSavedConfig'
import { queryClient } from '../../lib/queryClient'
import { lookupEspnLeague } from '../../providers/espn/adapter'
import { EspnError } from '../../providers/espn/client'
import { completeEspnConnect, defaultEspnSeason, parseEspnConnectInput } from '../../providers/espn/parse'
import { lookupSleeperUser } from '../../providers/sleeper/adapter'
import { SleeperError } from '../../providers/sleeper/client'
import { yahooAuthUrl, yahooConfigured } from '../../providers/yahoo/client'
import { applyShareMeta } from '../../utils/shareMeta'
import {
  connectEspn,
  connectSleeper,
  disconnectEspnLeague,
  disconnectProvider,
  espnLeagues,
  espnLeaguesDetail,
  hasAnyProvider,
} from '../../utils/storage'
import type { ProviderName } from '../../domain/types'

type ConnectModal = ProviderName | null

export default function LandingScreen() {
  const config = useSavedConfig()
  const sleeper = config.providers.sleeper
  const yahoo = Boolean(config.providers.yahoo)
  const espn = espnLeagues(config)
  const [modal, setModal] = useState<ConnectModal>(null)
  const [username, setUsername] = useState('')
  const [espnInput, setEspnInput] = useState('')
  const [espnSeason, setEspnSeason] = useState(() => String(defaultEspnSeason()))
  const [espnTeamId, setEspnTeamId] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const closeModal = useCallback(() => {
    setModal(null)
    setNotice('')
    setBusy(false)
  }, [])

  useEffect(() => {
    applyShareMeta()
  }, [])

  function openModal(next: ConnectModal) {
    setNotice('')
    setBusy(false)
    if (next === 'espn') {
      setEspnInput('')
      setEspnSeason(String(defaultEspnSeason()))
      setEspnTeamId('')
    }
    setModal(next)
  }

  async function onConnectSleeper(event: FormEvent) {
    event.preventDefault()
    setNotice('')
    setBusy(true)
    try {
      const user = await lookupSleeperUser(username)
      connectSleeper(user.username ?? username.trim(), user.user_id)
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      closeModal()
    } catch (error) {
      setNotice(
        error instanceof SleeperError
          ? error.message
          : 'We could not connect that Sleeper account.',
      )
    } finally {
      setBusy(false)
    }
  }

  function onEspnInput(value: string) {
    setEspnInput(value)
    const parsed = parseEspnConnectInput(value)
    if (parsed.season) setEspnSeason(String(parsed.season))
    if (parsed.teamId) setEspnTeamId(parsed.teamId)
  }

  async function onConnectEspn(event: FormEvent) {
    event.preventDefault()
    setNotice('')
    setBusy(true)
    try {
      const draft = completeEspnConnect(espnInput, espnSeason, espnTeamId)
      const connection = await lookupEspnLeague(draft)
      connectEspn(connection)
      await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
      closeModal()
    } catch (error) {
      setNotice(
        error instanceof EspnError
          ? error.message
          : 'We could not connect that ESPN league.',
      )
    } finally {
      setBusy(false)
    }
  }

  function removeEspnLeague(leagueId: string, season: number) {
    disconnectEspnLeague(leagueId, season)
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
  }

  const espnMenu: ProviderMenuItem[] = espn.length
    ? [
        { label: 'Add league', onClick: () => openModal('espn') },
        ...espn.map((league) => ({
          label: espn.length === 1 ? 'Disconnect ESPN' : 'Disconnect',
          meta: espn.length === 1 ? undefined : league.leagueName || `League ${league.leagueId}`,
          danger: true,
          onClick: () => removeEspnLeague(league.leagueId, league.season),
        })),
        ...(espn.length > 1
          ? [
              {
                label: 'Disconnect all ESPN',
                danger: true,
                onClick: () => {
                  disconnectProvider('espn')
                  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
                },
              },
            ]
          : []),
      ]
    : []

  return (
    <div className="app-shell app-shell--home">
      <AppHeader title="Fantasy Hub" />
      <main className="app-main">
        <div className="shell-inner">
          <div className="home">
            <div className="home__copy">
              <p className="home__lede">All your fantasy teams. One dashboard.</p>
              <p className="home__note">No accounts. Read-only. Built for game day.</p>
              <MakerCredit />
            </div>

            <div className="home__session">
              {hasAnyProvider(config) ? (
                <div className="home__actions">
                  <Button label="Open dashboard" to="/dashboard" />
                </div>
              ) : null}

              <div className="home__providers">
                <ProviderRow
                  provider="sleeper"
                  connected={Boolean(sleeper)}
                  detail={sleeper ? `@${sleeper.username}` : undefined}
                  onConnect={sleeper ? undefined : () => openModal('sleeper')}
                />
                <ProviderRow
                  provider="yahoo"
                  connected={yahoo}
                  detail={yahoo ? 'Connected' : undefined}
                  onConnect={
                    yahoo
                      ? undefined
                      : () => {
                          if (yahooConfigured()) {
                            window.location.assign(yahooAuthUrl())
                            return
                          }
                          openModal('yahoo')
                        }
                  }
                />
                <div className="home__provider">
                  <ProviderRow
                    provider="espn"
                    connected={espn.length > 0}
                    detail={espn.length ? espnLeaguesDetail(espn) : undefined}
                    onConnect={espn.length ? undefined : () => openModal('espn')}
                    menuItems={espn.length ? espnMenu : undefined}
                  />
                  {espn.length ? (
                    <p className="account-row__hint">Use ⋯ to add another league.</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Modal title="Connect Sleeper" open={modal === 'sleeper'} onClose={closeModal}>
        <form className="home__form" onSubmit={onConnectSleeper}>
          <label className="field">
            <span className="field__label">Sleeper username</span>
            <input
              className="input"
              name="username"
              autoComplete="username"
              placeholder="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          {notice && modal === 'sleeper' ? <p className="notice notice--danger">{notice}</p> : null}
          <div className="modal__actions">
            <Button
              label={busy ? 'Connecting…' : 'Connect'}
              variant="primary"
              type="submit"
              disabled={busy}
            />
          </div>
        </form>
      </Modal>

      <Modal title="Connect Yahoo" open={modal === 'yahoo'} onClose={closeModal}>
        <p className="notice">
          Yahoo needs the Worker URL in this build. Use the deployed site or set VITE_YAHOO_API_URL
          locally.
        </p>
        <div className="modal__actions">
          <Button label="Close" variant="secondary" onClick={closeModal} />
        </div>
      </Modal>

      <Modal
        title={espn.length ? 'Add ESPN league' : 'Connect ESPN'}
        open={modal === 'espn'}
        onClose={closeModal}
      >
        <form className="home__form" onSubmit={onConnectEspn}>
          <p className="notice">
            The league must be public. Paste the league page URL or the league ID from it.
          </p>
          <label className="field">
            <span className="field__label">Public league URL or ID</span>
            <input
              className="input"
              name="espn-league"
              autoComplete="off"
              placeholder="https://fantasy.espn.com/football/league?leagueId=…"
              value={espnInput}
              onChange={(event) => onEspnInput(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Season</span>
            <input
              className="input"
              name="espn-season"
              inputMode="numeric"
              autoComplete="off"
              placeholder={String(defaultEspnSeason())}
              value={espnSeason}
              onChange={(event) => setEspnSeason(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Team ID (optional)</span>
            <input
              className="input"
              name="espn-team"
              inputMode="numeric"
              autoComplete="off"
              placeholder="from teamId= in your team URL"
              value={espnTeamId}
              onChange={(event) => setEspnTeamId(event.target.value)}
            />
          </label>
          {notice && modal === 'espn' ? <p className="notice notice--danger">{notice}</p> : null}
          <div className="modal__actions">
            <Button
              label={busy ? 'Connecting…' : 'Connect'}
              variant="primary"
              type="submit"
              disabled={busy}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
