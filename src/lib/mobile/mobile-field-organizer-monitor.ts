/**
 * Mobile Field Organizer Performance & Workflow Monitor
 *
 * Specialized monitoring for field organizer workflows including:
 * - GPS/location performance tracking
 * - Photo capture and upload metrics
 * - On-site form completion analytics
 * - Network condition adaptation
 * - Offline-to-online sync performance
 * - Touch interaction optimization for construction site conditions
 */

import { mobilePerformanceMonitor } from './mobile-performance-monitor'
import { isMobile, getDeviceInfo } from '@/lib/device'

interface FieldOrganizerMetrics {
  // Location & GPS metrics
  gpsAccuracy?: number
  locationFetchTime?: number
  geofenceEnterTime?: number
  geofenceExitTime?: number

  // Camera & photo metrics
  photoCaptureTime?: number
  photoUploadTime?: number
  photoCompressionTime?: number
  photoQuality?: number

  // Form interaction metrics
  formCompletionTime?: number
  fieldTouchAccuracy?: number
  keyboardTypeOptimizations?: number
  autoSaveCount?: number

  // Network & sync metrics
  networkSwitchCount?: number
  offlineDuration?: number
  syncQueueSize?: number
  syncSuccessRate?: number

  // Environmental factors
  screenBrightness?: number
  batteryLevel?: number
  deviceTemperature?: number
  ambientLightLevel?: number

  // Workflow efficiency
  taskCompletionRate?: number
  errorRecoveryTime?: number
  userSatisfactionScore?: number

  // Construction site specific
  glovesModeAccuracy?: number
  outdoorReadabilityScore?: number
  rainModeActivations?: number

  timestamp: number
  sessionId: string
  projectId?: string
  taskType?: 'mapping' | 'audit' | 'compliance' | 'discovery'
}

interface WorkflowEvent {
  type: 'gps_start' | 'gps_success' | 'gps_fail' |
        'photo_capture' | 'photo_upload' | 'photo_fail' |
        'form_start' | 'form_save' | 'form_submit' | 'form_error' |
        'offline_enter' | 'offline_exit' | 'sync_start' | 'sync_complete' | 'sync_fail' |
        'touch_start' | 'touch_success' | 'touch_miss' |
        'task_start' | 'task_complete' | 'task_abandon'
  timestamp: number
  duration?: number
  success: boolean
  metadata?: Record<string, any>
  error?: string
}

interface PerformanceAlert {
  type: 'critical' | 'warning' | 'info'
  category: 'gps' | 'camera' | 'forms' | 'network' | 'battery' | 'performance'
  metric: string
  value: number
  threshold: number
  message: string
  recommendation: string
  timestamp: number
  context?: Record<string, any>
}

class FieldOrganizerMonitor {
  private metrics: FieldOrganizerMetrics = {
    timestamp: Date.now(),
    sessionId: this.generateSessionId()
  }

  private events: WorkflowEvent[] = []
  private alerts: PerformanceAlert[] = []
  private sessionStartTime = Date.now()
  private lastNetworkStatus = navigator.onLine
  private gpsWatchId: number | null = null
  private performanceThresholds = {
    gpsAccuracy: 10, // meters
    gpsTimeout: 10000, // 10 seconds
    photoCapture: 3000, // 3 seconds
    photoUpload: 15000, // 15 seconds
    formCompletion: 120000, // 2 minutes
    touchResponse: 150, // 150ms
    batteryLevel: 20, // 20%
    syncTimeout: 30000 // 30 seconds
  }

  constructor() {
    this.initializeMonitoring()
    this.setupEnvironmentSensors()
    this.setupNetworkMonitoring()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeMonitoring(): void {
    // Monitor page visibility changes
    document.addEventListener('visibilitychange', () => {
      this.recordEvent('page_visibility_change', true, {
        hidden: document.hidden,
        timestamp: Date.now()
      })
    })

    // Monitor touch events for accuracy
    if ('ontouchstart' in window) {
      this.setupTouchMonitoring()
    }

    // Monitor device orientation
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this.handleOrientationChange.bind(this))
    }

    // Start periodic metrics collection
    setInterval(() => {
      this.collectPeriodicMetrics()
    }, 30000) // Every 30 seconds

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      this.endSession()
    })
  }

  private setupTouchMonitoring(): void {
    let touchStartTime = 0
    let touchStartX = 0
    let touchStartY = 0

    document.addEventListener('touchstart', (e) => {
      touchStartTime = performance.now()
      const touch = e.touches[0]
      touchStartX = touch.clientX
      touchStartY = touch.clientY
    })

    document.addEventListener('touchend', (e) => {
      const touchEndTime = performance.now()
      const responseTime = touchEndTime - touchStartTime
      const touch = e.changedTouches[0]
      const touchEndX = touch.clientX
      const touchEndY = touch.clientY
      const distance = Math.sqrt(Math.pow(touchEndX - touchStartX, 2) + Math.pow(touchEndY - touchStartY, 2))

      this.recordEvent('touch_complete', true, {
        responseTime,
        distance,
        target: e.target?.tagName,
        timestamp: Date.now()
      })

      // Check if touch response is too slow
      if (responseTime > this.performanceThresholds.touchResponse) {
        this.createAlert('warning', 'performance', 'touch_response_time', responseTime, this.performanceThresholds.touchResponse,
          'Touch response time is slow', 'Optimize touch handlers and reduce JavaScript execution time')
      }
    })
  }

  private setupEnvironmentSensors(): void {
    // Battery monitoring
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        this.metrics.batteryLevel = battery.level * 100

        battery.addEventListener('levelchange', () => {
          this.metrics.batteryLevel = battery.level * 100
          if (battery.level * 100 < this.performanceThresholds.batteryLevel) {
            this.createAlert('warning', 'battery', 'battery_low', battery.level * 100, this.performanceThresholds.batteryLevel,
              'Battery level is low', 'Enable power saving mode and reduce background processing')
          }
        })

        battery.addEventListener('chargingchange', () => {
          this.recordEvent('battery_charging_change', true, {
            charging: battery.charging,
            level: battery.level * 100,
            timestamp: Date.now()
          })
        })
      })
    }

    // Ambient light sensor (if available)
    if ('AmbientLightSensor' in window) {
      try {
        const sensor = new (window as any).AmbientLightSensor()
        sensor.addEventListener('reading', () => {
          this.metrics.ambientLightLevel = sensor.illuminance
          this.adjustForLightConditions(sensor.illuminance)
        })
        sensor.start()
      } catch (error) {
        console.log('Ambient light sensor not available')
      }
    }
  }

  private setupNetworkMonitoring(): void {
    // Monitor network status changes
    window.addEventListener('online', () => {
      const offlineDuration = Date.now() - this.metrics.offlineDuration!
      this.recordEvent('offline_exit', true, { offlineDuration, timestamp: Date.now() })
      this.metrics.offlineDuration = 0
      this.attemptDataSync()
    })

    window.addEventListener('offline', () => {
      this.metrics.offlineDuration = Date.now()
      this.recordEvent('offline_enter', true, { timestamp: Date.now() })
      this.metrics.networkSwitchCount = (this.metrics.networkSwitchCount || 0) + 1
    })

    // Monitor network quality (if available)
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', () => {
        this.recordEvent('network_change', true, {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          timestamp: Date.now()
        })
      })
    }
  }

  private handleOrientationChange(event: DeviceOrientationEvent): void {
    this.recordEvent('device_orientation_change', true, {
      alpha: event.alpha,
      beta: event.beta,
      gamma: event.gamma,
      timestamp: Date.now()
    })
  }

  private adjustForLightConditions(lightLevel: number): void {
    // Adjust UI for outdoor/construction site conditions
    if (lightLevel > 10000) { // Bright outdoor conditions
      this.createAlert('info', 'performance', 'high_ambient_light', lightLevel, 10000,
        'High ambient light detected', 'Increase contrast and brightness for better outdoor readability')
    } else if (lightLevel < 100) { // Low light conditions
      this.createAlert('info', 'performance', 'low_ambient_light', lightLevel, 100,
        'Low ambient light detected', 'Reduce brightness and increase font size for better readability')
    }
  }

  private collectPeriodicMetrics(): void {
    // Collect device performance metrics
    if ('memory' in performance) {
      const memory = (performance as any).memory
      // Track memory usage for optimization
    }

    // Update session duration
    const sessionDuration = Date.now() - this.sessionStartTime

    // Analyze recent events for patterns
    this.analyzeWorkflowPatterns()
  }

  private analyzeWorkflowPatterns(): void {
    const recentEvents = this.events.slice(-20) // Last 20 events

    // Check for repeated errors
    const errorEvents = recentEvents.filter(e => !e.success)
    if (errorEvents.length > 5) {
      this.createAlert('critical', 'performance', 'high_error_rate', errorEvents.length, 5,
        'High error rate detected', 'Review recent actions and consider refreshing the application')
    }

    // Check for slow form completion
    const formEvents = recentEvents.filter(e => e.type.startsWith('form_'))
    const formCompletionTimes = formEvents.map(e => e.duration || 0)
    const avgFormTime = formCompletionTimes.reduce((a, b) => a + b, 0) / formCompletionTimes.length

    if (avgFormTime > this.performanceThresholds.formCompletion) {
      this.createAlert('warning', 'forms', 'slow_form_completion', avgFormTime, this.performanceThresholds.formCompletion,
        'Form completion is taking too long', 'Simplify forms and improve auto-save functionality')
    }
  }

  // Public API methods for field organizers

  startGPSTracking(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.recordEvent('gps_start', true, { timestamp: Date.now() })

      const startTime = performance.now()

      if (!navigator.geolocation) {
        this.recordEvent('gps_fail', false, { error: 'Geolocation not supported', timestamp: Date.now() })
        reject(new Error('Geolocation not supported'))
        return
      }

      this.gpsWatchId = navigator.geolocation.watchPosition(
        (position) => {
          const fetchTime = performance.now() - startTime
          this.metrics.gpsAccuracy = position.coords.accuracy
          this.metrics.locationFetchTime = fetchTime

          this.recordEvent('gps_success', true, {
            accuracy: position.coords.accuracy,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            fetchTime,
            timestamp: Date.now()
          })

          if (position.coords.accuracy > this.performanceThresholds.gpsAccuracy) {
            this.createAlert('warning', 'gps', 'poor_gps_accuracy', position.coords.accuracy, this.performanceThresholds.gpsAccuracy,
              'GPS accuracy is poor', 'Move to an open area with better sky visibility')
          }

          resolve()
        },
        (error) => {
          const fetchTime = performance.now() - startTime
          this.recordEvent('gps_fail', false, { error: error.message, fetchTime, timestamp: Date.now() })
          this.createAlert('critical', 'gps', 'gps_timeout', fetchTime, this.performanceThresholds.gpsTimeout,
            'GPS acquisition failed', `Error: ${error.message}. Try moving to a different location.`)
          reject(error)
        },
        {
          enableHighAccuracy: true,
          timeout: this.performanceThresholds.gpsTimeout,
          maximumAge: 0
        }
      )
    })
  }

  stopGPSTracking(): void {
    if (this.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.gpsWatchId)
      this.gpsWatchId = null
    }
  }

  recordPhotoCapture(compressionTime: number, quality: number): void {
    const captureTime = performance.now()

    this.metrics.photoCompressionTime = compressionTime
    this.metrics.photoQuality = quality

    this.recordEvent('photo_capture', true, {
      compressionTime,
      quality,
      timestamp: Date.now()
    })

    if (compressionTime > 5000) {
      this.createAlert('warning', 'camera', 'slow_photo_compression', compressionTime, 5000,
        'Photo compression is slow', 'Reduce photo quality or size for faster processing')
    }
  }

  recordPhotoUpload(uploadTime: number, fileSize: number, success: boolean): void {
    this.metrics.photoUploadTime = uploadTime

    this.recordEvent('photo_upload', success, {
      uploadTime,
      fileSize,
      timestamp: Date.now()
    })

    if (!success || uploadTime > this.performanceThresholds.photoUpload) {
      this.createAlert('warning', 'camera', 'slow_photo_upload', uploadTime, this.performanceThresholds.photoUpload,
        'Photo upload is slow', 'Check network connection or reduce image size')
    }
  }

  recordFormStart(formType: string, fieldCount: number): void {
    this.recordEvent('form_start', true, {
      formType,
      fieldCount,
      timestamp: Date.now()
    })
  }

  recordFormCompletion(formType: string, completionTime: number, autoSaveCount: number): void {
    this.metrics.formCompletionTime = completionTime
    this.metrics.autoSaveCount = autoSaveCount

    this.recordEvent('form_complete', true, {
      formType,
      completionTime,
      autoSaveCount,
      timestamp: Date.now()
    })
  }

  recordTaskStart(taskType: string, projectId?: string): void {
    this.metrics.taskType = taskType
    this.metrics.projectId = projectId

    this.recordEvent('task_start', true, {
      taskType,
      projectId,
      timestamp: Date.now()
    })
  }

  recordTaskCompletion(taskType: string, duration: number, success: boolean): void {
    this.recordEvent('task_complete', success, {
      taskType,
      duration,
      timestamp: Date.now()
    })

    if (success) {
      // Update task completion rate
      const completedTasks = this.events.filter(e => e.type === 'task_complete' && e.success).length
      const totalTasks = this.events.filter(e => e.type === 'task_complete').length
      this.metrics.taskCompletionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
    }
  }

  private async attemptDataSync(): Promise<void> {
    this.recordEvent('sync_start', true, { timestamp: Date.now() })

    try {
      // This would integrate with the existing offline sync system
      // For now, just record the attempt
      this.recordEvent('sync_complete', true, { timestamp: Date.now() })
    } catch (error) {
      this.recordEvent('sync_fail', false, { error: (error as Error).message, timestamp: Date.now() })
      this.createAlert('critical', 'network', 'sync_failure', 0, 0,
        'Data sync failed', 'Check connection and try manual sync')
    }
  }

  private recordEvent(type: string, success: boolean, metadata: Record<string, any> = {}): void {
    const event: WorkflowEvent = {
      type: type as any,
      timestamp: Date.now(),
      success,
      metadata
    }

    this.events.push(event)

    // Keep only last 100 events to prevent memory issues
    if (this.events.length > 100) {
      this.events = this.events.slice(-100)
    }
  }

  private createAlert(
    type: 'critical' | 'warning' | 'info',
    category: 'gps' | 'camera' | 'forms' | 'network' | 'battery' | 'performance',
    metric: string,
    value: number,
    threshold: number,
    message: string,
    recommendation: string
  ): void {
    const alert: PerformanceAlert = {
      type,
      category,
      metric,
      value,
      threshold,
      message,
      recommendation,
      timestamp: Date.now()
    }

    this.alerts.push(alert)

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚨 Field Organizer Alert [${type.toUpperCase()}]:`, alert)
    }
  }

  private endSession(): void {
    const sessionDuration = Date.now() - this.sessionStartTime

    // Generate session summary
    const sessionSummary = {
      sessionId: this.metrics.sessionId,
      duration: sessionDuration,
      events: this.events.length,
      alerts: this.alerts.length,
      taskCompletionRate: this.metrics.taskCompletionRate,
      networkSwitches: this.metrics.networkSwitchCount,
      avgFormTime: this.metrics.formCompletionTime,
      gpsAccuracy: this.metrics.gpsAccuracy,
      batteryLevel: this.metrics.batteryLevel
    }

    console.log('📊 Field Organizer Session Summary:', sessionSummary)

    // In production, send to analytics service
    this.sendSessionSummary(sessionSummary)
  }

  private sendSessionSummary(summary: any): void {
    // Integration with analytics service would go here
    // For now, just store in local storage for debugging
    try {
      const existingSummaries = JSON.parse(localStorage.getItem('field_organizer_sessions') || '[]')
      existingSummaries.push(summary)

      // Keep only last 10 sessions
      if (existingSummaries.length > 10) {
        existingSummaries.shift()
      }

      localStorage.setItem('field_organizer_sessions', JSON.stringify(existingSummaries))
    } catch (error) {
      console.error('Failed to save session summary:', error)
    }
  }

  // Public API for accessing metrics
  getMetrics(): FieldOrganizerMetrics {
    return { ...this.metrics }
  }

  getAlerts(): PerformanceAlert[] {
    return [...this.alerts]
  }

  getRecentEvents(count: number = 20): WorkflowEvent[] {
    return this.events.slice(-count)
  }

  getPerformanceScore(): number {
    let score = 100

    // Deduct points for each alert
    this.alerts.forEach(alert => {
      switch (alert.type) {
        case 'critical':
          score -= 20
          break
        case 'warning':
          score -= 10
          break
        case 'info':
          score -= 5
          break
      }
    })

    return Math.max(0, score)
  }

  getFieldOptimizations(): string[] {
    const optimizations: string[] = []

    if (this.metrics.gpsAccuracy && this.metrics.gpsAccuracy > 15) {
      optimizations.push('GPS accuracy could be improved - move to open area')
    }

    if (this.metrics.photoUploadTime && this.metrics.photoUploadTime > 10000) {
      optimizations.push('Consider reducing photo resolution for faster uploads')
    }

    if (this.metrics.formCompletionTime && this.metrics.formCompletionTime > 60000) {
      optimizations.push('Forms are taking time to complete - enable auto-save feature')
    }

    if (this.metrics.batteryLevel && this.metrics.batteryLevel < 30) {
      optimizations.push('Low battery - enable power saving mode')
    }

    if (this.events.filter(e => e.type === 'touch_complete' && e.metadata?.responseTime > 200).length > 5) {
      optimizations.push('Touch response is slow - reduce background processing')
    }

    return optimizations
  }
}

// Singleton instance
export const fieldOrganizerMonitor = new FieldOrganizerMonitor()

// React hook for field organizer monitoring
export function useFieldOrganizerMonitor() {
  const [metrics, setMetrics] = useState<FieldOrganizerMetrics | null>(null)
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [performanceScore, setPerformanceScore] = useState(100)

  useEffect(() => {
    if (!isMobile()) return

    const updateData = () => {
      setMetrics(fieldOrganizerMonitor.getMetrics())
      setAlerts(fieldOrganizerMonitor.getAlerts())
      setPerformanceScore(fieldOrganizerMonitor.getPerformanceScore())
    }

    // Update every 5 seconds
    const interval = setInterval(updateData, 5000)
    updateData()

    return () => clearInterval(interval)
  }, [])

  const optimizations = fieldOrganizerMonitor.getFieldOptimizations()
  const recentEvents = fieldOrganizerMonitor.getRecentEvents()

  return {
    metrics,
    alerts,
    performanceScore,
    optimizations,
    recentEvents,

    // Action methods
    startGPSTracking: fieldOrganizerMonitor.startGPSTracking.bind(fieldOrganizerMonitor),
    stopGPSTracking: fieldOrganizerMonitor.stopGPSTracking.bind(fieldOrganizerMonitor),
    recordPhotoCapture: fieldOrganizerMonitor.recordPhotoCapture.bind(fieldOrganizerMonitor),
    recordPhotoUpload: fieldOrganizerMonitor.recordPhotoUpload.bind(fieldOrganizerMonitor),
    recordFormStart: fieldOrganizerMonitor.recordFormStart.bind(fieldOrganizerMonitor),
    recordFormCompletion: fieldOrganizerMonitor.recordFormCompletion.bind(fieldOrganizerMonitor),
    recordTaskStart: fieldOrganizerMonitor.recordTaskStart.bind(fieldOrganizerMonitor),
    recordTaskCompletion: fieldOrganizerMonitor.recordTaskCompletion.bind(fieldOrganizerMonitor)
  }
}

export default fieldOrganizerMonitor