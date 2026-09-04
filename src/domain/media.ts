import { normalizeTeamAbbr } from './nflTeams'
import type { Sport } from './types'

const ESPN_ABBR: Record<string, string> = {
  WAS: 'wsh',
  WSH: 'wsh',
  JAC: 'jax',
  JAX: 'jax',
}

export function nflTeamLogoUrl(abbr: string | undefined): string | undefined {
  const raw = normalizeTeamAbbr(abbr)
  if (!raw) return undefined
  const slug = (ESPN_ABBR[raw] ?? raw).toLowerCase()
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${slug}.png`
}

export function playerPhotoUrl(
  sport: Sport,
  canonicalPlayerId: string,
  position?: string,
  proTeam?: string,
): string | undefined {
  const id = canonicalPlayerId.trim()
  if (!id || id === '0') return undefined
  if (position === 'DEF' || position === 'DST' || /^[A-Z]{2,3}$/.test(id)) {
    return nflTeamLogoUrl(proTeam || id)
  }
  return `https://sleepercdn.com/content/${sport}/players/thumb/${encodeURIComponent(id)}.jpg`
}

export function sleeperAvatarUrl(avatar: string | undefined): string | undefined {
  const value = avatar?.trim()
  if (!value) return undefined
  if (value.startsWith('http')) return value
  return `https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(value)}`
}
