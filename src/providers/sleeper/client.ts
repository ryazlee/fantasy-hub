const BASE = 'https://api.sleeper.app/v1'

export class SleeperError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SleeperError'
  }
}

export async function sleeperGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new SleeperError('We could not reach Sleeper. Try again in a moment.')
  }
  const text = await res.text()
  if (!text) {
    return null as T
  }
  return JSON.parse(text) as T
}
