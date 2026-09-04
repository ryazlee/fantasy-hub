import { useOutletContext } from 'react-router-dom'
import { playerHasPlayed, playerIsLive } from '../../domain/nflGames'
import type { FantasyRosterPlayer, NFLGame } from '../../domain/types'
import { providerLabel, sportLabel } from '../../domain/sportDisplay'
import { useSavedConfig } from '../../hooks/useSavedConfig'
import type { DashboardContext } from './context'
import MatchupScoreline from './MatchupScoreline'
import { visibleRoster } from './roster'

function rosterTally(players: FantasyRosterPlayer[], games: NFLGame[]): string {
  const played = players.filter((player) => playerHasPlayed(player, games)).length
  const live = players.filter((player) => playerIsLive(player, games)).length
  return `${played}/${players.length} played · ${live} live`
}

function teamPath(teamId: string): string {
  return `/team/${encodeURIComponent(teamId)}`
}

export default function TeamsView() {
  const { teams, games } = useOutletContext<DashboardContext>()
  const showBench = useSavedConfig().prefs.showBench
  if (teams.length === 0) return null

  return (
    <section className="stack">
      {teams.map((row) => {
        const roster = visibleRoster(row.roster, row.league.sport, showBench)
        const oppRoster = visibleRoster(row.opponentRoster, row.league.sport, showBench)
        const oppId = row.matchup?.opponentTeamId
        const hasOpponent = Boolean(row.matchup && oppId)
        return (
          <article key={row.team.id} className="team-card">
            <p className="team-card__meta">
              {providerLabel(row.league.provider)} · {sportLabel(row.league.sport)} · {row.league.name}
            </p>
            <MatchupScoreline
              teamName={row.team.name}
              teamLogoUrl={row.team.logoUrl}
              teamTo={teamPath(row.team.id)}
              opponentName={hasOpponent ? (row.opponentName ?? 'Opponent') : 'No matchup'}
              opponentLogoUrl={hasOpponent ? row.opponentLogoUrl : undefined}
              opponentTo={hasOpponent && oppId ? teamPath(oppId) : undefined}
              points={row.matchup?.points}
              opponentPoints={hasOpponent ? row.matchup?.opponentPoints : undefined}
              teamTally={rosterTally(roster, games)}
              opponentTally={hasOpponent ? rosterTally(oppRoster, games) : undefined}
              emptyOpponent={!hasOpponent}
            />
          </article>
        )
      })}
    </section>
  )
}
