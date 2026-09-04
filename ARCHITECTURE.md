# Fantasy Hub Architecture

Read-only dashboard that aggregates a user's fantasy leagues (Sleeper, Yahoo, ESPN) into one place.

> Connect leagues → open one dashboard → see how everything is doing right now.

**Success:** a user opens the site on game day and understands their full fantasy situation in under 10 seconds.

Stack, chrome, and folders follow [`../dev-guide`](../dev-guide). Copy structure from the reference apps — not from product-specific feature code.

---

## Product

**Does:** live scores, rosters, matchups, and which players matter right now across every connected league.

**Does not:** roster changes, waivers, trades, lineups, advice, accounts, ads, social, gambling, DFS, or notifications.

**Principles:** no user accounts, read-only, fast, mobile-first, game-day first.

**v1 sport:** football (`nfl`). Leagues / teams / rosters are sport-keyed so other fantasy sports can ship later without a rewrite. **Live games are football-only for now** — no generic live-sports adapter.

---

## Stack (locked)

Decision tree: **plannr-shaped web tool** (GitHub Pages) plus a **tiny secrets proxy** for Yahoo only. Not Express. Not hosting the SPA on a PaaS.

| Layer | Choice | Why / reference |
|---|---|---|
| UI | Vite + React 19 + TypeScript `strict` | Default for every new web app |
| Visual | Semantic CSS + Tailwind 4 `@theme inline` tokens | **plannr** — not MUI |
| Router | React Router 7 `BrowserRouter` + `basename` from `import.meta.env.BASE_URL` | plannr |
| Data | TanStack Query + `hooks/queryKeys.ts` + services | Networked tool |
| Validation | Zod where we parse provider JSON | Client + Yahoo worker |
| Lint | oxlint (`"lint": "oxlint"`) | Not ESLint |
| Package | npm + `package-lock.json` | `"build": "tsc -b && vite build"` |
| Icons | lucide-react (16px in buttons) | plannr |
| Analytics | GoatCounter | Every public site |
| Hosting | GitHub Pages (SPA) + Cloudflare Worker (Yahoo) | Pages cannot hold OAuth secrets or bypass Yahoo CORS |

Do **not** use Next.js, CRA, HashRouter, MUI, Express, or Tailwind utility soup.

Vercel / Netlify functions would work the same. Cloudflare Worker is the least ceremony: one file, free `*.workers.dev` HTTPS URL, no “don’t build the Vite app” project, doesn’t sleep. Don’t stand up Render/Express for this.

### What talks to what

```
Browser (localStorage + TanStack Query)
    │
    ▼
Vite SPA  →  GitHub Pages   https://ryazlee.github.io/fantasy-hub/
    │
    ├── Sleeper API          (direct, CORS-open)
    ├── NFL scoreboard       (direct)
    ├── ESPN fantasy         (direct if CORS allows)
    └── Yahoo worker         https://fantasy-hub.<account>.workers.dev
            │
            ├── /auth  /callback
            └── /yahoo/*  →  fantasysports.yahooapis.com
```

Sleeper, NFL, and ESPN stay in the browser. Yahoo never does — no client secret in the bundle, no browser calls to `yahooapis.com` (no CORS).

Screens still never `fetch` provider URLs; **hooks → services → adapters**.

### Deploy (two pipelines, one repo)

**Frontend → GitHub Pages** (copy **plannr**)

- Vite `base: '/fantasy-hub/'`
- `BrowserRouter` basename from `import.meta.env.BASE_URL`
- Vite plugin copies `index.html` → `404.html`
- `.github/workflows/deploy.yaml` — `npm ci` + `npm run build`, `actions/upload-pages-artifact` (`dist`), `actions/deploy-pages`. Node 20.

**Yahoo shim → Cloudflare Worker** (not the UI)

- Same repo, `worker/` + `wrangler.toml`. `npx wrangler deploy`.
- Secrets: `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`, `YAHOO_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY`, `FRONTEND_ORIGIN` (`https://ryazlee.github.io`)
- Yahoo Developer app redirect URI: `https://fantasy-hub.<account>.workers.dev/callback` (HTTPS required)
- SPA knows the shim via `VITE_YAHOO_API_URL`

Pages is the product origin. The worker is Yahoo-only.

### Yahoo auth flow

Do **not** use cookies on the worker origin. Pages → worker is cross-site; Safari will drop those cookies.

1. User clicks **Connect Yahoo**. SPA sends the browser to `VITE_YAHOO_API_URL/auth` (CSRF `state` on the worker).
2. Yahoo authorizes, redirects to the worker `/callback?code=…&state=…`.
3. Worker exchanges `code` for tokens **using the client secret**, encrypts the token payload with `TOKEN_ENCRYPTION_KEY`, 302s to:

   `https://ryazlee.github.io/fantasy-hub/yahoo/callback#session=<opaque blob>`

4. SPA route `/yahoo/callback` reads the hash, stores the blob in `localStorage` (`fantasy-hub-yahoo`), strips the hash, routes to the dashboard.
5. Yahoo adapter calls the worker `/yahoo/…` with the blob. Worker decrypts, refreshes if needed, hits Yahoo, returns **domain JSON** (not XML). If tokens rotate, return the new blob so the SPA can save it.
6. Disconnect deletes `fantasy-hub-yahoo` from localStorage.

The SPA never sees `client_secret`, access tokens, or refresh tokens in plaintext. The blob is a bearer session — stealing it is as bad as stealing a cookie; HTTPS + same-origin Pages storage is enough for v1.

Analytics: `/yahoo/callback` only. Never send the hash.

---

## Folder layout

**plannr** SPA plus one Cloudflare Worker that only exists for Yahoo.

```
src/                              # Vite app → GitHub Pages
  components/
    screens/                      # Landing, Dashboard, Team, Player, Settings, YahooCallback
    AppHeader.tsx Button.tsx ThemeToggle.tsx SectionCard.tsx MakerCredit.tsx
  hooks/
  services/
  providers/
    sleeper/
    yahoo/                        # talks to the worker, not yahooapis.com
    espn/
    nfl/
  domain/
  utils/
  lib/
  theme.tsx
  index.css
  App.tsx
  main.tsx

worker/                           # Cloudflare Worker
  index.ts                        # /auth  /callback  /yahoo/*
wrangler.toml
```

Data flow: **screens → hooks → services → adapters → `fetch`**. Yahoo adapter `fetch`es the worker. No raw `fetch` in components. No provider types in the UI.

---

## Persistence

No database. No Fantasy Hub accounts. No cookies (Safari would eat worker cookies from Pages anyway).

| What | Where |
|---|---|
| Sleeper username, ESPN team URL, selected leagues, dashboard prefs | `localStorage` `fantasy-hub-config` |
| Theme | `localStorage` `fantasy-hub-theme` (`'light' \| 'dark'`) |
| Yahoo session | `localStorage` `fantasy-hub-yahoo` — **opaque encrypted blob**, not raw tokens |
| Player ID maps | static data in-repo, **per sport** |

This is **not** a shareable URL-hash tool. The Yahoo callback hash is a one-shot handoff, then stripped. Do not put connection state in the shareable URL.

Disconnecting a provider clears only that provider's local config.

---

## UI system

Copy chrome from **plannr**, not a one-off header. Shared gray family: light `#fafafa`, dark `#09090b`. Brand chrome stays gray. Color is only semantic (winning / live / danger).

Canonical tokens (do not invent a palette):

| Token | Light | Dark |
|---|---|---|
| `--text` | `#111827` | `#f4f4f5` |
| `--text-secondary` | `#4b5563` | `#a1a1aa` |
| `--text-muted` | `#9ca3af` | `#71717a` |
| `--bg` | `#fafafa` | `#09090b` |
| `--surface` | `#ffffff` | `#141416` |
| `--inset` | `#f3f4f6` | `#1c1c1f` |
| `--border` | `#e5e7eb` | `#27272a` |
| `--accent` | `#111827` | `#fafafa` |
| `--accent-contrast` | `#ffffff` | `#09090b` |
| `--link` | `#2563eb` | `#8cb4ff` |
| `--danger` | `#dc2626` | `#fb7185` |
| `--success` | `#059669` | `#4ade80` |

Layout: `--radius: 12px`, button radius `10px`, `--touch-min: 44px`, system font stack. `--content-max: 720px` (narrow product — phone-first game day). Landing can sit tighter inside that.

Shell:

```
.app-shell          min-height: 100svh; flex column
  AppHeader         sticky, translucent + backdrop; brand is a home Link; ThemeToggle
  .app-main         flex 1
    .shell-inner    max-width: var(--content-max); padding 1rem
```

- `#root` and `.app-shell` are `min-height: 100svh`
- `body { overscroll-behavior-y: none }`
- `button, input, textarea { font: inherit }`
- Named classes in `index.css` (`app-shell`, `btn`, `surface-card`, `section-label`) — not `flex` / `p-4` / `text-sm` as the UI language
- Section titles: sentence-case `.section-label`, not uppercase kickers
- Inputs: inset fill, no border, 10px radius, 44px min-height, 2px accent focus ring
- Cards: `1px solid var(--border)`, `var(--surface)`, `var(--radius)`

### Theme

Copy `theme.tsx` from plannr. Storage key `fantasy-hub-theme`. Load: saved → `prefers-color-scheme: dark` → `'light'`. Apply `html.theme-dark` + `meta[name=theme-color]` (`#09090b` / `#fafafa`). FOUC inline script in `index.html` reads the same key. Circular 44×44 `.theme-toggle` (no border, ☀️/🌙).

### Maker credit

`MakerCredit` on **LandingScreen only**: `made by @ryab 🐸`, `@ryab` → `https://ryazlee.github.io/contact`. Not in `AppHeader`, not on dashboard / team / player.

### Page head

plannr-shaped `index.html`: `favicon.png`, apple-touch-icon, `og.png` **1200×1200** at `https://ryazlee.github.io/fantasy-hub/og.png`, `og:site_name`, twitter `summary`. Title: `Fantasy Hub: All your fantasy teams. One dashboard.` Home; `Name · Fantasy Hub` on inner routes (`utils/shareMeta.ts`).

### Analytics

GoatCounter `https://ryab.goatcounter.com/count`. `window.goatcounter = { no_onload: true }` before `count.js`. `src/utils/analytics.ts` `trackPageview()` in try/catch. `RouteAnalytics` inside `BrowserRouter`. Strip hashes and any token-like query params.

### Provider tree

```
QueryClientProvider → ThemeProvider → BrowserRouter → RouteAnalytics → Routes → *Screen
```

```ts
// lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 10 * 60_000, retry: 1 },
  },
})
```

Live score queries override `staleTime` / `refetchInterval` in the hook — not globally.

---

## Sport

Fantasy platforms already multi-sport. We follow them: **sport is a field, not a fork of the app.**

```ts
type Sport = 'nfl' | 'nba' | 'mlb' | 'nhl'
```

Extend the union when a real adapter exists. Do not invent a plugin system.

| Sport-agnostic now | Football-only for now |
|---|---|
| League / team / roster / matchup | Live games, clocks, box scores |
| Fantasy provider adapters | NFL live adapter |
| Provider-reported fantasy points | Who Matters clocks + game highlighting |
| `sport` on each league | NFL scoreboard UI |

If a connected account also has an NBA league, still show it: Sleeper already returns that league's points. No live clock or game slate for non-NFL until we add one.

UI does not `switch (sport)` except in tiny display helpers (`utils/sportDisplay.ts`, `domain/rosterSlots.ts`). Screens stay generic. The NFL live adapter is allowed to be football-shaped.

---

## Domain

Providers map into `domain/types.ts`. IDs stay prefixed (`sleeper:`, `yahoo:`, `espn:`).

```ts
type ProviderName = 'sleeper' | 'yahoo' | 'espn'

interface FantasyLeague {
  id: string                  // `${provider}:${providerLeagueId}`
  provider: ProviderName
  name: string
  sport: Sport
  season: number
  scoringPeriod: number       // NFL week; other sports: platform scoring period
  teamCount: number
  scoring: FantasyScoringSettings
}

interface FantasyTeam {
  id: string                  // `${provider}:${providerTeamId}`
  leagueId: string
  name: string
  ownerName?: string
  logoUrl?: string
}

interface FantasyMatchup {
  leagueId: string
  scoringPeriod: number
  teamId: string
  opponentTeamId: string
  points: number
  opponentPoints: number
  projectedPoints?: number
  opponentProjectedPoints?: number
}

interface FantasyRosterPlayer {
  providerPlayerId: string
  canonicalPlayerId: string   // Sleeper player ID, in that sport's catalog
  fantasyTeamId: string
  leagueId: string
  name: string
  position: string            // provider position, e.g. WR or PG
  rosterSlot: string          // provider slot, e.g. FLEX or BN
  proTeam: string             // MIN, LAL, NYY — not sport-prefixed
  starter: boolean
  points?: number             // provider-reported live points
  projectedPoints?: number
}
```

```ts
interface FantasyProvider {
  getLeagues(): Promise<FantasyLeague[]>
  getTeams(leagueId: string): Promise<FantasyTeam[]>
  getMatchups(leagueId: string, scoringPeriod: number): Promise<FantasyMatchup[]>
  getRoster(leagueId: string, teamId: string): Promise<FantasyRosterPlayer[]>
}
```

Adapters implement this in the SPA (Yahoo via the worker). Failures are typed and isolated — a down Yahoo/ESPN adapter must not blank the dashboard.

Roster grouping is “starters, then bench,” ordered by `slotOrder(sport)`. Unknown slots keep provider order. Do not hardcode `QB | RB | WR` into the type.

---

## Providers

### Sleeper (first, Pages-native)

Username in, no password. Public API from the browser: user → leagues → rosters → matchups → players. Cache the player catalog in memory (and IndexedDB if it gets heavy).

### Yahoo (v1, via Cloudflare Worker)

Official OAuth 2. In v1. The SPA never talks to Yahoo.

Worker CORS allowlist: `http://localhost:*` and `https://ryazlee.github.io`. Proxy is path-allowlisted (no open SSRF). Read-only Yahoo GETs only.

Register the Yahoo app with Fantasy Sports **read** access. Client id/secret live only as worker secrets.

### ESPN (isolated, feature-flaggable)

**Public leagues only.** User pastes their public “My Team” URL; parse **sport** + league ID + team ID from the path; unofficial public API from the browser.

Never ask for ESPN passwords, cookies, `espn_s2`, or `SWID`. Private leagues unsupported. If CORS or the unofficial API is unreliable, disable the adapter — nothing else should care.

### NFL live data (separate from fantasy, football-only)

Fantasy APIs are not the source of truth for game state. This adapter is **NFL, not a generic live-sports layer.**

```ts
interface NFLDataProvider {
  getWeek(season: number, week: number): Promise<NFLGame[]>
  getLiveGames(): Promise<NFLGame[]>
  getPlayerStats(canonicalPlayerIds: string[]): Promise<NFLPlayerStats[]>
}

interface NFLGame {
  id: string
  startTime: string           // ISO
  status: 'scheduled' | 'live' | 'final'
  home: { abbr: string; score?: number }
  away: { abbr: string; score?: number }
  clockLabel?: string         // "Q3 08:32"
}
```

Needs games, status, scores, start times, and box-score player stats. Not play-by-play.

Default candidate: ESPN public scoreboard (`site.api.espn.com`) from the browser + Sleeper NFL player catalog. Do not couple this to the ESPN *fantasy* adapter. If CORS blocks the scoreboard, pick another public source — still no server.

---

## Canonical players

The UI never matches players. **Canonical ID = Sleeper player ID in that sport's catalog.**

```ts
resolveCanonicalPlayer(sport, provider, providerPlayerId) → sleeperPlayerId
```

1. Static mapping table per sport (`yahooId → sleeperId`, `espnId → sleeperId`)
2. Exact match on `(normalized name, position, proTeam)` against that sport's Sleeper catalog
3. Unresolved: still render; they will not join cross-league views

Do not slug names (`player_justin_jefferson`). Do not mix sports — a baseball `123` is not an NFL `123`.

---

## Scoring

**v1: provider-reported live points and projections.** Platforms already apply that league's scoring, whatever the sport.

A local engine (`stats + FantasyScoringSettings → points`) is later and would be sport-specific. Still store `FantasyScoringSettings` on each league so it can land without a model change. Do not type settings as passing / rushing / receiving.

Win probability and projected-finish models are out of v1. If a provider sends projections, label them as projections.

---

## Screens

Four routes. Overlapping ideas (Live Now, Who Matters, My Players) collapse here.

| Route | Screen | Chrome |
|---|---|---|
| `/` | `LandingScreen` | Quiet header optional; **MakerCredit** in the body |
| `/dashboard` | `DashboardScreen` | `AppHeader` + refresh |
| `/team/:teamId` | `TeamScreen` | `AppHeader` |
| `/player/:playerId` | `PlayerScreen` | `AppHeader` |
| `/settings` | `SettingsScreen` | `AppHeader` |
| `/yahoo/callback` | `YahooCallbackScreen` | Transient; no chrome; never analytics-hash |

**Landing** — `All your fantasy teams. One dashboard.` Connect Sleeper / Yahoo / ESPN. No signup.

**Dashboard**

```
Header          Fantasy Hub · Sun, Week 4 · [Refresh] · ThemeToggle
Who Matters     live + soon-to-play players, ranked by # of user's teams
Your Teams      every team, every provider: score, opponent, winning/losing
NFL Games       today's slate; games with rostered players highlighted
```

Header date/period comes from the user's leagues (`sportDisplay`), not a hardcoded “Sunday.”

*Who Matters* is derived from rosters + NFL live state. Non-NFL players can still show provider points; they just won't get a live clock.

**Team** — read-only roster by slot. Points, projection, opponent, game status.

**Player** — live line, box-score stats, game, cross-league ownership.

**Settings** — connected platforms + disconnect, show bench, highlight live, show projections, auto vs manual refresh. No profile.

Provider branding is a quiet label on team cards, not a theme. Sport is a quiet label too when more than one sport is connected.

### Refresh (TanStack Query)

| Data | Cadence |
|---|---|
| Leagues, rosters, settings | `staleTime` minutes; refetch on focus |
| Live scores, stats, clocks | `refetchInterval` ~15–30s when the user has players in active games; 1–5 min otherwise |

Fetch only what the current screen needs. Query keys from `hooks/queryKeys.ts` (`as const`, parametric, include `sport` where it changes the payload). Live hooks override the default 60s `staleTime`.

### Errors

Providers fail independently. Per-provider warning (`ESPN unavailable`); rest of the dashboard stays. User-facing copy only — no raw API errors.

---

## Build order

Each phase should be usable before the next starts.

1. **Skeleton** — Vite + React 19 + TS + oxlint + Tailwind 4 tokens, plannr chrome, theme FOUC, GoatCounter, Pages `base` + `404.html` + deploy workflow, Query client + `queryKeys` + services, `fantasy-hub-config` storage, `LandingScreen`.
2. **Sleeper dashboard** — connect username, leagues, teams, rosters, matchups, `DashboardScreen` + `TeamScreen`. Use Sleeper's own points. Show whatever sports Sleeper returns; don't special-case football in the screens.
3. **Live overlay** — NFL games + stats from the browser, canonical mapping, Who Matters, game highlighting, two-tier refresh.
4. **Yahoo** — Cloudflare Worker (`/auth`, `/callback`, `/yahoo/*`), OAuth, encrypted session blob, same screens.
5. **ESPN** — public team URL, isolated adapter, same screens. Feature-flag if CORS/API is flaky.

A later NBA/MLB/NHL live slice is that sport's adapter — not new screens, and not moving the SPA off Pages.

Assets: `favicon.png`, `og.png` (1200×1200), apple-touch-icon — required before anything is public.

---

## Out of scope (until the core is excellent)

Accounts, database, Express, hosting the SPA on a PaaS, social, chat, advice, rankings, drafts, DFS, betting, news, AI, push/email, win probability, Sunday Mode, injury-alert product, weekly recap, player search as a destination.

Do not build NBA/MLB/NHL live adapters, a generic live-sports interface, IDP, or a custom scoring engine until the football dashboard is excellent.

Later, if the dashboard is already great: richer cross-league player list, injury badges, end-of-Sunday recap, a condensed game-day mode, then notifications, then additional sports' live data.

---

## Non-negotiables

- Read-only. No write APIs to any fantasy platform.
- No Fantasy Hub accounts.
- Frontend on GitHub Pages. The Cloudflare Worker is Yahoo-only (secret + CORS proxy), not the UI host.
- No secrets or raw Yahoo tokens in the browser.
- UI never matches players or branches on provider. Sport branching lives in display helpers, not screens.
- One provider failing never takes down the app.
- ESPN stays behind its adapter and can be turned off.
- Screens → hooks → services → adapters. No fetches in components.
- Semantic CSS against shared tokens. No dark-only Tailwind grays, no MUI.
- `MakerCredit` on landing only.
- The only question v1 must answer well: **how are all my teams doing right now?**
