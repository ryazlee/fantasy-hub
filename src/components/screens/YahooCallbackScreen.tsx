import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { queryKeys } from '../../hooks/queryKeys'
import { queryClient } from '../../lib/queryClient'
import { saveYahooSession } from '../../utils/storage'

export default function YahooCallbackScreen() {
  const navigate = useNavigate()

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(hash)
    const session = params.get('session')
    if (session) {
      saveYahooSession(session)
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    navigate(session ? '/dashboard' : '/', { replace: true })
  }, [navigate])

  return null
}
