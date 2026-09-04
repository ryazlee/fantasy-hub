import { useOutletContext } from 'react-router-dom'
import { gameClockLabel, playerInGame, sortGames } from '../../domain/nflGames'
import { formatPoints } from '../../domain/sportDisplay'
import { useSavedConfig } from '../../hooks/useSavedConfig'
import type { DashboardTeam, FantasyRosterPlayer, NFLGame, Sport } from '../../domain/types'
import TeamLogo from '../TeamLogo'
import type { DashboardContext } from './context'
import PlayerLine, { type PlayerLineDetail } from './PlayerLine'
import { visibleRoster } from './roster'

type LivePlayerRow = {
  player: FantasyRosterPlayer
  teamId: string
  teamName: string
  teamPoints?: number
  leagueName: string
  sport: Sport
}

type LiveDisplayRow = {
  rowKey: string
  player: FantasyRosterPlayer
  sport: Sport
  detail: PlayerLineDetail[]
  detailTo?: string
  pointsLabel?: string
}

function playerMergeKey(player: FantasyRosterPlayer): string {
  const id = player.canonicalPlayerId.trim()
  if (id) return `id:${id}`
  return `fb:${player.name.trim().toLowerCase()}|${player.proTeam.trim().toUpperCase()}|${player.position.trim().toUpperCase()}`
}

function uniqueTeams(rows: LivePlayerRow[]): LivePlayerRow[] {
  const seen = new Set<string>()
  const out: LivePlayerRow[] = []
  for (const row of rows) {
    if (seen.has(row.teamId)) continue
    seen.add(row.teamId)
    out.push(row)
  }
  return out
}

function teamDetailLabel(row: LivePlayerRow, teams: LivePlayerRow[]): string {
  const clash = teams.filter((team) => team.teamName === row.teamName).length > 1
  const name = clash ? `${row.teamName} (${row.leagueName})` : row.teamName
  return `${name} ${formatPoints(row.teamPoints)}`
}

function teamDetailTo(teamId: string): string | undefined {
  if (!teamId || teamId.startsWith('opp:')) return undefined
  return `/team/${encodeURIComponent(teamId)}`
}

function mergedPointsLabel(rows: LivePlayerRow[]): string | undefined {
  const labels = [...new Set(rows.map((row) => formatPoints(row.player.points)))]
  if (labels.length <= 1) return undefined
  return labels
    .slice()
    .sort((a, b) => Number(b) - Number(a))
    .join(' / ')
}

function collectGamePlayers(
  teams: DashboardTeam[],
  game: NFLGame,
  showBench: boolean,
  showOpponents: boolean,
): LivePlayerRow[] {
  const rows: LivePlayerRow[] = []
  for (const row of teams) {
    const yours = visibleRoster(row.roster, row.league.sport, showBench).filter((player) =>
      playerInGame(player, game),
    )
    for (const player of yours) {
      rows.push({
        player,
        teamId: row.team.id,
        teamName: row.team.name,
        teamPoints: row.matchup?.points,
        leagueName: row.league.name,
        sport: row.league.sport,
      })
    }
    if (!showOpponents) continue
    const opps = visibleRoster(row.opponentRoster, row.league.sport, showBench).filter((player) =>
      playerInGame(player, game),
    )
    const oppTeamId = row.matchup?.opponentTeamId
    for (const player of opps) {
      rows.push({
        player,
        teamId: oppTeamId ?? `opp:${row.team.id}`,
        teamName: row.opponentName ?? 'Opponent',
        teamPoints: row.matchup?.opponentPoints,
        leagueName: row.league.name,
        sport: row.league.sport,
      })
    }
  }
  return rows
}

function mergeLivePlayers(rows: LivePlayerRow[]): LiveDisplayRow[] {
  const buckets = new Map<string, LivePlayerRow[]>()
  for (const row of rows) {
    const key = playerMergeKey(row.player)
    const list = buckets.get(key) ?? []
    list.push(row)
    buckets.set(key, list)
  }

  return [...buckets.entries()].map(([key, list]) => {
    const representative = list.reduce((best, row) =>
      (row.player.points ?? 0) > (best.player.points ?? 0) ? row : best,
    )
    const teams = uniqueTeams(list)
    const detail: PlayerLineDetail[] = teams.map((team) => ({
      label: teamDetailLabel(team, teams),
      to: teamDetailTo(team.teamId),
    }))
    const injuryStatus = list.find((row) => row.player.injuryStatus)?.player.injuryStatus
    return {
      rowKey: key,
      player: {
        ...representative.player,
        starter: list.some((row) => row.player.starter),
        points: representative.player.points,
        injuryStatus,
      },
      sport: representative.sport,
      detail,
      detailTo: detail.length === 1 ? detail[0].to : undefined,
      pointsLabel: mergedPointsLabel(list),
    }
  })
}

function sortLivePlayers(rows: LiveDisplayRow[]): LiveDisplayRow[] {
  return rows.slice().sort(
    (a, b) =>
      (b.player.points ?? 0) - (a.player.points ?? 0) || a.player.name.localeCompare(b.player.name),
  )
}

export default function LiveView() {
  const { teams, games } = useOutletContext<DashboardContext>()
  const prefs = useSavedConfig().prefs
  const slate = sortGames(games)

  if (slate.length === 0) {
    return <p className="notice">No NFL games on the board right now.</p>
  }

  return (
    <section className="stack">
      {slate.map((game) => {
        const players = sortLivePlayers(
          mergeLivePlayers(collectGamePlayers(teams, game, prefs.showBench, prefs.showOpponents)),
        )

        return (
          <article
            key={game.id}
            className={game.status === 'live' ? 'game-card game-card--live' : 'game-card'}
          >
            <div className="game-card__head">
              <p className="game-card__score">
                <span className="game-card__team">
                  <TeamLogo abbr={game.away.abbr} />
                  {game.away.abbr}
                  {game.away.score != null ? ` ${game.away.score}` : ''}
                </span>
                <span className="game-card__at">@</span>
                <span className="game-card__team">
                  <TeamLogo abbr={game.home.abbr} />
                  {game.home.abbr}
                  {game.home.score != null ? ` ${game.home.score}` : ''}
                </span>
              </p>
              <p className="game-card__clock">
                {game.status === 'live' ? <span className="live-dot">Live</span> : null}
                {gameClockLabel(game)}
              </p>
            </div>

            {players.length === 0 ? (
              <p className="game-card__empty">No rostered players in this game</p>
            ) : (
              <div className="game-card__players">
                {players.map((row) => (
                  <PlayerLine
                    key={row.rowKey}
                    player={row.player}
                    games={games}
                    detail={row.detail}
                    detailTo={row.detailTo}
                    pointsLabel={row.pointsLabel}
                    highlightLive={prefs.highlightLive}
                    showGame={false}
                    sport={row.sport}
                  />
                ))}
              </div>
            )}
          </article>
        )
      })}
    </section>
  )
}
