import { useEffect, useState } from 'react'
import { loadConfig, type SavedDashboard } from '../utils/storage'

export function useSavedConfig(): SavedDashboard {
  const [config, setConfig] = useState(loadConfig)

  useEffect(() => {
    function sync() {
      setConfig(loadConfig())
    }
    window.addEventListener('fantasy-hub-config', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('fantasy-hub-config', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return config
}
