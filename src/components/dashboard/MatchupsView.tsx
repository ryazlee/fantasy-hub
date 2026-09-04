import { useOutletContext } from 'react-router-dom'
import { providerLabel } from '../../domain/sportDisplay'
import { useSavedConfig } from '../../hooks/useSavedConfig'
import type { DashboardContext } from './context'
import MatchupScoreline from './MatchupScoreline'
import PlayerLine from './PlayerLine'
import RosterLines from './RosterLines'
import { visibleRoster } from './roster'

export default function MatchupsView() {
  const { teams, games } = useOutletContext<DashboardContext>()
  const prefs = useSavedConfig().prefs
  const rows = teams.filter((row) => row.matchup)

  if (rows.length === 0) {
    return <p className="notice">No head-to-head matchups this period.</p>
  }

  return (
    <section className="stack">
      {rows.map((row) => {
        const yours = visibleRoster(row.roster, row.league.sport, prefs.showBench)
        const opps = visibleRoster(row.opponentRoster, row.league.sport, prefs.showBench)

        return (
          <article key={row.team.id} className="h2h">
            <p className="h2h__league">
              {providerLabel(row.league.provider)} · {row.league.name}
            </p>
            <MatchupScoreline
              teamName={row.team.name}
              teamLogoUrl={row.team.logoUrl}
              teamTo={`/team/${encodeURIComponent(row.team.id)}`}
              opponentName={row.opponentName ?? 'Opponent'}
              opponentLogoUrl={row.opponentLogoUrl}
              opponentTo={
                row.matchup?.opponentTeamId
                  ? `/team/${encodeURIComponent(row.matchup.opponentTeamId)}`
                  : undefined
              }
              points={row.matchup?.points}
              opponentPoints={row.matchup?.opponentPoints}
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
                      highlightLive={prefs.highlightLive}
                      sport={row.league.sport}
                    />
                  )}
                />
              </div>
              <div>
                <RosterLines
                  items={opps}
                  isStarter={(player) => player.starter}
                  itemKey={(player) => `opp:${player.providerPlayerId}`}
                  render={(player) => (
                    <PlayerLine
                      player={player}
                      games={games}
                      highlightLive={prefs.highlightLive}
                      sport={row.league.sport}
                      mirror
                    />
                  )}
                />
              </div>
            </div>
          </article>
        )
      })}
    </section>
  )
}
