import { useMemo, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { positionTone } from '../../domain/positions'
import { compareSlots } from '../../domain/rosterSlots'
import { formatPoints } from '../../domain/sportDisplay'
import { useSavedConfig } from '../../hooks/useSavedConfig'
import type { DashboardTeam, FantasyRosterPlayer, Sport } from '../../domain/types'
import type { DashboardContext } from './context'
import PlayerLine, { type PlayerLineDetail } from './PlayerLine'
import RosterLines from './RosterLines'
import { compareRosterPlayers } from './roster'

type GroupBy = 'position' | 'fantasy'

type PlayerRow = {
  player: FantasyRosterPlayer
  teamId: string
  teamName: string
  leagueName: string
  sport: Sport
}

type DisplayRow = PlayerRow & {
  rowKey: string
  detail?: string | PlayerLineDetail[]
  detailTo?: string
  pointsLabel?: string
}

function flattenPlayers(teams: DashboardTeam[], showBench: boolean): PlayerRow[] {
  const rows: PlayerRow[] = []
  for (const team of teams) {
    for (const player of team.roster) {
      if (!showBench && !player.starter) continue
      rows.push({
        player,
        teamId: team.team.id,
        teamName: team.team.name,
        leagueName: team.league.name,
        sport: team.league.sport,
      })
    }
  }
  return rows
}

function playerMergeKey(player: FantasyRosterPlayer): string {
  const id = player.canonicalPlayerId.trim()
  if (id) return `id:${id}`
  return `fb:${player.name.trim().toLowerCase()}|${player.proTeam.trim().toUpperCase()}|${player.position.trim().toUpperCase()}`
}

function uniqueTeams(rows: PlayerRow[]): PlayerRow[] {
  const seen = new Set<string>()
  const out: PlayerRow[] = []
  for (const row of rows) {
    if (seen.has(row.teamId)) continue
    seen.add(row.teamId)
    out.push(row)
  }
  return out
}

function teamDetailLabel(row: PlayerRow, teams: PlayerRow[]): string {
  const clash = teams.filter((team) => team.teamName === row.teamName).length > 1
  return clash ? `${row.teamName} (${row.leagueName})` : row.teamName
}

function mergedPointsLabel(rows: PlayerRow[]): string | undefined {
  const labels = [...new Set(rows.map((row) => formatPoints(row.player.points)))]
  if (labels.length <= 1) return undefined
  return labels
    .slice()
    .sort((a, b) => Number(b) - Number(a))
    .join(' / ')
}

function mergeByPlayer(rows: PlayerRow[]): DisplayRow[] {
  const buckets = new Map<string, PlayerRow[]>()
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
      to: `/team/${encodeURIComponent(team.teamId)}`,
    }))
    const injuryStatus = list.find((row) => row.player.injuryStatus)?.player.injuryStatus
    return {
      ...representative,
      rowKey: key,
      player: {
        ...representative.player,
        starter: list.some((row) => row.player.starter),
        points: representative.player.points,
        injuryStatus,
      },
      detail,
      detailTo: detail.length === 1 ? detail[0].to : undefined,
      pointsLabel: mergedPointsLabel(list),
    }
  })
}

function toTeamRows(rows: PlayerRow[]): DisplayRow[] {
  return rows.map((row) => ({
    ...row,
    rowKey: `${row.player.fantasyTeamId}:${row.player.providerPlayerId}`,
  }))
}

function groupKey(row: DisplayRow, by: GroupBy): string {
  if (by === 'fantasy') return row.teamId
  return row.player.position || '—'
}

function groupLabel(row: DisplayRow, by: GroupBy, multiLeague: boolean): string {
  if (by !== 'fantasy') return groupKey(row, by)
  return multiLeague ? `${row.teamName} · ${row.leagueName}` : row.teamName
}

function sortGroupKeys(keys: string[], by: GroupBy, rows: DisplayRow[], multiLeague: boolean): string[] {
  return keys.sort((a, b) => {
    if (by === 'fantasy') {
      const rowA = rows.find((row) => row.teamId === a)
      const rowB = rows.find((row) => row.teamId === b)
      const labelA = rowA ? groupLabel(rowA, by, multiLeague) : a
      const labelB = rowB ? groupLabel(rowB, by, multiLeague) : b
      return labelA.localeCompare(labelB)
    }
    const sport = rows.find((row) => groupKey(row, by) === a)?.sport ?? 'nfl'
    return compareSlots(sport, a, b)
  })
}

export default function PlayersView() {
  const { teams, games } = useOutletContext<DashboardContext>()
  const prefs = useSavedConfig().prefs
  const showBench = prefs.showBench
  const highlightLive = prefs.highlightLive
  const [groupBy, setGroupBy] = useState<GroupBy>('position')

  const groups = useMemo(() => {
    const flat = flattenPlayers(teams, showBench)
    const rows = groupBy === 'position' ? mergeByPlayer(flat) : toTeamRows(flat)
    const multiLeague = new Set(flat.map((row) => row.leagueName)).size > 1
    const buckets = new Map<string, DisplayRow[]>()
    for (const row of rows) {
      const key = groupKey(row, groupBy)
      const list = buckets.get(key) ?? []
      list.push(row)
      buckets.set(key, list)
    }
    for (const list of buckets.values()) {
      if (groupBy === 'fantasy') {
        const sport = list[0]?.sport ?? 'nfl'
        list.sort((a, b) => compareRosterPlayers(sport, a.player, b.player))
      } else {
        list.sort(
          (a, b) =>
            Number(b.player.starter) - Number(a.player.starter) ||
            (b.player.points ?? 0) - (a.player.points ?? 0) ||
            a.player.name.localeCompare(b.player.name),
        )
      }
    }
    const keys = sortGroupKeys([...buckets.keys()], groupBy, rows, multiLeague)
    return keys.map((key) => {
      const groupRows = buckets.get(key) ?? []
      return {
        key,
        label: groupRows[0] ? groupLabel(groupRows[0], groupBy, multiLeague) : key,
        rows: groupRows,
      }
    })
  }, [teams, showBench, groupBy])

  if (teams.length === 0) return null

  return (
    <section className="stack">
      <div className="chips chips--sub" role="group" aria-label="Group players">
        <button
          type="button"
          className={groupBy === 'position' ? 'chip chip--on' : 'chip'}
          aria-pressed={groupBy === 'position'}
          onClick={() => setGroupBy('position')}
        >
          Position
        </button>
        <button
          type="button"
          className={groupBy === 'fantasy' ? 'chip chip--on' : 'chip'}
          aria-pressed={groupBy === 'fantasy'}
          onClick={() => setGroupBy('fantasy')}
        >
          Fantasy team
        </button>
      </div>

      {groups.map((group) => (
        <div key={group.key} className="roster-group">
          <p
            className={['roster-group__label', groupBy === 'position' ? positionTone(group.key) : '']
              .filter(Boolean)
              .join(' ')}
          >
            {groupBy === 'fantasy' && group.rows[0] ? (
              <Link className="roster-group__team" to={`/team/${encodeURIComponent(group.rows[0].teamId)}`}>
                {group.label}
              </Link>
            ) : (
              group.label
            )}
          </p>
          <RosterLines
            items={group.rows}
            isStarter={(row) => row.player.starter}
            itemKey={(row) => row.rowKey}
            render={(row) => (
              <PlayerLine
                player={row.player}
                games={games}
                detail={groupBy === 'position' ? row.detail : undefined}
                detailTo={groupBy === 'position' ? row.detailTo : undefined}
                pointsLabel={row.pointsLabel}
                sport={row.sport}
                highlightLive={highlightLive}
              />
            )}
          />
        </div>
      ))}
    </section>
  )
}
