type CacheEntry<T> = {
  value: T
  expiresAt: number
}

class InMemoryTtlCache {
  private store = new Map<string, CacheEntry<unknown>>()

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number) {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  delete(key: string) {
    this.store.delete(key)
  }
}

export const cache = new InMemoryTtlCache()

export function makeCacheKey(prefix: string, scope: string, obj: Record<string, unknown>): string {
  const norm = JSON.stringify(obj, Object.keys(obj).sort())
  return `${prefix}:${scope}:${norm}`
}


