import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import AppHeader from '../AppHeader'
import Button from '../Button'
import PrefToggle from '../dashboard/PrefToggle'
import { useDashboard, useNflGames } from '../../hooks/useDashboard'
import { headerPeriodLabel } from '../../domain/sportDisplay'
import { applyShareMeta } from '../../utils/shareMeta'
import { hasAnyProvider, savePrefs } from '../../utils/storage'
import type { DashboardView } from '../../domain/types'

const VIEWS: { id: DashboardView; to: string; label: string; end?: boolean }[] = [
  { id: 'teams', to: '/dashboard', label: 'Teams', end: true },
  { id: 'matchups', to: '/dashboard/matchups', label: 'Matchups' },
  { id: 'leagues', to: '/dashboard/leagues', label: 'Leagues' },
  { id: 'players', to: '/dashboard/players', label: 'Players' },
  { id: 'live', to: '/dashboard/live', label: 'Live' },
  { id: 'research', to: '/dashboard/research', label: 'Research' },
]

export default function DashboardScreen() {
  const { data, isPending, isError, refetch, isFetching } = useDashboard()
  const connected = hasAnyProvider()
  const gamesQuery = useNflGames(connected)
  const location = useLocation()
  const showOpponentsToggle = location.pathname.endsWith('/live')

  const week =
    data?.teams.find((row) => row.league.sport === 'nfl')?.league.scoringPeriod ??
    data?.teams[0]?.league.scoringPeriod
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date())

  useEffect(() => {
    applyShareMeta('Dashboard')
  }, [])

  return (
    <div className="app-shell">
      <AppHeader
        title="Fantasy Hub"
        subtitle={headerPeriodLabel(week, weekday)}
        extra={
          <>
            <Button
              label="Refresh"
              variant="ghost"
              icon={<RefreshCw size={16} />}
              onClick={() => {
                void refetch()
                void gamesQuery.refetch()
              }}
              disabled={isFetching || gamesQuery.isFetching}
            />
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

          {data?.errors.map((error) => (
            <p key={error.provider} className="provider-warn">
              {error.message}
            </p>
          ))}

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
