const SITE_NAME = 'Fantasy Hub'
const SITE_TAGLINE = 'Fantasy Hub: All your fantasy teams. One dashboard.'

function setMeta(attr: 'property' | 'name', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`
  let element = document.querySelector(selector)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attr, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

export function applyShareMeta(title?: string, description?: string) {
  document.title = title?.trim() ? `${title.trim()} · ${SITE_NAME}` : SITE_TAGLINE
  setMeta('property', 'og:title', title?.trim() ? `${title.trim()} · ${SITE_NAME}` : SITE_TAGLINE)
  setMeta('property', 'og:url', `${window.location.origin}${window.location.pathname}`)
  setMeta('name', 'twitter:title', document.title)

  if (description?.trim()) {
    setMeta('property', 'og:description', description.trim())
    setMeta('name', 'twitter:description', description.trim())
    setMeta('name', 'description', description.trim())
  }
}
