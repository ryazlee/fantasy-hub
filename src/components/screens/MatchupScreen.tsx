import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppHeader from '../AppHeader'
import { useMatchup, useNflGames, useNflPlayerStats } from '../../hooks/useDashboard'
import { anyPlayerHasPlayed } from '../../domain/nflGames'
import { formatPlacement } from '../../domain/standings'
import { providerLabel } from '../../domain/sportDisplay'
import { applyShareMeta } from '../../utils/shareMeta'
import { useSavedConfig } from '../../hooks/useSavedConfig'
import MatchupScoreline from '../dashboard/MatchupScoreline'
import PlayerLine from '../dashboard/PlayerLine'
import RosterLines from '../dashboard/RosterLines'
import { visibleRoster } from '../dashboard/roster'

export default function MatchupScreen() {
  const { teamId, opponentId } = useParams()
  const team = teamId ? decodeURIComponent(teamId) : undefined
  const opponent = opponentId ? decodeURIComponent(opponentId) : undefined
  const { data, isPending, isError } = useMatchup(team, opponent)
  const prefs = useSavedConfig().prefs
  const gamesQuery = useNflGames(Boolean(team && opponent), prefs.scoringWeek)
  const statsQuery = useNflPlayerStats(Boolean(team && opponent), prefs.scoringWeek)
  const games = gamesQuery.data ?? []
  const playerStats = statsQuery.data ?? {}

  const title = data ? `${data.team.name} vs ${data.opponent.name}` : 'Matchup'

  useEffect(() => {
    applyShareMeta(data ? title : 'Matchup')
  }, [data, title])

  const yours = data ? visibleRoster(data.roster, data.league.sport, prefs.showBench) : []
  const theirs = data ? visibleRoster(data.opponentRoster, data.league.sport, prefs.showBench) : []

  return (
    <div className="app-shell">
      <AppHeader
        title="Matchup"
        subtitle={
          data
            ? `${providerLabel(data.league.provider)} · ${data.league.name} · Week ${data.league.scoringPeriod}`
            : undefined
        }
      />
      <main className="app-main">
        <div className="shell-inner page-stack">
          <p className="notice">
            <Link to="/dashboard">← Your teams</Link>
          </p>

          {isPending ? <p className="notice">Loading matchup…</p> : null}
          {!isPending && (isError || data === null) ? (
            <p className="notice notice--danger">We could not load this matchup.</p>
          ) : null}

          {data ? (
            <article className="h2h">
              <MatchupScoreline
                teamName={data.team.name}
                teamLogoUrl={data.team.logoUrl}
                teamTo={`/team/${encodeURIComponent(data.team.id)}`}
                teamMine={data.teamMine}
                teamPlace={formatPlacement(data.team)}
                opponentName={data.opponent.name}
                opponentLogoUrl={data.opponent.logoUrl}
                opponentTo={`/team/${encodeURIComponent(data.opponent.id)}`}
                opponentMine={data.opponentMine}
                opponentPlace={formatPlacement(data.opponent)}
                points={data.team.points}
                opponentPoints={data.opponent.points}
                started={anyPlayerHasPlayed(yours, games) || anyPlayerHasPlayed(theirs, games)}
              />
              <div className="h2h__grid">
                <div>
                  <RosterLines
                    items={yours}
                    isStarter={(player) => player.starter}
                    itemKey={(player) => `you:${player.providerPlayerId}`}
                    render={(player) => (
                      <PlayerLine
                        player={player}
                        games={games}
                        playerStats={playerStats}
                        highlightLive={prefs.highlightLive}
                        sport={data.league.sport}
                      />
                    )}
                  />
                </div>
                <div>
                  <RosterLines
                    items={theirs}
                    isStarter={(player) => player.starter}
                    itemKey={(player) => `opp:${player.providerPlayerId}`}
                    render={(player) => (
                      <PlayerLine
                        player={player}
                        games={games}
                        playerStats={playerStats}
                        highlightLive={prefs.highlightLive}
                        sport={data.league.sport}
                        mirror
                      />
                    )}
                  />
                </div>
              </div>
            </article>
          ) : null}
        </div>
      </main>
    </div>
  )
}
