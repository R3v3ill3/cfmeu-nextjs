"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

export const dynamic = 'force-dynamic'
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RatingDashboard } from "@/components/mobile/rating-system/RatingDashboard"
import { EmployerRatingData, RoleType } from "@/types/rating"
import { useMobileOptimizations } from "@/hooks/mobile/useMobileOptimizations"
import { useOfflineSync } from "@/hooks/mobile/useOfflineSync"
import { useToast } from "@/hooks/use-toast"

// This would typically be loaded from an API or context
const mockEmployers: EmployerRatingData[] = []

const mockStats = {
  totalEmployers: 156,
  greenCount: 98,
  amberCount: 42,
  redCount: 16,
  recentActivity: 23,
}

const mockAlerts = [
  {
    id: "1",
    type: "warning" as const,
    title: "System Maintenance",
    message: "Rating system will be under maintenance tonight from 10 PM to 2 AM",
    timestamp: new Date().toISOString(),
  },
]

export default function MobileDashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isMobile, debounce } = useMobileOptimizations()

  const {
    data: employers,
    loading,
    refreshing,
    forceSync,
  } = useOfflineSync(mockEmployers, {
    storageKey: "mobile-employers",
    autoSync: true,
  })

  const userRole: RoleType = "organiser"

  const handleBack = useCallback(() => {
    router.back()
  }, [router])

  const handleRefresh = useCallback(async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast({
        title: "Dashboard refreshed",
        description: "Latest data has been loaded",
      })
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to load latest data",
        variant: "destructive",
      })
    }
  }, [toast])

  const handleSearch = useCallback(
    debounce((query: string) => {
      // Handle search
    }),
    [debounce]
  )

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleBack}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold">Dashboard</h1>
          </div>
        </div>
      </div>

      <RatingDashboard
        employers={employers || []}
        userRole={userRole}
        loading={loading}
        refreshing={refreshing}
        stats={mockStats}
        alerts={mockAlerts}
        onRefresh={handleRefresh}
        onSearch={handleSearch}
      />
    </div>
  )
}