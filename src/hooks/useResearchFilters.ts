import { useEffect, useState } from 'react'
import { loadResearchFilters, type ResearchFilters } from '../utils/storage'

/** Keeps the Research tab and its overflow menu reading the same stored filters. */
export function useResearchFilters(): ResearchFilters {
  const [filters, setFilters] = useState(loadResearchFilters)

  useEffect(() => {
    function sync() {
      setFilters(loadResearchFilters())
    }
    window.addEventListener('fantasy-hub-research', sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('fantasy-hub-research', sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return filters
}
