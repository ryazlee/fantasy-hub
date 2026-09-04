import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import AppHeader from '../AppHeader'
import { applyShareMeta } from '../../utils/shareMeta'

export default function PlayerScreen() {
  useEffect(() => {
    applyShareMeta('Player')
  }, [])

  return (
    <div className="app-shell">
      <AppHeader title="Player" />
      <main className="app-main">
        <div className="shell-inner page-stack">
          <p className="notice">
            <Link to="/dashboard">← Your teams</Link>
          </p>
          <p className="notice">
            Cross-league player view lands with the live NFL overlay.
          </p>
        </div>
      </main>
    </div>
  )
}
