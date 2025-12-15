"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Building, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { useMappingSheetData } from "@/hooks/useMappingSheetData"
import { useKeyContractorTradesSet } from "@/hooks/useKeyContractorTrades"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { cn } from "@/lib/utils"

interface MobileEmployerSelectionProps {
  projectId: string
  projectName: string
  onStartAssessment: (selectedEmployerIds: string[]) => void
}

interface Employer {
  id: string
  name: string
  roleOrTrade: string
  trafficLightRating?: 'green' | 'amber' | 'red' | null
}

export function MobileEmployerSelection({
  projectId,
  projectName,
  onStartAssessment,
}: MobileEmployerSelectionProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEmployerIds, setSelectedEmployerIds] = useState<string[]>([])
  const [selectAllChecked, setSelectAllChecked] = useState(false)

  const { data: mappingData, isLoading } = useMappingSheetData(projectId)
  const { tradeSet: KEY_CONTRACTOR_TRADES } = useKeyContractorTradesSet()

  // Build employer list from mapping data
  const employers = useMemo(() => {
    if (!mappingData) return []
    
    const employerMap = new Map<string, Employer>()
    
    // Add contractor roles
    mappingData.contractorRoles.forEach(role => {
      const existing = employerMap.get(role.employerId)
      if (!existing || role.role === 'builder' || role.role === 'head_contractor') {
        employerMap.set(role.employerId, {
          id: role.employerId,
          name: role.employerName,
          roleOrTrade: role.roleLabel,
        })
      }
    })
    
    // Add trade contractors
    mappingData.tradeContractors.forEach(trade => {
      if (!employerMap.has(trade.employerId)) {
        employerMap.set(trade.employerId, {
          id: trade.employerId,
          name: trade.employerName,
          roleOrTrade: trade.tradeLabel,
        })
      }
    })
    
    return Array.from(employerMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [mappingData])

  // Fetch traffic light ratings for employers
  const { data: ratingsData } = useQuery({
    queryKey: ['employer-ratings', projectId, employers.map(e => e.id)],
    enabled: employers.length > 0,
    queryFn: async () => {
      if (employers.length === 0) return new Map<string, 'green' | 'amber' | 'red'>()
      
      const employerIds = employers.map(e => e.id)
      
      const { data: complianceData } = await supabase
        .from('employer_compliance_checks')
        .select('employer_id, traffic_light_rating')
        .eq('project_id', projectId)
        .eq('is_current', true)
        .in('employer_id', employerIds)
      
      const ratingMap = new Map<string, 'green' | 'amber' | 'red'>()
      ;(complianceData || []).forEach((c: any) => {
        if (c.traffic_light_rating) {
          ratingMap.set(c.employer_id, c.traffic_light_rating)
        }
      })
      
      return ratingMap
    },
    staleTime: 30000,
  })

  // Enrich employers with ratings
  const enrichedEmployers = useMemo(() => {
    return employers.map(emp => ({
      ...emp,
      trafficLightRating: ratingsData?.get(emp.id) || null,
    }))
  }, [employers, ratingsData])

  // Filter employers by search term
  const filteredEmployers = useMemo(() => {
    return enrichedEmployers.filter(employer => {
      const matchesSearch = employer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employer.roleOrTrade?.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSearch
    })
  }, [enrichedEmployers, searchTerm])

  const handleSelectAll = (checked: boolean) => {
    setSelectAllChecked(checked)
    if (checked) {
      setSelectedEmployerIds(filteredEmployers.map(e => e.id))
    } else {
      setSelectedEmployerIds([])
    }
  }

  const handleEmployerToggle = (employerId: string, checked: boolean) => {
    setSelectedEmployerIds(prev => {
      const newSelection = checked
        ? [...prev, employerId]
        : prev.filter(id => id !== employerId)
      
      // Update select all checkbox
      setSelectAllChecked(newSelection.length === filteredEmployers.length && filteredEmployers.length > 0)
      return newSelection
    })
  }

  const getRatingIcon = (rating: 'green' | 'amber' | 'red' | null) => {
    switch (rating) {
      case 'green':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'amber':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />
      case 'red':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
    }
  }

  const getRatingColor = (rating: 'green' | 'amber' | 'red' | null) => {
    switch (rating) {
      case 'green':
        return 'bg-green-50 border-green-200'
      case 'amber':
        return 'bg-amber-50 border-amber-200'
      case 'red':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const handleStart = () => {
    if (selectedEmployerIds.length === 0) return
    onStartAssessment(selectedEmployerIds)
  }

  return (
    <div className="p-4 space-y-4 pb-safe-bottom">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Select Employers to Assess</h1>
        <p className="text-sm text-muted-foreground">{projectName}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
        <Input
          placeholder="Search employers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      {/* Employer List */}
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Loading employers...</p>
        </div>
      ) : filteredEmployers.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
          <Building className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500">No employers found</p>
          {searchTerm && (
            <p className="text-sm text-gray-400 mt-1">Try a different search term</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select All */}
          <div className="flex items-center space-x-3 pb-3 border-b">
            <Checkbox
              id="select-all"
              checked={selectAllChecked}
              onCheckedChange={handleSelectAll}
              className="h-5 w-5"
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium leading-none cursor-pointer flex-1"
            >
              Select All ({filteredEmployers.length})
            </label>
          </div>

          {/* Individual Employers */}
          <div className="space-y-2">
            {filteredEmployers.map((employer) => (
              <Card
                key={employer.id}
                className={cn(
                  "transition-all",
                  selectedEmployerIds.includes(employer.id) && "ring-2 ring-blue-500",
                  getRatingColor(employer.trafficLightRating)
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id={employer.id}
                      checked={selectedEmployerIds.includes(employer.id)}
                      onCheckedChange={(checked) => handleEmployerToggle(employer.id, checked as boolean)}
                      className="h-5 w-5 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <label
                          htmlFor={employer.id}
                          className="font-medium text-sm cursor-pointer flex-1 truncate"
                        >
                          {employer.name}
                        </label>
                        {getRatingIcon(employer.trafficLightRating)}
                      </div>
                      <p className="text-xs text-muted-foreground">{employer.roleOrTrade}</p>
                      {employer.trafficLightRating && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "mt-1 text-xs",
                            employer.trafficLightRating === 'green' && "text-green-700 border-green-300",
                            employer.trafficLightRating === 'amber' && "text-amber-700 border-amber-300",
                            employer.trafficLightRating === 'red' && "text-red-700 border-red-300"
                          )}
                        >
                          {employer.trafficLightRating.charAt(0).toUpperCase() + employer.trafficLightRating.slice(1)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Start Assessment Button */}
      {selectedEmployerIds.length > 0 && (
        <div className="sticky bottom-0 pt-4 pb-safe-bottom bg-white border-t">
          <Button
            onClick={handleStart}
            size="lg"
            className="w-full h-14 text-base font-semibold"
          >
            Start Assessment ({selectedEmployerIds.length})
          </Button>
        </div>
      )}
    </div>
  )
}









