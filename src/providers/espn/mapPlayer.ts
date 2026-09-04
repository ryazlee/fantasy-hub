import type { SleeperPlayer } from '../sleeper/types'
import { normalizeTeamAbbr } from '../../domain/nflTeams'

function normName(value: string): string {
  return value
    .toLowerCase()
    .replace(/d\/st|dst|defense/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function buildEspnIdIndex(catalog: Record<string, SleeperPlayer>): Map<string, string> {
  const index = new Map<string, string>()
  for (const [id, player] of Object.entries(catalog)) {
    const espnId = player.espn_id
    if (espnId == null || espnId === '') continue
    index.set(String(espnId), player.player_id ?? id)
  }
  return index
}

export function resolveEspnCanonicalId(
  espnPlayerId: number,
  name: string,
  position: string,
  proTeam: string,
  catalog: Record<string, SleeperPlayer>,
  byEspnId: Map<string, string>,
): string {
  const fromEspn = byEspnId.get(String(espnPlayerId))
  if (fromEspn) return fromEspn

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
      (position === 'DEF' && (playerPos === 'DEF' || playerPos === 'DST'))
    if (!posOk) continue
    const playerTeam = normalizeTeamAbbr(player.team)
    if (team && playerTeam && playerTeam !== team) continue
    if (match && match !== (player.player_id ?? id)) return ''
    match = player.player_id ?? id
  }
  return match ?? ''
}
