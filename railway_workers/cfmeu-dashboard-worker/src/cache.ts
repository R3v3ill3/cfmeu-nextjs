type CacheEntry<T> = {
  value: T
  expiresAt: number
}

class InMemoryTtlCache {
  private store = new Map<string, CacheEntry<unknown>>()
  private maxEntries = 2000 // Increased to handle 1600+ employers safely
  private cleanupInterval = 30_000 // 30 seconds
  private maxCacheSize = 200 * 1024 * 1024 // 200MB max total cache size (safe for 32GB instances)

  constructor() {
    // More aggressive cleanup to prevent memory leaks
    setInterval(() => this.cleanup(), this.cleanupInterval)

    // Force garbage collection hint (Node.js specific)
    if (global.gc) {
      setInterval(() => {
        if (global.gc) global.gc()
      }, 60_000) // Every minute
    }
  }

  private cleanup() {
    const now = Date.now()
    const toDelete: string[] = []
    let totalSize = 0

    // Calculate current cache size and find expired entries
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        toDelete.push(key)
      } else {
        // Rough estimate of entry size
        totalSize += JSON.stringify(entry.value).length * 2 // 2 bytes per char
      }
    }

    // Delete expired entries
    toDelete.forEach(key => this.store.delete(key))

    // If cache is too large, remove oldest entries intelligently
    if (totalSize > this.maxCacheSize || this.store.size > this.maxEntries) {
      const entries = Array.from(this.store.entries())

      // Prioritize keeping frequently accessed patterns (employers, common searches)
      const toRemove = entries
        .sort((a, b) => a[1].expiresAt - b[1].expiresAt) // Remove entries expiring soonest
        .slice(0, Math.min(
          entries.length - Math.floor(this.maxEntries * 0.8), // Keep 80%
          Math.ceil(entries.length * 0.1) // Remove at most 10%
        ))

      toRemove.forEach(([key]) => this.store.delete(key))

      console.log(`🧹 Smart cache cleanup: removed ${toRemove.length} oldest entries, kept ${entries.length - toRemove.length} entries, cache size: ${Math.round(totalSize/1024/1024)}MB`)
    }

    console.log(`🧹 Aggressive cache cleanup: removed ${toDelete.length} expired, size: ${this.store.size}, est: ${Math.round(totalSize/1024/1024)}MB`)

    // Force garbage collection hint
    if (global.gc && this.store.size > this.maxEntries * 0.8) {
      setTimeout(() => global.gc?.(), 1000)
    }
  }

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
    // Evict oldest entries if cache is full
    if (this.store.size >= this.maxEntries) {
      const firstKey = this.store.keys().next().value
      if (firstKey !== undefined) {
        this.store.delete(firstKey)
      }
    }

    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  delete(key: string) {
    this.store.delete(key)
  }

  // Debug method
  getStats() {
    return {
      size: this.store.size,
      maxEntries: this.maxEntries,
      keys: Array.from(this.store.keys())
    }
  }

  // Clear all cache entries (for emergency memory cleanup)
  clear() {
    this.store.clear()
  }
}

export { InMemoryTtlCache }
export const cache = new InMemoryTtlCache()

export function makeCacheKey(prefix: string, scope: string, obj: Record<string, unknown>): string {
  const norm = JSON.stringify(obj, Object.keys(obj).sort())
  return `${prefix}:${scope}:${norm}`
}


