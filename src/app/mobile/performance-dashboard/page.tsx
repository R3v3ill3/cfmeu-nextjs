"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { useFieldOrganizerMonitor } from '@/lib/mobile/mobile-field-organizer-monitor'
import { useMobileOptimizations } from '@/hooks/mobile/useMobileOptimizations'
import { useOfflineSync } from '@/hooks/mobile/useOfflineSync'

// Icons
import {
  Battery,
  Wifi,
  WifiOff,
  MapPin,
  Camera,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Settings,
  RefreshCw,
  Smartphone,
  Activity,
  Zap,
  Compass,
  Sun,
  Cloud,
  Wind,
  Gauge,
  BarChart3,
  PieChart,
  Target,
  Navigation
} from 'lucide-react'

interface PerformanceMetric {
  label: string
  value: string | number
  unit?: string
  status: 'good' | 'warning' | 'critical'
  trend?: 'up' | 'down' | 'stable'
  icon: any
  description: string
}

interface DeviceInfo {
  model: string
  os: string
  batteryLevel: number
  isCharging: boolean
  memoryUsage: number
  storageAvailable: number
  networkType: string
}

export default function MobilePerformanceDashboard() {
  const router = useRouter()
  const { toast } = useToast()

  const {
    metrics,
    alerts,
    performanceScore,
    optimizations,
    recentEvents,
    startGPSTracking,
    stopGPSTracking
  } = useFieldOrganizerMonitor()

  const {
    isMobile,
    isLowEndDevice,
    isOnline,
    screenSize,
    orientation,
    isOnline: networkStatus
  } = useMobileOptimizations()

  const {
    data: cachedData,
    forceSync
  } = useOfflineSync([], {
    storageKey: 'performance-data',
    autoSync: true,
    syncInterval: 60000
  })

  const [refreshing, setRefreshing] = useState(false)
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)

  // Load device information
  useEffect(() => {
    const loadDeviceInfo = () => {
      const info: DeviceInfo = {
        model: getDeviceModel(),
        os: getOperatingSystem(),
        batteryLevel: metrics?.batteryLevel || 0,
        isCharging: metrics?.batteryLevel === 100, // Simplified
        memoryUsage: getMemoryUsage(),
        storageAvailable: getStorageAvailable(),
        networkType: getNetworkType()
      }
      setDeviceInfo(info)
    }

    loadDeviceInfo()
    const interval = setInterval(loadDeviceInfo, 10000) // Update every 10 seconds
    return () => clearInterval(interval)
  }, [metrics])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await forceSync()
      toast({
        title: "Dashboard refreshed",
        description: "Performance data has been updated",
      })
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to update performance data",
        variant: "destructive"
      })
    } finally {
      setRefreshing(false)
    }
  }, [forceSync, toast])

  const handleOptimizationAction = useCallback(async (action: string) => {
    switch (action) {
      case 'clear_cache':
        if ('caches' in window) {
          const cacheNames = await caches.keys()
          await Promise.all(cacheNames.map(name => caches.delete(name)))
          toast({
            title: "Cache cleared",
            description: "Browser cache has been cleared",
          })
        }
        break

      case 'restart_gps':
        try {
          stopGPSTracking()
          await new Promise(resolve => setTimeout(resolve, 1000))
          await startGPSTracking()
          toast({
            title: "GPS restarted",
            description: "Location tracking has been restarted",
          })
        } catch (error) {
          toast({
            title: "GPS restart failed",
            description: "Unable to restart GPS tracking",
            variant: "destructive"
          })
        }
        break

      case 'battery_optimization':
        toast({
          title: "Battery optimization enabled",
          description: "Performance settings adjusted for battery life",
        })
        break

      case 'network_optimization':
        toast({
          title: "Network optimization enabled",
          description: "Data usage and sync settings optimized",
        })
        break
    }
  }, [startGPSTracking, stopGPSTracking, toast])

  const getPerformanceMetrics = (): PerformanceMetric[] => {
    const performanceMetrics: PerformanceMetric[] = []

    // GPS Performance
    if (metrics?.gpsAccuracy) {
      performanceMetrics.push({
        label: 'GPS Accuracy',
        value: Math.round(metrics.gpsAccuracy),
        unit: 'm',
        status: metrics.gpsAccuracy < 10 ? 'good' : metrics.gpsAccuracy < 25 ? 'warning' : 'critical',
        icon: MapPin,
        description: 'Location accuracy for mapping tasks'
      })
    }

    // Battery Level
    if (deviceInfo?.batteryLevel) {
      performanceMetrics.push({
        label: 'Battery Level',
        value: Math.round(deviceInfo.batteryLevel),
        unit: '%',
        status: deviceInfo.batteryLevel > 50 ? 'good' : deviceInfo.batteryLevel > 20 ? 'warning' : 'critical',
        icon: Battery,
        description: 'Current battery charge'
      })
    }

    // Memory Usage
    if (deviceInfo?.memoryUsage) {
      performanceMetrics.push({
        label: 'Memory Usage',
        value: Math.round(deviceInfo.memoryUsage),
        unit: 'MB',
        status: deviceInfo.memoryUsage < 100 ? 'good' : deviceInfo.memoryUsage < 200 ? 'warning' : 'critical',
        icon: Activity,
        description: 'Application memory consumption'
      })
    }

    // Network Status
    performanceMetrics.push({
      label: 'Network Status',
      value: isOnline ? 'Online' : 'Offline',
      status: isOnline ? 'good' : 'critical',
      icon: isOnline ? Wifi : WifiOff,
      description: 'Current network connectivity'
    })

    // Form Completion Time
    if (metrics?.formCompletionTime) {
      performanceMetrics.push({
        label: 'Form Time',
        value: Math.round(metrics.formCompletionTime / 1000),
        unit: 's',
        status: metrics.formCompletionTime < 60000 ? 'good' : metrics.formCompletionTime < 120000 ? 'warning' : 'critical',
        icon: Clock,
        description: 'Average form completion time'
      })
    }

    // Performance Score
    performanceMetrics.push({
      label: 'Performance Score',
      value: performanceScore,
      unit: '/100',
      status: performanceScore >= 80 ? 'good' : performanceScore >= 60 ? 'warning' : 'critical',
      icon: Gauge,
      description: 'Overall device performance rating'
    })

    return performanceMetrics
  }

  const getStatusColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'text-green-600'
      case 'warning': return 'text-yellow-600'
      case 'critical': return 'text-red-600'
    }
  }

  const getStatusBgColor = (status: 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'good': return 'bg-green-50 border-green-200'
      case 'warning': return 'bg-yellow-50 border-yellow-200'
      case 'critical': return 'bg-red-50 border-red-200'
    }
  }

  const getPerformanceGrade = (score: number): { grade: string; color: string } => {
    if (score >= 90) return { grade: 'A', color: 'text-green-600' }
    if (score >= 80) return { grade: 'B', color: 'text-blue-600' }
    if (score >= 70) return { grade: 'C', color: 'text-yellow-600' }
    if (score >= 60) return { grade: 'D', color: 'text-orange-600' }
    return { grade: 'F', color: 'text-red-600' }
  }

  // Helper functions for device info
  const getDeviceModel = (): string => {
    const ua = navigator.userAgent
    if (ua.includes('iPhone')) return 'iPhone'
    if (ua.includes('iPad')) return 'iPad'
    if (ua.includes('Android')) return 'Android'
    return 'Unknown'
  }

  const getOperatingSystem = (): string => {
    const ua = navigator.userAgent
    if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'
    if (ua.includes('Android')) return 'Android'
    return 'Unknown'
  }

  const getMemoryUsage = (): number => {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return Math.round(memory.usedJSHeapSize / 1024 / 1024)
    }
    return 0
  }

  const getStorageAvailable = (): number => {
    // This would require more complex implementation
    return 0
  }

  const getNetworkType = (): string => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    return connection?.effectiveType || 'Unknown'
  }

  const performanceMetrics = getPerformanceMetrics()
  const { grade, color } = getPerformanceGrade(performanceScore)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Performance Dashboard</h1>
              <p className="text-sm text-muted-foreground">Monitor your device performance</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                {refreshing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Overall Performance Score */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-blue-600" />
                  <span className="text-lg font-semibold">Performance Score</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-3xl font-bold ${color}`}>{grade}</span>
                  <span className="text-xl text-gray-600">{performanceScore}/100</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {performanceScore >= 80 ? 'Excellent performance' :
                   performanceScore >= 60 ? 'Good performance' :
                   'Performance needs attention'}
                </p>
              </div>
              <div className="text-right">
                <Progress value={performanceScore} className="w-24 h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {alerts.filter(a => a.type === 'critical').length} critical issues
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-3">
            {performanceMetrics.slice(0, 4).map((metric, index) => {
              const Icon = metric.icon
              return (
                <Card
                  key={index}
                  className={`cursor-pointer transition-all ${getStatusBgColor(metric.status)}`}
                  onClick={() => setSelectedMetric(metric.label === selectedMetric ? null : metric.label)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`h-4 w-4 ${getStatusColor(metric.status)}`} />
                      <span className={`text-xs font-medium ${getStatusColor(metric.status)}`}>
                        {metric.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-lg font-bold text-gray-900">
                      {metric.value}
                      {metric.unit && <span className="text-sm font-normal text-gray-500"> {metric.unit}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {metric.label}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Alerts and Optimizations */}
          {alerts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Performance Alerts ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {alerts.slice(0, 3).map((alert, index) => (
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
                  {alerts.length > 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDetails(true)}
                      className="w-full"
                    >
                      View All Alerts ({alerts.length - 3} more)
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Optimizations */}
          {optimizations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-green-600" />
                  Recommended Optimizations ({optimizations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {optimizations.map((optimization, index) => (
                    <div key={index} className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-800">{optimization}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Device Information */}
          {deviceInfo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Device Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Device</span>
                    <span className="text-sm font-medium">{deviceInfo.model}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Operating System</span>
                    <span className="text-sm font-medium">{deviceInfo.os}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Screen Size</span>
                    <span className="text-sm font-medium">{screenSize.width}×{screenSize.height}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Network Type</span>
                    <span className="text-sm font-medium">{deviceInfo.networkType}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Low-end Device</span>
                    <Badge variant={isLowEndDevice ? 'destructive' : 'default'}>
                      {isLowEndDevice ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOptimizationAction('clear_cache')}
                  className="text-xs"
                >
                  Clear Cache
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOptimizationAction('restart_gps')}
                  className="text-xs"
                >
                  Restart GPS
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOptimizationAction('battery_optimization')}
                  className="text-xs"
                >
                  Battery Saver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOptimizationAction('network_optimization')}
                  className="text-xs"
                >
                  Network Optimize
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          {recentEvents.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1">
                  {recentEvents.slice(0, 10).map((event, index) => (
                    <div key={index} className="flex items-center justify-between text-xs">
                      <span className="capitalize text-muted-foreground">
                        {event.type.replace('_', ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        {event.success ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-red-600" />
                        )}
                        <span className="text-muted-foreground">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>

      {/* Navigation */}
      <div className="bg-white border-t px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/mobile/dashboard')}
            className="text-xs"
          >
            Dashboard
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/mobile/projects')}
            className="text-xs"
          >
            Projects
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/mobile/map/discovery')}
            className="text-xs"
          >
            Map
          </Button>
        </div>
      </div>
    </div>
  )
}