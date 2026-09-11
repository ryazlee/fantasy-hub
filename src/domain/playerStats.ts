import { normalizeTeamAbbr } from './nflTeams'
import type { FantasyRosterPlayer, NFLPlayerWeekStats } from './types'

function count(stats: NFLPlayerWeekStats, key: string): number {
  const value = stats[key]
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
}

function has(stats: NFLPlayerWeekStats, key: string): boolean {
  const value = stats[key]
  return typeof value === 'number' && Number.isFinite(value)
}

function join(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(', ')
}

function groups(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ')
}

function isKicker(position: string): boolean {
  const key = position.trim().toUpperCase()
  return key === 'K' || key === 'PK'
}

function isDefense(position: string): boolean {
  const key = position.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  return key === 'DEF' || key === 'DST' || key === 'D'
}

function passingLine(stats: NFLPlayerWeekStats): string {
  const att = count(stats, 'pass_att')
  const cmp = count(stats, 'pass_cmp')
  const yards = count(stats, 'pass_yd')
  const tds = count(stats, 'pass_td')
  const ints = count(stats, 'pass_int')
  if (att <= 0 && yards === 0 && tds === 0 && ints === 0) return ''
  return join([
    `${cmp}/${att}`,
    `${yards} yds`,
    tds > 0 ? `${tds} TD` : null,
    ints > 0 ? `${ints} INT` : null,
  ])
}

function rushingLine(stats: NFLPlayerWeekStats): string {
  const att = count(stats, 'rush_att')
  const yards = count(stats, 'rush_yd')
  const tds = count(stats, 'rush_td')
  if (att <= 0 && yards === 0 && tds === 0) return ''
  return join([
    att > 0 ? `${att} car` : null,
    `${yards} yds`,
    tds > 0 ? `${tds} TD` : null,
  ])
}

function receivingLine(stats: NFLPlayerWeekStats): string {
  const rec = count(stats, 'rec')
  const yards = count(stats, 'rec_yd')
  const tds = count(stats, 'rec_td')
  if (rec <= 0 && yards === 0 && tds === 0) return ''
  return join([`${rec} rec`, `${yards} yds`, tds > 0 ? `${tds} TD` : null])
}

function kickerLine(stats: NFLPlayerWeekStats): string {
  const fgm = count(stats, 'fgm')
  const fga = count(stats, 'fga')
  const xpm = count(stats, 'xpm')
  const xpa = count(stats, 'xpa')
  const parts: string[] = []
  if (fga > 0 || fgm > 0) parts.push(`${fgm}/${Math.max(fga, fgm)} FG`)
  if (xpa > 0 || xpm > 0) parts.push(`${xpm}/${Math.max(xpa, xpm)} XP`)
  return parts.join(', ')
}

function defenseLine(stats: NFLPlayerWeekStats): string {
  const sacks = count(stats, 'sack')
  const ints = count(stats, 'int')
  const fumbles = count(stats, 'fum_rec')
  const tds = count(stats, 'def_td')
  const blocks = count(stats, 'blk_kick')
  const parts: string[] = []
  if (sacks > 0) parts.push(sacks === 1 ? '1 sack' : `${sacks} sacks`)
  if (ints > 0) parts.push(`${ints} INT`)
  if (fumbles > 0) parts.push(`${fumbles} FR`)
  if (tds > 0) parts.push(`${tds} TD`)
  if (blocks > 0) parts.push(blocks === 1 ? '1 BLK' : `${blocks} BLK`)
  if (has(stats, 'pts_allow')) parts.push(`${count(stats, 'pts_allow')} PA`)
  return parts.join(', ')
}

function skillLine(stats: NFLPlayerWeekStats, position: string): string {
  const pos = position.trim().toUpperCase()
  const passing = passingLine(stats)
  const rushing = rushingLine(stats)
  const receiving = receivingLine(stats)
  const lost = count(stats, 'fum_lost')
  const fumble = lost > 0 ? `${lost} FUM` : ''

  let line = ''
  if (pos === 'QB') line = groups([passing, rushing, receiving])
  else if (pos === 'RB') line = groups([rushing, receiving, passing])
  else if (pos === 'WR' || pos === 'TE') line = groups([receiving, rushing, passing])
  else line = groups([passing, rushing, receiving])

  if (!line) return fumble
  return fumble ? `${line}, ${fumble}` : line
}

export function playerStatLine(
  stats: NFLPlayerWeekStats | undefined,
  position: string,
): string {
  if (!stats) return ''
  if (isKicker(position)) return kickerLine(stats)
  if (isDefense(position)) return defenseLine(stats)
  return skillLine(stats, position)
}

export function statsForPlayer(
  all: Record<string, NFLPlayerWeekStats> | undefined,
  player: Pick<FantasyRosterPlayer, 'canonicalPlayerId' | 'position' | 'proTeam'>,
): NFLPlayerWeekStats | undefined {
  if (!all) return undefined
  const id = player.canonicalPlayerId.trim()
  if (id && all[id]) return all[id]
  if (!isDefense(player.position)) return undefined
  const team = normalizeTeamAbbr(player.proTeam)
  return team ? all[team] : undefined
}
