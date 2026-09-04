export function yahooMerge(value: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const items = Array.isArray(value) ? value : value != null ? [value] : []
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    Object.assign(out, item)
  }
  return out
}

export function yahooList(value: unknown): unknown[] {
  if (value == null) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object') {
    const rec = value as Record<string, unknown>
    const keys = Object.keys(rec)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b))
    if (keys.length) return keys.map((key) => rec[key])
  }
  return [value]
}

export function yahooResources(collection: unknown, key: string): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  for (const item of yahooList(collection)) {
    const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : {}
    const inner = rec[key] ?? item
    rows.push(yahooMerge(inner))
  }
  return rows.filter((row) => Object.keys(row).length > 0)
}

export function num(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function text(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    if (typeof rec.full === 'string') return rec.full
    if (typeof rec.name === 'string') return rec.name
  }
  return ''
}
