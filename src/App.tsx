import { useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { ThemeProvider } from './theme'
import { trackPageview } from './utils/analytics'
import LandingScreen from './components/screens/LandingScreen'
import DashboardScreen from './components/screens/DashboardScreen'
import TeamsView from './components/dashboard/TeamsView'
import PlayersView from './components/dashboard/PlayersView'
import MatchupsView from './components/dashboard/MatchupsView'
import LeaguesView from './components/dashboard/LeaguesView'
import LiveView from './components/dashboard/LiveView'
import ResearchView from './components/dashboard/ResearchView'
import TeamScreen from './components/screens/TeamScreen'
import PlayerScreen from './components/screens/PlayerScreen'
import SettingsScreen from './components/screens/SettingsScreen'
import YahooCallbackScreen from './components/screens/YahooCallbackScreen'

function getRouterBasename(): string {
  const base = import.meta.env.BASE_URL
  return base.endsWith('/') ? base.slice(0, -1) : base
}

function RouteAnalytics() {
  const location = useLocation()

  useEffect(() => {
    trackPageview()
  }, [location.pathname])

  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter basename={getRouterBasename() || undefined}>
          <RouteAnalytics />
          <Routes>
            <Route path="/" element={<LandingScreen />} />
            <Route path="/dashboard" element={<DashboardScreen />}>
              <Route index element={<TeamsView />} />
              <Route path="players" element={<PlayersView />} />
              <Route path="matchups" element={<MatchupsView />} />
              <Route path="leagues" element={<LeaguesView />} />
              <Route path="live" element={<LiveView />} />
              <Route path="research" element={<ResearchView />} />
            </Route>
            <Route path="/team/:teamId" element={<TeamScreen />} />
            <Route path="/player/:playerId" element={<PlayerScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="/yahoo/callback" element={<YahooCallbackScreen />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
