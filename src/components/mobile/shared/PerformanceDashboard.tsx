"use client"

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useNetworkOptimization } from '@/lib/network/network-optimization'
import { useDeviceCapabilities } from '@/hooks/useMobilePerformance'
import { useOptimizedOrganizingMetrics } from '@/hooks/mobile/useOptimizedOrganizingMetrics'

interface PerformanceDashboardProps {
  showDetails?: boolean
  compact?: boolean
}

export function PerformanceDashboard({ showDetails = false, compact = false }: PerformanceDashboardProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { isOnline, networkInfo, connectionQuality } = useNetworkOptimization()
  const { isLowEnd, memoryConstraints, batteryLevel, deviceMemory } = useDeviceCapabilities()

  const { performanceMetrics, isUsingOptimizedCache } = useOptimizedOrganizingMetrics({}, {
    enableBackgroundRefresh: true
  })

  // Calculate overall performance score
  const performanceScore = useMemo(() => {
    let score = 100

    // Network penalties
    if (!isOnline) score -= 50
    else if (connectionQuality === 'poor') score -= 30
    else if (connectionQuality === 'fair') score -= 15

    // Device penalties
    if (isLowEnd) score -= 20
    if (memoryConstraints) score -= 15
    if (batteryLevel && batteryLevel < 0.2) score -= 10

    // Cache performance bonus
    if (isUsingOptimizedCache) score += 10

    return Math.max(0, Math.min(100, score))
  }, [isOnline, connectionQuality, isLowEnd, memoryConstraints, batteryLevel, isUsingOptimizedCache])

  const performanceLevel = useMemo(() => {
    if (performanceScore >= 80) return { label: 'Excellent', color: 'bg-green-500' }
    if (performanceScore >= 60) return { label: 'Good', color: 'bg-blue-500' }
    if (performanceScore >= 40) return { label: 'Fair', color: 'bg-yellow-500' }
    return { label: 'Poor', color: 'bg-red-500' }
  }, [performanceScore])

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-2 bg-white rounded-lg border">
        <div className={`w-2 h-2 rounded-full ${performanceLevel.color}`} />
        <span className="text-xs font-medium">{performanceScore}%</span>
        <Badge variant="outline" className="text-xs">
          {performanceLevel.label}
        </Badge>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Performance Dashboard</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsVisible(!isVisible)}
          >
            {isVisible ? 'Hide' : 'Show'} Details
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Performance Score */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Performance Score</span>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${performanceLevel.color}`} />
            <span className="text-lg font-bold">{performanceScore}%</span>
            <Badge variant="secondary" className="text-xs">
              {performanceLevel.label}
            </Badge>
          </div>
        </div>

        {/* Performance Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${performanceLevel.color}`}
            style={{ width: `${performanceScore}%` }}
          />
        </div>

        {/* Connection Status */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Connection</span>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-medium">
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-gray-600">Network Quality</span>
            <div className="mt-1">
              <Badge
                variant={connectionQuality === 'excellent' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {networkInfo?.effectiveType || 'Unknown'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Device Capabilities */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Device Type</span>
            <div className="mt-1">
              <Badge variant={isLowEnd ? 'destructive' : 'default'} className="text-xs">
                {isLowEnd ? 'Low-end' : 'High-end'}
              </Badge>
            </div>
          </div>

          <div>
            <span className="text-gray-600">Memory</span>
            <div className="mt-1">
              <Badge variant={memoryConstraints ? 'destructive' : 'default'} className="text-xs">
                {memoryConstraints ? 'Constrained' : 'Sufficient'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Battery Status */}
        {batteryLevel !== undefined && (
          <div className="text-sm">
            <span className="text-gray-600">Battery Level</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    batteryLevel > 0.5 ? 'bg-green-500' :
                    batteryLevel > 0.2 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${batteryLevel * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium">
                {Math.round(batteryLevel * 100)}%
              </span>
            </div>
          </div>
        )}

        {/* Optimization Status */}
        <div className="border-t pt-3">
          <div className="text-sm font-medium mb-2">Optimizations Active</div>
          <div className="flex flex-wrap gap-2">
            {isUsingOptimizedCache && (
              <Badge variant="default" className="text-xs bg-green-500">
                Optimized Cache
              </Badge>
            )}
            {!isOnline && (
              <Badge variant="secondary" className="text-xs">
                Offline Mode
              </Badge>
            )}
            {isLowEnd && (
              <Badge variant="secondary" className="text-xs">
                Performance Mode
              </Badge>
            )}
            {batteryLevel && batteryLevel < 0.2 && (
              <Badge variant="secondary" className="text-xs">
                Battery Saver
              </Badge>
            )}
          </div>
        </div>

        {/* Detailed Metrics */}
        {isVisible && showDetails && performanceMetrics && (
          <div className="border-t pt-3 space-y-2">
            <div className="text-sm font-medium">Technical Details</div>
            <div className="space-y-1 text-xs text-gray-600">
              <div>Cache Hit: {performanceMetrics.cacheHit ? 'Yes' : 'No'}</div>
              <div>Last Fetch: {performanceMetrics.lastFetchTime ?
                new Date(performanceMetrics.lastFetchTime).toLocaleTimeString() : 'Never'}</div>
              <div>Stale Time: {Math.round(performanceMetrics.staleTime / 1000 / 60)} min</div>
              <div>Device Memory: {deviceMemory ? `${deviceMemory}GB` : 'Unknown'}</div>
            </div>
          </div>
        )}

        {/* Performance Tips */}
        <div className="border-t pt-3">
          <div className="text-sm font-medium mb-2">Performance Tips</div>
          <div className="space-y-1 text-xs text-gray-600">
            {connectionQuality === 'poor' && (
              <div>• Consider using offline mode for better performance</div>
            )}
            {isLowEnd && (
              <div>• Performance optimizations are automatically enabled</div>
            )}
            {batteryLevel && batteryLevel < 0.2 && (
              <div>• Battery saver mode reduces background updates</div>
            )}
            {!isOnline && (
              <div>• You're viewing cached data. Features may be limited.</div>
            )}
            {performanceScore >= 80 && (
              <div>• Excellent performance! All features are optimized.</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default PerformanceDashboard