import type { FantasyRosterPlayer, NFLGame } from './types'
import { normalizeTeamAbbr } from './nflTeams'

export function gameForProTeam(games: NFLGame[], proTeam: string | undefined): NFLGame | undefined {
  const abbr = normalizeTeamAbbr(proTeam)
  if (!abbr) return undefined
  return games.find(
    (game) =>
      normalizeTeamAbbr(game.home.abbr) === abbr || normalizeTeamAbbr(game.away.abbr) === abbr,
  )
}

export function playerInGame(player: FantasyRosterPlayer, game: NFLGame): boolean {
  const abbr = normalizeTeamAbbr(player.proTeam)
  if (!abbr) return false
  return (
    normalizeTeamAbbr(game.home.abbr) === abbr || normalizeTeamAbbr(game.away.abbr) === abbr
  )
}

export function gameHasStarted(game: NFLGame | undefined): boolean {
  return game?.status === 'live' || game?.status === 'final'
}

export function playerHasPlayed(player: FantasyRosterPlayer, games: NFLGame[]): boolean {
  return gameHasStarted(gameForProTeam(games, player.proTeam))
}

export function anyPlayerHasPlayed(players: FantasyRosterPlayer[], games: NFLGame[]): boolean {
  return players.some((player) => playerHasPlayed(player, games))
}

export function playerIsLive(player: FantasyRosterPlayer, games: NFLGame[]): boolean {
  return gameForProTeam(games, player.proTeam)?.status === 'live'
}

function formatKickoff(startTime: string): string {
  const date = new Date(startTime)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

export function gameClockLabel(game: NFLGame): string {
  if (game.status === 'live') return game.clockLabel ?? 'Live'
  if (game.status === 'final') return 'Final'
  if (!game.startTime) return ''
  return formatKickoff(game.startTime)
}

export function sideScoreText(score: number | undefined, game: NFLGame): string {
  if (!gameHasStarted(game) || score == null) return ''
  return ` ${score}`
}

export function sideHasBall(game: NFLGame, abbr: string | undefined): boolean {
  if (game.status !== 'live' || !game.possessionAbbr) return false
  const team = normalizeTeamAbbr(abbr)
  return Boolean(team) && team === normalizeTeamAbbr(game.possessionAbbr)
}

export function gameScoreLabel(game: NFLGame): string {
  return `${game.away.abbr}${sideScoreText(game.away.score, game)} @ ${game.home.abbr}${sideScoreText(game.home.score, game)}`
}

export function playerGameLabel(game: NFLGame | undefined): string {
  if (!game) return ''
  if (game.status === 'live') return game.clockLabel ?? 'Live'
  if (game.status === 'final') return 'Final'
  return gameClockLabel(game)
}

export function sortGames(games: NFLGame[]): NFLGame[] {
  const rank = { live: 0, scheduled: 1, final: 2 }
  return games.slice().sort((a, b) => {
    const byStatus = rank[a.status] - rank[b.status]
    if (byStatus !== 0) return byStatus
    return a.startTime.localeCompare(b.startTime)
  })
}

export function sumPoints(players: FantasyRosterPlayer[]): number {
  return players.reduce((total, player) => total + (player.points ?? 0), 0)
}
