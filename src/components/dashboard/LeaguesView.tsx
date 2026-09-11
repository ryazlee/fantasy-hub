import { Link, useOutletContext } from 'react-router-dom'
import { formatPlacement } from '../../domain/standings'
import { providerLabel } from '../../domain/sportDisplay'
import type { DashboardContext } from './context'
import MatchupScoreline from './MatchupScoreline'

function teamPath(teamId: string): string {
  return `/team/${encodeURIComponent(teamId)}`
}

function matchupPath(teamId: string, opponentId: string): string {
  return `/matchup/${encodeURIComponent(teamId)}/${encodeURIComponent(opponentId)}`
}

export default function LeaguesView() {
  const { leagues, games } = useOutletContext<DashboardContext>()
  const weekLive = games.some((game) => game.status === 'live')

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
                      {pair.away ? (
                        <Link
                          className="matchup-open"
                          to={matchupPath(pair.home.id, pair.away.id)}
                          aria-label={`Head-to-head: ${pair.home.name} vs ${pair.away.name}`}
                        />
                      ) : null}
                      <MatchupScoreline
                        teamName={pair.home.name}
                        teamLogoUrl={pair.home.logoUrl}
                        teamTo={teamPath(pair.home.id)}
                        teamMine={homeMine}
                        teamPlace={formatPlacement(pair.home)}
                        opponentName={pair.away?.name ?? 'No matchup'}
                        opponentLogoUrl={pair.away?.logoUrl}
                        opponentTo={pair.away ? teamPath(pair.away.id) : undefined}
                        opponentMine={awayMine}
                        opponentPlace={pair.away ? formatPlacement(pair.away) : undefined}
                        points={pair.home.points}
                        opponentPoints={pair.away?.points}
                        emptyOpponent={!pair.away}
                        started={
                          weekLive ||
                          (pair.home.points ?? 0) !== 0 ||
                          (pair.away?.points ?? 0) !== 0
                        }
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
