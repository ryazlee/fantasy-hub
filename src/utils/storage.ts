import type { DashboardView } from '../domain/types'
import {
  defaultEspnSeason,
  parseEspnConnectInput,
  type EspnConnection,
} from '../providers/espn/parse'

export type { EspnConnection }

export type EspnProviderConfig = {
  leagues: EspnConnection[]
}

export type DashboardPrefs = {
  showBench: boolean
  highlightLive: boolean
  showProjections: boolean
  showOpponents: boolean
  refresh: 'auto' | 'manual'
  dashboardView: DashboardView
}

export type SavedDashboard = {
  providers: {
    sleeper?: { username: string; userId: string }
    yahoo?: { session: string }
    espn?: EspnProviderConfig
  }
  prefs: DashboardPrefs
}

const CONFIG_KEY = 'fantasy-hub-config'
const YAHOO_KEY = 'fantasy-hub-yahoo'
const RESEARCH_KEY = 'fantasy-hub-research'

const ALLOWED_RESEARCH_SUBS = new Set([
  'fantasyfootball',
  'nfl',
  'dynastyff',
  'fantasy_football',
  'ffcommish',
  'fantasyfootballers',
])

export type ResearchSort = 'new' | 'relevance' | 'top' | 'hot'

export type ResearchFilters = {
  subs: string[]
  players: string[]
  sort: ResearchSort
}

const DEFAULT_RESEARCH_FILTERS: ResearchFilters = {
  subs: ['fantasyfootball', 'nfl'],
  players: [],
  sort: 'new',
}

function isResearchSort(value: unknown): value is ResearchSort {
  return value === 'new' || value === 'relevance' || value === 'top' || value === 'hot'
}

function normalizeResearchFilters(raw: unknown): ResearchFilters {
  if (!raw || typeof raw !== 'object') {
    return {
      subs: [...DEFAULT_RESEARCH_FILTERS.subs],
      players: [],
      sort: DEFAULT_RESEARCH_FILTERS.sort,
    }
  }
  const value = raw as Record<string, unknown>
  const subs = Array.isArray(value.subs)
    ? value.subs.filter(
        (id): id is string => typeof id === 'string' && ALLOWED_RESEARCH_SUBS.has(id),
      )
    : []
  const players = Array.isArray(value.players)
    ? value.players
        .filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
        .map((name) => name.trim())
        .slice(0, 8)
    : []
  return {
    subs: subs.length ? subs : [...DEFAULT_RESEARCH_FILTERS.subs],
    players,
    sort: isResearchSort(value.sort) ? value.sort : DEFAULT_RESEARCH_FILTERS.sort,
  }
}

export function loadResearchFilters(): ResearchFilters {
  try {
    const raw = localStorage.getItem(RESEARCH_KEY)
    if (!raw) {
      return {
        subs: [...DEFAULT_RESEARCH_FILTERS.subs],
        players: [],
        sort: DEFAULT_RESEARCH_FILTERS.sort,
      }
    }
    return normalizeResearchFilters(JSON.parse(raw))
  } catch {
    return {
      subs: [...DEFAULT_RESEARCH_FILTERS.subs],
      players: [],
      sort: DEFAULT_RESEARCH_FILTERS.sort,
    }
  }
}

export function saveResearchFilters(filters: ResearchFilters): void {
  localStorage.setItem(RESEARCH_KEY, JSON.stringify(normalizeResearchFilters(filters)))
}

const DEFAULT_PREFS: DashboardPrefs = {
  showBench: true,
  highlightLive: true,
  showProjections: true,
  showOpponents: true,
  refresh: 'auto',
  dashboardView: 'teams',
}

function emptyConfig(): SavedDashboard {
  return { providers: {}, prefs: { ...DEFAULT_PREFS } }
}

function isSport(value: unknown): value is EspnConnection['sport'] {
  return value === 'nfl' || value === 'nba' || value === 'mlb' || value === 'nhl'
}

function normalizeEspnLeague(raw: unknown): EspnConnection | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Record<string, unknown>
  const fromUrl =
    typeof value.teamUrl === 'string' ? parseEspnConnectInput(value.teamUrl) : undefined
  const leagueId =
    typeof value.leagueId === 'string' || typeof value.leagueId === 'number'
      ? String(value.leagueId)
      : fromUrl?.leagueId
  if (!leagueId) return undefined
  const seasonRaw = value.season
  const season =
    typeof seasonRaw === 'number'
      ? seasonRaw
      : typeof seasonRaw === 'string' && /^\d+$/.test(seasonRaw)
        ? Number(seasonRaw)
        : (fromUrl?.season ?? defaultEspnSeason())
  const sport = isSport(value.sport) ? value.sport : (fromUrl?.sport ?? 'nfl')
  const teamId =
    typeof value.teamId === 'string' || typeof value.teamId === 'number'
      ? String(value.teamId)
      : fromUrl?.teamId
  return {
    leagueId,
    season,
    sport,
    teamId: teamId || undefined,
    teamUrl: typeof value.teamUrl === 'string' ? value.teamUrl : (fromUrl?.teamUrl ?? ''),
    leagueName: typeof value.leagueName === 'string' ? value.leagueName : undefined,
  }
}

function normalizeEspn(raw: unknown): EspnProviderConfig | undefined {
  if (!raw) return undefined
  if (Array.isArray(raw)) {
    const leagues = raw.map(normalizeEspnLeague).filter((row): row is EspnConnection => Boolean(row))
    return leagues.length ? { leagues } : undefined
  }
  if (typeof raw !== 'object') return undefined
  const value = raw as Record<string, unknown>
  if (Array.isArray(value.leagues)) {
    const leagues = value.leagues
      .map(normalizeEspnLeague)
      .filter((row): row is EspnConnection => Boolean(row))
    return leagues.length ? { leagues } : undefined
  }
  const one = normalizeEspnLeague(raw)
  return one ? { leagues: [one] } : undefined
}

export function loadConfig(): SavedDashboard {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return emptyConfig()
    const parsed = JSON.parse(raw) as Partial<SavedDashboard>
    return {
      providers: {
        ...parsed.providers,
        espn: normalizeEspn(parsed.providers?.espn),
      },
      prefs: { ...DEFAULT_PREFS, ...parsed.prefs },
    }
  } catch {
    return emptyConfig()
  }
}

export function saveConfig(config: SavedDashboard): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  window.dispatchEvent(new Event('fantasy-hub-config'))
}

export function espnLeagues(config: SavedDashboard = loadConfig()): EspnConnection[] {
  return config.providers.espn?.leagues ?? []
}

export function espnLeaguesDetail(leagues: EspnConnection[]): string {
  const names = leagues.map((row) => row.leagueName || `League ${row.leagueId}`)
  if (names.length === 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} · ${names[1]}`
  if (names.length > 2) return `${names.length} leagues`
  return ''
}

export function hasAnyProvider(config: SavedDashboard = loadConfig()): boolean {
  return Boolean(config.providers.sleeper || config.providers.yahoo || espnLeagues(config).length)
}

export function connectSleeper(username: string, userId: string): SavedDashboard {
  const next = loadConfig()
  next.providers.sleeper = { username, userId }
  saveConfig(next)
  return next
}

function sameEspnLeague(a: EspnConnection, b: EspnConnection): boolean {
  return a.leagueId === b.leagueId && a.season === b.season && a.sport === b.sport
}

export function connectEspn(connection: EspnConnection): SavedDashboard {
  const next = loadConfig()
  const leagues = [...espnLeagues(next)]
  const index = leagues.findIndex((row) => sameEspnLeague(row, connection))
  if (index >= 0) leagues[index] = connection
  else leagues.push(connection)
  next.providers.espn = { leagues }
  saveConfig(next)
  return next
}

export function disconnectEspnLeague(leagueId: string, season: number): SavedDashboard {
  const next = loadConfig()
  const leagues = espnLeagues(next).filter(
    (row) => !(row.leagueId === leagueId && row.season === season),
  )
  if (leagues.length) next.providers.espn = { leagues }
  else delete next.providers.espn
  saveConfig(next)
  return next
}

export function disconnectProvider(provider: 'sleeper' | 'yahoo' | 'espn'): SavedDashboard {
  const next = loadConfig()
  delete next.providers[provider]
  saveConfig(next)
  if (provider === 'yahoo') {
    try {
      localStorage.removeItem(YAHOO_KEY)
    } catch {
      // ignore
    }
  }
  return next
}

export function savePrefs(prefs: Partial<DashboardPrefs>): SavedDashboard {
  const next = loadConfig()
  next.prefs = { ...next.prefs, ...prefs }
  saveConfig(next)
  return next
}

export function loadYahooSession(): string | null {
  try {
    return localStorage.getItem(YAHOO_KEY)
  } catch {
    return null
  }
}

export function saveYahooSession(blob: string): void {
  localStorage.setItem(YAHOO_KEY, blob)
  const next = loadConfig()
  next.providers.yahoo = { session: 'connected' }
  saveConfig(next)
}
