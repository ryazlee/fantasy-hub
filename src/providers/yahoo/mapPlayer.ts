import type { SleeperPlayer } from '../sleeper/types'
import { normalizeTeamAbbr } from '../../domain/nflTeams'

function normName(value: string): string {
  return value
    .toLowerCase()
    .replace(/d\/st|dst|defense/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function buildYahooIdIndex(catalog: Record<string, SleeperPlayer>): Map<string, string> {
  const index = new Map<string, string>()
  for (const [id, player] of Object.entries(catalog)) {
    const yahooId = player.yahoo_id
    if (yahooId == null || yahooId === '') continue
    index.set(String(yahooId), player.player_id ?? id)
  }
  return index
}

export function resolveYahooCanonicalId(
  yahooPlayerId: string,
  name: string,
  position: string,
  proTeam: string,
  catalog: Record<string, SleeperPlayer>,
  byYahooId: Map<string, string>,
): string {
  const fromYahoo = byYahooId.get(yahooPlayerId)
  if (fromYahoo) return fromYahoo

  const team = normalizeTeamAbbr(proTeam)
  if ((position === 'DEF' || position === 'DST') && team && catalog[team]) {
    return team
  }

  const needle = normName(name)
  if (!needle) return ''

  let match: string | undefined
  for (const [id, player] of Object.entries(catalog)) {
    const playerName = player.full_name || [player.first_name, player.last_name].filter(Boolean).join(' ')
    if (normName(playerName) !== needle) continue
    const playerPos = (player.position ?? '').toUpperCase()
    const posOk =
      !position ||
      playerPos === position ||
      ((position === 'DEF' || position === 'DST') && (playerPos === 'DEF' || playerPos === 'DST'))
    if (!posOk) continue
    const playerTeam = normalizeTeamAbbr(player.team)
    if (team && playerTeam && playerTeam !== team) continue
    if (match && match !== (player.player_id ?? id)) return ''
    match = player.player_id ?? id
  }
  return match ?? ''
}
