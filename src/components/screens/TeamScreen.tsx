import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppHeader from '../AppHeader'
import { useTeam } from '../../hooks/useDashboard'
import { positionTone } from '../../domain/positions'
import { isBenchSlot } from '../../domain/rosterSlots'
import { formatPoints, providerLabel } from '../../domain/sportDisplay'
import { applyShareMeta } from '../../utils/shareMeta'
import { useSavedConfig } from '../../hooks/useSavedConfig'
import PlayerLine from '../dashboard/PlayerLine'
import { visibleRoster } from '../dashboard/roster'

export default function TeamScreen() {
  const { teamId } = useParams()
  const decoded = teamId ? decodeURIComponent(teamId) : undefined
  const { data, isPending, isError } = useTeam(decoded)
  const prefs = useSavedConfig().prefs
  const showBench = prefs.showBench

  useEffect(() => {
    applyShareMeta(data?.team.name)
  }, [data?.team.name])

  const groups = useMemo(() => {
    if (!data) return []
    const rows = visibleRoster(data.roster, data.league.sport, showBench)

    const out: { slot: string; players: typeof rows }[] = []
    for (const player of rows) {
      const slot = isBenchSlot(player.rosterSlot) ? 'Bench' : player.rosterSlot
      const last = out[out.length - 1]
      if (last && last.slot === slot) last.players.push(player)
      else out.push({ slot, players: [player] })
    }
    return out
  }, [data, showBench])

  return (
    <div className="app-shell">
      <AppHeader title={data?.team.name ?? 'Team'} subtitle={data ? `${providerLabel(data.league.provider)} · ${data.league.name}` : undefined} />
      <main className="app-main">
        <div className="shell-inner page-stack">
          <p className="notice">
            <Link to="/dashboard">← Your teams</Link>
          </p>

          {isPending ? <p className="notice">Loading roster…</p> : null}
          {!isPending && (isError || data === null) ? (
            <p className="notice notice--danger">We could not load this team.</p>
          ) : null}

          {data?.matchup ? (
            <p className="notice">
              {formatPoints(data.matchup.points)} vs{' '}
              {data.matchup.opponentTeamId ? (
                <Link to={`/team/${encodeURIComponent(data.matchup.opponentTeamId)}`}>
                  {data.opponentName ?? 'Opponent'}
                </Link>
              ) : (
                (data.opponentName ?? 'Opponent')
              )}{' '}
              {formatPoints(data.matchup.opponentPoints)}
            </p>
          ) : null}

          {groups.map((group) => (
            <div key={group.slot} className="roster-group">
              <p className={['roster-group__label', positionTone(group.slot)].filter(Boolean).join(' ')}>
                {group.slot}
              </p>
              {group.players.map((player) => (
                <PlayerLine
                  key={player.providerPlayerId}
                  player={player}
                  games={[]}
                  showGame={false}
                  sport={data?.league.sport ?? 'nfl'}
                  highlightLive={prefs.highlightLive}
                />
              ))}
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
