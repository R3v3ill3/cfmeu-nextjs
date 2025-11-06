"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useFieldOrganizerMonitor } from '@/lib/mobile/mobile-field-organizer-monitor'
import { useMobileOptimizations } from '@/hooks/mobile/useMobileOptimizations'
import { useOfflineSync } from '@/hooks/mobile/useOfflineSync'
import { useToast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle, Battery, Wifi, WifiOff, MapPin, Camera, Zap, Settings } from 'lucide-react'

interface FieldOrganizerOptimizationProviderProps {
  children: React.ReactNode
  projectId?: string
  taskType?: 'mapping' | 'audit' | 'compliance' | 'discovery'
}

interface PerformanceAlert {
  type: 'critical' | 'warning' | 'info'
  message: string
  recommendation: string
  timestamp: number
}

export function FieldOrganizerOptimizationProvider({
  children,
  projectId,
  taskType
}: FieldOrganizerOptimizationProviderProps) {
  const { toast } = useToast()

  const {
    metrics,
    alerts,
    performanceScore,
    optimizations,
    recentEvents,
    startGPSTracking,
    stopGPSTracking,
    recordPhotoCapture,
    recordPhotoUpload,
    recordFormStart,
    recordFormCompletion,
    recordTaskStart,
    recordTaskCompletion
  } = useFieldOrganizerMonitor()

  const {
    isMobile,
    isLowEndDevice,
    isOnline,
    debounce,
    throttle
  } = useMobileOptimizations()

  const [showPerformancePanel, setShowPerformancePanel] = useState(false)
  const [powerSaveMode, setPowerSaveMode] = useState(false)
  const [outdoorMode, setOutdoorMode] = useState(false)
  const [glovesMode, setGlovesMode] = useState(false)

  const performancePanelRef = useRef<HTMLDivElement>(null)

  // Initialize task monitoring
  useEffect(() => {
    if (taskType && projectId) {
      recordTaskStart(taskType, projectId)
    }

    return () => {
      if (taskType) {
        recordTaskCompletion(taskType, Date.now(), true)
      }
    }
  }, [taskType, projectId, recordTaskStart, recordTaskCompletion])

  // Start GPS tracking for location-based tasks
  useEffect(() => {
    if (taskType === 'mapping' || taskType === 'discovery') {
      startGPSTracking().catch(error => {
        toast({
          title: "GPS Error",
          description: "Unable to access GPS. Location features may be limited.",
          variant: "destructive"
        })
      })
    }

    return () => {
      stopGPSTracking()
    }
  }, [taskType, startGPSTracking, stopGPSTracking, toast])

  // Handle performance alerts
  useEffect(() => {
    const criticalAlerts = alerts.filter(alert => alert.type === 'critical')
    const warningAlerts = alerts.filter(alert => alert.type === 'warning')

    // Show critical alerts immediately
    criticalAlerts.slice(-1).forEach(alert => {
      toast({
        title: "Performance Issue",
        description: alert.message,
        variant: "destructive"
      })
    })

    // Show summary of warnings (debounced)
    const debouncedWarnings = debounce(() => {
      if (warningAlerts.length > 0) {
        toast({
          title: "Performance Recommendations",
          description: `${warningAlerts.length} optimization suggestions available`,
          variant: "default"
        })
      }
    }, 5000)

    if (warningAlerts.length > 0) {
      debouncedWarnings()
    }
  }, [alerts, toast, debounce])

  // Handle power saving mode
  useEffect(() => {
    if (metrics?.batteryLevel && metrics.batteryLevel < 20) {
      setPowerSaveMode(true)
    }
  }, [metrics?.batteryLevel])

  // Handle outdoor mode based on ambient light
  useEffect(() => {
    if (metrics?.ambientLightLevel && metrics.ambientLightLevel > 10000) {
      setOutdoorMode(true)
    }
  }, [metrics?.ambientLightLevel])

  // Performance optimizations based on device capabilities
  const optimizationSettings = useMemo(() => {
    const settings = {
      animationQuality: powerSaveMode ? 'none' : (isLowEndDevice ? 'reduced' : 'full'),
      imageQuality: powerSaveMode ? 'low' : (isOnline ? 'high' : 'medium'),
      autoSave: true,
      gpsAccuracy: powerSaveMode ? 'low' : 'high',
      photoResolution: powerSaveMode ? 'medium' : 'high',
      backgroundSync: !powerSaveMode && isOnline,
      touchFeedback: glovesMode ? 'enhanced' : 'normal',
      fontSize: outdoorMode ? 'large' : 'normal',
      contrast: outdoorMode ? 'high' : 'normal'
    }

    return settings
  }, [powerSaveMode, isLowEndDevice, isOnline, glovesMode, outdoorMode])

  // Handle photo capture with performance tracking
  const handlePhotoCapture = useCallback(async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<string> => {
    const startTime = performance.now()

    try {
      // Compress image based on optimization settings
      const compressedFile = await compressImage(file, {
        quality: optimizationSettings.imageQuality,
        maxWidth: optimizationSettings.photoResolution === 'high' ? 1920 : 1280,
        maxHeight: optimizationSettings.photoResolution === 'high' ? 1920 : 1280
      })

      const compressionTime = performance.now() - startTime
      recordPhotoCapture(compressionTime, optimizationSettings.imageQuality === 'high' ? 0.9 : 0.7)

      // Upload if online, otherwise queue for later
      if (isOnline) {
        const uploadStartTime = performance.now()

        // Simulate upload with progress
        const uploadResult = await uploadPhoto(compressedFile, onProgress)

        const uploadTime = performance.now() - uploadStartTime
        recordPhotoUpload(uploadTime, compressedFile.size, true)

        return uploadResult
      } else {
        // Queue for offline upload
        await queuePhotoForUpload(compressedFile)
        recordPhotoUpload(0, compressedFile.size, false) // Offline upload

        toast({
          title: "Photo Queued",
          description: "Photo will be uploaded when you're back online",
          variant: "default"
        })

        return URL.createObjectURL(compressedFile)
      }
    } catch (error) {
      recordPhotoUpload(performance.now() - startTime, file.size, false)
      throw error
    }
  }, [optimizationSettings, isOnline, recordPhotoCapture, recordPhotoUpload, toast])

  // Handle form submissions with auto-save
  const handleFormInteraction = useCallback((
    formData: any,
    formType: string,
    fieldCount: number
  ) => {
    recordFormStart(formType, fieldCount)

    // Auto-save functionality
    if (optimizationSettings.autoSave) {
      const debouncedSave = debounce(async (data: any) => {
        try {
          await saveFormData(data, formType)
        } catch (error) {
          console.error('Auto-save failed:', error)
        }
      }, 2000)

      debouncedSave(formData)
    }
  }, [optimizationSettings.autoSave, recordFormStart, debounce])

  const getPerformanceColor = (score: number): string => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceGrade = (score: number): string => {
    if (score >= 90) return 'A'
    if (score >= 80) return 'B'
    if (score >= 70) return 'C'
    if (score >= 60) return 'D'
    return 'F'
  }

  return (
    <div className={`relative ${outdoorMode ? 'outdoor-mode' : ''} ${glovesMode ? 'gloves-mode' : ''}`}>
      {/* Performance Indicator */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowPerformancePanel(!showPerformancePanel)}
          className={`flex items-center gap-2 ${getPerformanceColor(performanceScore)}`}
        >
          <Zap className="h-4 w-4" />
          <span className="font-semibold">{getPerformanceGrade(performanceScore)}</span>
          {performanceScore}
        </Button>
      </div>

      {/* Status Indicators */}
      <div className="fixed top-4 left-4 z-50 flex flex-col gap-2">
        {/* Network Status */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-600" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-600" />
          )}
          <span className="text-xs font-medium">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Battery Status */}
        {metrics?.batteryLevel && (
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg">
            <Battery className={`h-4 w-4 ${
              metrics.batteryLevel > 50 ? 'text-green-600' :
              metrics.batteryLevel > 20 ? 'text-yellow-600' : 'text-red-600'
            }`} />
            <span className="text-xs font-medium">{Math.round(metrics.batteryLevel)}%</span>
          </div>
        )}

        {/* GPS Status */}
        {taskType === 'mapping' || taskType === 'discovery' ? (
          <div className="flex items-center gap-2 bg-white/90 backdrop-blur px-3 py-2 rounded-lg shadow-lg">
            <MapPin className={`h-4 w-4 ${
              metrics?.gpsAccuracy && metrics.gpsAccuracy < 10 ? 'text-green-600' :
              metrics?.gpsAccuracy && metrics.gpsAccuracy < 25 ? 'text-yellow-600' : 'text-red-600'
            }`} />
            <span className="text-xs font-medium">
              {metrics?.gpsAccuracy ? `${Math.round(metrics.gpsAccuracy)}m` : 'Acquiring...'}
            </span>
          </div>
        ) : null}
      </div>

      {/* Performance Panel */}
      {showPerformancePanel && (
        <div
          ref={performancePanelRef}
          className="fixed inset-x-4 top-16 bottom-4 z-40 bg-white/95 backdrop-blur rounded-lg shadow-xl overflow-hidden"
        >
          <Card className="h-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Field Performance</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={performanceScore >= 80 ? 'default' : 'destructive'}>
                    {getPerformanceGrade(performanceScore)} - {performanceScore}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPerformancePanel(false)}
                  >
                    ×
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto">
              <div className="space-y-6">
                {/* Quick Actions */}
                <div>
                  <h3 className="font-medium mb-3">Quick Settings</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={powerSaveMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPowerSaveMode(!powerSaveMode)}
                      className="flex items-center gap-2"
                    >
                      <Battery className="h-4 w-4" />
                      Power Save
                    </Button>
                    <Button
                      variant={outdoorMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setOutdoorMode(!outdoorMode)}
                      className="flex items-center gap-2"
                    >
                      <Sun className="h-4 w-4" />
                      Outdoor
                    </Button>
                    <Button
                      variant={glovesMode ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setGlovesMode(!glovesMode)}
                      className="flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Gloves
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                      className="flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* Alerts */}
                {alerts.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Alerts & Recommendations</h3>
                    <div className="space-y-2">
                      {alerts.slice(-5).map((alert, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border-l-4 ${
                            alert.type === 'critical' ? 'bg-red-50 border-red-500' :
                            alert.type === 'warning' ? 'bg-yellow-50 border-yellow-500' :
                            'bg-blue-50 border-blue-500'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className={`h-4 w-4 mt-0.5 ${
                              alert.type === 'critical' ? 'text-red-600' :
                              alert.type === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                            }`} />
                            <div className="flex-1">
                              <p className="text-sm font-medium">{alert.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {alert.recommendation}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Optimizations */}
                {optimizations.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Optimizations</h3>
                    <div className="space-y-2">
                      {optimizations.map((optimization, index) => (
                        <div key={index} className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-800">{optimization}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Settings */}
                <div>
                  <h3 className="font-medium mb-3">Current Settings</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="font-medium">Animation:</span>
                      <span className="ml-2 capitalize">{optimizationSettings.animationQuality}</span>
                    </div>
                    <div>
                      <span className="font-medium">Images:</span>
                      <span className="ml-2 capitalize">{optimizationSettings.imageQuality}</span>
                    </div>
                    <div>
                      <span className="font-medium">GPS:</span>
                      <span className="ml-2 capitalize">{optimizationSettings.gpsAccuracy}</span>
                    </div>
                    <div>
                      <span className="font-medium">Photos:</span>
                      <span className="ml-2 capitalize">{optimizationSettings.photoResolution}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Events */}
                {recentEvents.length > 0 && (
                  <div>
                    <h3 className="font-medium mb-3">Recent Activity</h3>
                    <div className="space-y-1">
                      {recentEvents.slice(-10).map((event, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <span className="capitalize">{event.type.replace('_', ' ')}</span>
                          <span className={`${
                            event.success ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {event.success ? '✓' : '✗'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className={`transition-all duration-300 ${
        powerSaveMode ? 'power-save-mode' : ''
      } ${outdoorMode ? 'outdoor-enhanced' : ''} ${glovesMode ? 'gloves-enhanced' : ''}`}>
        {children}
      </div>

      <style jsx>{`
        .power-save-mode {
          --animation-duration: 0ms;
        }

        .outdoor-enhanced {
          --font-size-multiplier: 1.2;
          --contrast-multiplier: 1.3;
        }

        .gloves-enhanced {
          --touch-target-size: 48px;
          --border-width: 3px;
        }

        .outdoor-mode * {
          filter: contrast(var(--contrast-multiplier)) brightness(1.1);
        }

        .gloves-mode button,
        .gloves-mode [role="button"] {
          min-height: var(--touch-target-size);
          min-width: var(--touch-target-size);
          border-width: var(--border-width);
        }
      `}</style>
    </div>
  )
}

// Helper functions
async function compressImage(file: File, options: {
  quality: string
  maxWidth: number
  maxHeight: number
}): Promise<File> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    const img = new Image()

    img.onload = () => {
      const ratio = Math.min(options.maxWidth / img.width, options.maxHeight / img.height)
      canvas.width = img.width * ratio
      canvas.height = img.height * ratio

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: file.type }))
          } else {
            resolve(file)
          }
        },
        file.type,
        options.quality === 'high' ? 0.9 : options.quality === 'medium' ? 0.7 : 0.5
      )
    }

    img.src = URL.createObjectURL(file)
  })
}

async function uploadPhoto(file: File, onProgress?: (progress: number) => void): Promise<string> {
  // Simulate upload with progress
  for (let i = 0; i <= 100; i += 10) {
    await new Promise(resolve => setTimeout(resolve, 100))
    onProgress?.(i)
  }

  // In real implementation, upload to server
  return URL.createObjectURL(file)
}

async function queuePhotoForUpload(file: File): Promise<void> {
  // In real implementation, add to IndexedDB queue
  console.log('Photo queued for upload:', file.name)
}

async function saveFormData(data: any, formType: string): Promise<void> {
  // In real implementation, save to IndexedDB
  console.log('Form data saved:', { formType, data })
}

export default FieldOrganizerOptimizationProvider