import { useOutletContext } from 'react-router-dom'
import { providerLabel } from '../../domain/sportDisplay'
import type { DashboardContext } from './context'
import MatchupScoreline from './MatchupScoreline'

function teamPath(teamId: string): string {
  return `/team/${encodeURIComponent(teamId)}`
}

export default function LeaguesView() {
  const { leagues } = useOutletContext<DashboardContext>()

  if (leagues.length === 0) {
    return <p className="notice">No connected leagues to show.</p>
  }

  return (
    <section className="stack">
      {leagues.map((slate) => {
        const owned = new Set(slate.ownedTeamIds)
        return (
          <article key={slate.league.id} className="h2h">
            <p className="h2h__league">
              {providerLabel(slate.league.provider)} · {slate.league.name}
            </p>
            {slate.matchups.length === 0 ? (
              <p className="quiet">No head-to-head matchups this period.</p>
            ) : (
              <div className="league-slate">
                {slate.matchups.map((pair) => {
                  const homeMine = owned.has(pair.home.id)
                  const awayMine = pair.away ? owned.has(pair.away.id) : false
                  return (
                    <div
                      key={pair.away ? `${pair.home.id}:${pair.away.id}` : pair.home.id}
                      className={
                        homeMine || awayMine
                          ? 'league-slate__row league-slate__row--mine'
                          : 'league-slate__row'
                      }
                    >
                      <MatchupScoreline
                        teamName={pair.home.name}
                        teamLogoUrl={pair.home.logoUrl}
                        teamTo={teamPath(pair.home.id)}
                        teamMine={homeMine}
                        opponentName={pair.away?.name ?? 'No matchup'}
                        opponentLogoUrl={pair.away?.logoUrl}
                        opponentTo={pair.away ? teamPath(pair.away.id) : undefined}
                        opponentMine={awayMine}
                        points={pair.home.points}
                        opponentPoints={pair.away?.points}
                        emptyOpponent={!pair.away}
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
