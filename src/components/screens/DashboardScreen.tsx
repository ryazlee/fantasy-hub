import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import AppHeader from '../AppHeader'
import Button from '../Button'
import PrefToggle from '../dashboard/PrefToggle'
import { useDashboard, useNflGames } from '../../hooks/useDashboard'
import { headerPeriodLabel } from '../../domain/sportDisplay'
import { applyShareMeta } from '../../utils/shareMeta'
import { hasAnyProvider, loadDismissedWarnings, dismissWarning, savePrefs } from '../../utils/storage'
import type { DashboardView } from '../../domain/types'

const VIEWS: { id: DashboardView; to: string; label: string; end?: boolean }[] = [
  { id: 'teams', to: '/dashboard', label: 'Teams', end: true },
  { id: 'matchups', to: '/dashboard/matchups', label: 'Matchups' },
  { id: 'leagues', to: '/dashboard/leagues', label: 'Leagues' },
  { id: 'players', to: '/dashboard/players', label: 'Players' },
  { id: 'live', to: '/dashboard/live', label: 'Live' },
  { id: 'research', to: '/dashboard/research', label: 'Research' },
]

function updatedDelta(timestamp: number, now: number): string {
  if (!timestamp) return ''
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function DashboardScreen() {
  const { data, isPending, isError, refetch, isFetching, dataUpdatedAt } = useDashboard()
  const connected = hasAnyProvider()
  const gamesQuery = useNflGames(connected)
  const location = useLocation()
  const showOpponentsToggle = location.pathname.endsWith('/live')
  const [now, setNow] = useState(() => Date.now())
  const [dismissedWarnings, setDismissedWarnings] = useState(loadDismissedWarnings)

  const week =
    data?.teams.find((row) => row.league.sport === 'nfl')?.league.scoringPeriod ??
    data?.teams[0]?.league.scoringPeriod
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date())
  const lastUpdatedAt = Math.max(dataUpdatedAt, gamesQuery.dataUpdatedAt)
  const ago = connected ? updatedDelta(lastUpdatedAt, now) : ''
  const refreshing = isFetching || gamesQuery.isFetching

  useEffect(() => {
    applyShareMeta('Dashboard')
  }, [])

  useEffect(() => {
    if (!lastUpdatedAt) return
    setNow(Date.now())
  }, [lastUpdatedAt])

  useEffect(() => {
    if (!connected || !lastUpdatedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(id)
  }, [connected, lastUpdatedAt])

  return (
    <div className="app-shell">
      <AppHeader
        title="Fantasy Hub"
        subtitle={headerPeriodLabel(week, weekday)}
        extra={
          <>
            {connected ? (
              <button
                type="button"
                className="btn btn--ghost header-refresh"
                aria-label={ago ? `Refresh · updated ${ago}` : 'Refresh'}
                title={ago ? `Updated ${ago}` : 'Refresh'}
                disabled={refreshing}
                onClick={() => {
                  void refetch()
                  void gamesQuery.refetch()
                }}
              >
                <span className="btn__icon">
                  <RefreshCw size={16} className={refreshing ? 'header-refresh__spin' : undefined} />
                </span>
                {ago ? <span className="header-refresh__ago">{ago}</span> : null}
              </button>
            ) : null}
            <Button label="Settings" variant="ghost" to="/settings" />
          </>
        }
      />
      <main className="app-main">
        <div className="shell-inner page-stack">
          {!connected ? (
            <p className="notice">
              Connect a league on the <Link to="/">home screen</Link> to see your teams.
            </p>
          ) : null}

          {connected && isPending ? <p className="notice">Loading your teams…</p> : null}
          {isError ? (
            <p className="notice notice--danger">We could not load the dashboard. Try refresh.</p>
          ) : null}

          {data?.errors
            .filter((error) => !error.code || !dismissedWarnings.includes(error.code))
            .map((error) => {
              const code = error.code
              return (
                <div key={code ?? error.provider} className="provider-warn">
                  <p className="provider-warn__text">{error.message}</p>
                  {code ? (
                    <button
                      type="button"
                      className="provider-warn__dismiss"
                      aria-label="Dismiss"
                      onClick={() => setDismissedWarnings(dismissWarning(code))}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              )
            })}

          {data && data.teams.length === 0 && !isPending ? (
            <p className="notice">No teams yet for the connected accounts.</p>
          ) : null}

          {connected ? (
            <nav className="chips" aria-label="Dashboard views">
              {VIEWS.map((view) => (
                <NavLink
                  key={view.id}
                  to={view.to}
                  end={view.end}
                  className={({ isActive }) => (isActive ? 'chip chip--on' : 'chip')}
                  onClick={() => savePrefs({ dashboardView: view.id })}
                >
                  {view.label}
                </NavLink>
              ))}
            </nav>
          ) : null}

          {connected && data && data.teams.length > 0 && showOpponentsToggle ? (
            <div className="chips chips--sub" role="group" aria-label="Display options">
              <PrefToggle pref="showOpponents" label="Opponents" />
            </div>
          ) : null}

          {gamesQuery.isError ? (
            <p className="notice">NFL games could not load. Scores still come from your leagues.</p>
          ) : null}

          {data && data.teams.length > 0 ? (
            <Outlet
              context={{
                teams: data.teams,
                games: gamesQuery.data ?? [],
                leagues: (data.leagues ?? []).map(({ league, ownedTeamIds, matchups }) => ({
                  league,
                  ownedTeamIds,
                  matchups,
                })),
              }}
            />
          ) : null}
        </div>
      </main>
    </div>
  )
}
