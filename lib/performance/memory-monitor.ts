/**
 * Memory Monitor Utility
 *
 * Provides memory leak detection and monitoring capabilities for the CFMEU platform.
 * Helps identify memory-intensive components and potential leaks in long-running sessions.
 */

export interface MemoryStats {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  timestamp: number
}

export interface MemoryLeakDetection {
  isLeaking: boolean
  growthRate: number
  samples: MemoryStats[]
  recommendation: string
}

export interface MemoryMonitorOptions {
  enabled?: boolean
  sampleInterval?: number
  maxSamples?: number
  alertThreshold?: number // MB
  leakDetectionWindow?: number // samples
}

class MemoryMonitor {
  private enabled: boolean
  private sampleInterval: number
  private maxSamples: number
  private alertThreshold: number
  private leakDetectionWindow: number
  private samples: MemoryStats[] = []
  private intervalId: NodeJS.Timeout | null = null
  private listeners: ((stats: MemoryStats) => void)[] = []
  private leakListeners: ((detection: MemoryLeakDetection) => void)[] = []

  constructor(options: MemoryMonitorOptions = {}) {
    this.enabled = options.enabled ?? process.env.NODE_ENV === 'development'
    this.sampleInterval = options.sampleInterval ?? 30000 // 30 seconds
    this.maxSamples = options.maxSamples ?? 100
    this.alertThreshold = options.alertThreshold ?? 100 // 100MB
    this.leakDetectionWindow = options.leakDetectionWindow ?? 10
  }

  /**
   * Start monitoring memory usage
   */
  start(): void {
    if (!this.enabled || !this.isSupported()) {
      return
    }

    if (this.intervalId) {
      this.stop()
    }

    this.intervalId = setInterval(() => {
      this.sampleMemory()
    }, this.sampleInterval)

    console.log('🧠 Memory monitoring started')
  }

  /**
   * Stop monitoring memory usage
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('🧠 Memory monitoring stopped')
    }
  }

  /**
   * Check if memory monitoring is supported
   */
  isSupported(): boolean {
    return typeof performance !== 'undefined' &&
           'memory' in performance &&
           performance.memory !== undefined
  }

  /**
   * Get current memory statistics
   */
  getCurrentStats(): MemoryStats | null {
    if (!this.isSupported()) {
      return null
    }

    const memory = (performance as any).memory
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: Date.now()
    }
  }

  /**
   * Sample memory usage and notify listeners
   */
  private sampleMemory(): void {
    const stats = this.getCurrentStats()
    if (!stats) return

    // Add to samples array
    this.samples.push(stats)

    // Limit sample size
    if (this.samples.length > this.maxSamples) {
      this.samples = this.samples.slice(-this.maxSamples)
    }

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(stats)
      } catch (error) {
        console.error('Memory monitor listener error:', error)
      }
    })

    // Check for memory leaks
    this.detectMemoryLeaks()

    // Check for high memory usage
    const usedMB = stats.usedJSHeapSize / (1024 * 1024)
    if (usedMB > this.alertThreshold) {
      console.warn(`⚠️ High memory usage detected: ${usedMB.toFixed(2)}MB`)
      this.suggestCleanup()
    }
  }

  /**
   * Detect potential memory leaks
   */
  private detectMemoryLeaks(): void {
    if (this.samples.length < this.leakDetectionWindow) {
      return
    }

    const recentSamples = this.samples.slice(-this.leakDetectionWindow)
    const oldestSample = recentSamples[0]
    const newestSample = recentSamples[recentSamples.length - 1]

    // Calculate growth rate (MB per minute)
    const timeDiffMinutes = (newestSample.timestamp - oldestSample.timestamp) / (1000 * 60)
    const sizeDiffMB = (newestSample.usedJSHeapSize - oldestSample.usedJSHeapSize) / (1024 * 1024)
    const growthRate = timeDiffMinutes > 0 ? sizeDiffMB / timeDiffMinutes : 0

    // Check if growth rate suggests a leak
    const isLeaking = growthRate > 5 // Growing more than 5MB per minute

    if (isLeaking) {
      const detection: MemoryLeakDetection = {
        isLeaking,
        growthRate,
        samples: recentSamples,
        recommendation: this.getLeakRecommendation(growthRate)
      }

      this.leakListeners.forEach(listener => {
        try {
          listener(detection)
        } catch (error) {
          console.error('Memory leak listener error:', error)
        }
      })

      console.error(`🚨 Potential memory leak detected! Growth rate: ${growthRate.toFixed(2)}MB/min`)
      console.error(`Recommendation: ${detection.recommendation}`)
    }
  }

  /**
   * Get recommendation for memory leak based on growth rate
   */
  private getLeakRecommendation(growthRate: number): string {
    if (growthRate > 20) {
      return 'Critical memory leak detected. Check for unclosed intervals, event listeners, or large object allocations.'
    } else if (growthRate > 10) {
      return 'Significant memory growth detected. Review component cleanup and resource management.'
    } else {
      return 'Mild memory growth detected. Consider optimizing component lifecycle and cleanup.'
    }
  }

  /**
   * Suggest cleanup actions
   */
  private suggestCleanup(): void {
    // Trigger garbage collection if available
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as any).gc()
        console.log('🧹 Forced garbage collection')
      } catch (error) {
        // Silently ignore if gc is not available
      }
    }

    // Suggest cleanup to listeners
    this.listeners.forEach(listener => {
      try {
        const stats = this.getCurrentStats()
        if (stats) {
          listener({ ...stats, timestamp: stats.timestamp - 1 }) // Trigger cleanup signal
        }
      } catch (error) {
        // Ignore errors
      }
    })
  }

  /**
   * Add memory stats listener
   */
  addListener(listener: (stats: MemoryStats) => void): () => void {
    this.listeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Add memory leak detection listener
   */
  addLeakListener(listener: (detection: MemoryLeakDetection) => void): () => void {
    this.leakListeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = this.leakListeners.indexOf(listener)
      if (index > -1) {
        this.leakListeners.splice(index, 1)
      }
    }
  }

  /**
   * Get memory usage report
   */
  getReport(): {
    current: MemoryStats | null
    peak: MemoryStats | null
    average: number
    trend: 'increasing' | 'decreasing' | 'stable'
    samples: MemoryStats[]
  } {
    if (this.samples.length === 0) {
      return {
        current: null,
        peak: null,
        average: 0,
        trend: 'stable',
        samples: []
      }
    }

    const current = this.samples[this.samples.length - 1]
    const peak = this.samples.reduce((max, sample) =>
      sample.usedJSHeapSize > max.usedJSHeapSize ? sample : max
    )

    const average = this.samples.reduce((sum, sample) =>
      sum + sample.usedJSHeapSize, 0
    ) / this.samples.length

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable'
    if (this.samples.length >= 3) {
      const recent = this.samples.slice(-3)
      const first = recent[0].usedJSHeapSize
      const last = recent[recent.length - 1].usedJSHeapSize
      const change = (last - first) / first

      if (change > 0.1) trend = 'increasing'
      else if (change < -0.1) trend = 'decreasing'
    }

    return {
      current,
      peak,
      average: average / (1024 * 1024), // Convert to MB
      trend,
      samples: [...this.samples]
    }
  }

  /**
   * Clear all samples
   */
  clearSamples(): void {
    this.samples = []
    console.log('🧠 Memory samples cleared')
  }
}

// Global memory monitor instance
export const memoryMonitor = new MemoryMonitor({
  enabled: process.env.NODE_ENV === 'development',
  sampleInterval: 30000,
  alertThreshold: 100,
  leakDetectionWindow: 10
})

// Auto-start in development
if (process.env.NODE_ENV === 'development') {
  memoryMonitor.start()
}

export default memoryMonitor