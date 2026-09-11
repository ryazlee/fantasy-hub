import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { RefreshCw, Settings } from 'lucide-react'
import AppHeader from '../AppHeader'
import OverflowMenu, { type OverflowMenuItem } from '../OverflowMenu'
import WeekSelect from '../WeekSelect'
import { useDashboard, useNflGames, useNflPlayerStats } from '../../hooks/useDashboard'
import { useSavedConfig } from '../../hooks/useSavedConfig'
import { applyShareMeta } from '../../utils/shareMeta'
import {
  hasAnyProvider,
  loadDismissedWarnings,
  dismissWarning,
  savePrefs,
  type DashboardPrefs,
} from '../../utils/storage'
import type { DashboardView } from '../../domain/types'

const VIEWS: { id: DashboardView; to: string; label: string; end?: boolean }[] = [
  { id: 'teams', to: '/dashboard', label: 'Teams', end: true },
  { id: 'live', to: '/dashboard/live', label: 'Live' },
  { id: 'matchups', to: '/dashboard/matchups', label: 'Matchups' },
  { id: 'leagues', to: '/dashboard/leagues', label: 'Leagues' },
  { id: 'players', to: '/dashboard/players', label: 'Players' },
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

function viewFromPath(pathname: string): DashboardView {
  if (pathname.endsWith('/matchups')) return 'matchups'
  if (pathname.endsWith('/leagues')) return 'leagues'
  if (pathname.endsWith('/players')) return 'players'
  if (pathname.endsWith('/live')) return 'live'
  if (pathname.endsWith('/research')) return 'research'
  return 'teams'
}

function prefToggle(
  label: string,
  pref: 'showBench' | 'highlightLive' | 'showOpponents',
  prefs: DashboardPrefs,
): OverflowMenuItem {
  return {
    type: 'toggle',
    label,
    checked: prefs[pref],
    onChange: (next) => savePrefs({ [pref]: next }),
  }
}

function overflowItems(view: DashboardView, prefs: DashboardPrefs): OverflowMenuItem[] {
  if (view === 'teams') return [prefToggle('Show bench', 'showBench', prefs)]
  if (view === 'matchups') {
    return [
      prefToggle('Show bench', 'showBench', prefs),
      prefToggle('Highlight live', 'highlightLive', prefs),
    ]
  }
  if (view === 'players') {
    return [
      prefToggle('Show bench', 'showBench', prefs),
      prefToggle('Highlight live', 'highlightLive', prefs),
      {
        type: 'select',
        label: 'Group by',
        value: prefs.playersGroupBy,
        options: [
          { value: 'position', label: 'Position' },
          { value: 'fantasy', label: 'Fantasy team' },
        ],
        onChange: (next) => savePrefs({ playersGroupBy: next === 'fantasy' ? 'fantasy' : 'position' }),
      },
    ]
  }
  if (view === 'live') {
    return [
      prefToggle('Show bench', 'showBench', prefs),
      prefToggle('Highlight live', 'highlightLive', prefs),
      prefToggle('Show opponents', 'showOpponents', prefs),
    ]
  }
  return []
}

export default function DashboardScreen() {
  const { data, isPending, isError, refetch, isFetching, dataUpdatedAt } = useDashboard()
  const connected = hasAnyProvider()
  const location = useLocation()
  const view = viewFromPath(location.pathname)
  const prefs = useSavedConfig().prefs
  const gamesQuery = useNflGames(connected, prefs.scoringWeek)
  const statsQuery = useNflPlayerStats(connected, prefs.scoringWeek)
  const hasLiveGame = (gamesQuery.data ?? []).some((game) => game.status === 'live')
  const menuItems = overflowItems(view, prefs)
  const [now, setNow] = useState(() => Date.now())
  const [dismissedWarnings, setDismissedWarnings] = useState(loadDismissedWarnings)

  const currentWeek = data?.currentWeek ?? 1
  const weekCount = data?.weekCount ?? 18
  const viewWeek = prefs.scoringWeek ?? data?.viewWeek ?? currentWeek
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date())
  const lastUpdatedAt = Math.max(dataUpdatedAt, gamesQuery.dataUpdatedAt, statsQuery.dataUpdatedAt)
  const ago = connected ? updatedDelta(lastUpdatedAt, now) : ''
  const refreshing = isFetching || gamesQuery.isFetching || statsQuery.isFetching

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
        subtitle={
          connected ? (
            <span className="header-weekline">
              <span>{weekday}</span>
              <span aria-hidden>,</span>
              <WeekSelect
                week={viewWeek}
                weekCount={weekCount}
                currentWeek={currentWeek}
                onChange={(next) => savePrefs({ scoringWeek: next === currentWeek ? null : next })}
              />
            </span>
          ) : (
            weekday
          )
        }
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
                  void statsQuery.refetch()
                }}
              >
                <span className="btn__icon">
                  <RefreshCw size={16} className={refreshing ? 'header-refresh__spin' : undefined} />
                </span>
                {ago ? <span className="header-refresh__ago">{ago}</span> : null}
              </button>
            ) : null}
            <Link
              to="/settings"
              className="theme-toggle"
              aria-label="Settings"
              title="Settings"
            >
              <Settings size={18} strokeWidth={2} aria-hidden />
            </Link>
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
            <div className="chips-bar">
              <nav className="chips" aria-label="Dashboard views">
                {VIEWS.map((tab) => (
                  <NavLink
                    key={tab.id}
                    to={tab.to}
                    end={tab.end}
                    className={({ isActive }) => (isActive ? 'chip chip--on' : 'chip')}
                    aria-label={tab.id === 'live' && hasLiveGame ? 'Live, game in progress' : undefined}
                    onClick={() => savePrefs({ dashboardView: tab.id })}
                  >
                    {tab.label}
                    {tab.id === 'live' && hasLiveGame ? (
                      <span className="chip__live-dot" aria-hidden />
                    ) : null}
                  </NavLink>
                ))}
              </nav>
              {menuItems.length > 0 ? (
                <OverflowMenu
                  key={view}
                  label={`${VIEWS.find((row) => row.id === view)?.label ?? 'View'} options`}
                  items={menuItems}
                />
              ) : null}
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
                playerStats: statsQuery.data ?? {},
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
