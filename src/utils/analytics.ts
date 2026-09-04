type GoatCounter = {
  count: (vars?: { path?: string; title?: string; event?: boolean; referrer?: string }) => void
}

declare global {
  interface Window {
    goatcounter?: GoatCounter
  }
}

function getPagePath(): string {
  const path = window.location.pathname
  const at = path.lastIndexOf('/yahoo/callback')
  if (at !== -1) {
    return path.slice(0, at + '/yahoo/callback'.length)
  }
  return path
}

export function trackPageview(path = getPagePath()): void {
  try {
    window.goatcounter?.count({ path })
  } catch {
    // Analytics should never break the app.
  }
}
