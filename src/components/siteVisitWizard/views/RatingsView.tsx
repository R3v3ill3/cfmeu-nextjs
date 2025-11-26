"use client"

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { WizardButton } from '../shared/WizardButton'
import { ShareAuditFormGenerator } from '@/components/projects/compliance/ShareAuditFormGenerator'
import { cn } from '@/lib/utils'
import { 
  Star, 
  Building, 
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Plus,
  FileText,
} from 'lucide-react'

interface RatingsViewProps {
  projectId: string
  projectName: string
}

interface EmployerRating {
  id: string
  name: string
  trafficLightRating: 'green' | 'amber' | 'red' | null
  hasCompliance: boolean
}

export function RatingsView({ projectId, projectName }: RatingsViewProps) {
  
  // Fetch employer ratings
  const { data: ratingsData, isLoading } = useQuery({
    queryKey: ['wizard-employer-ratings', projectId],
    queryFn: async () => {
      // Get employers assigned to this project
      const { data: assignments, error } = await supabase
        .from('project_assignments')
        .select(`
          employers (
            id,
            name
          )
        `)
        .eq('project_id', projectId)
      
      if (error) throw error
      
      // Get unique employers
      const employerMap = new Map<string, { id: string; name: string }>()
      ;(assignments || []).forEach((a: any) => {
        if (a.employers?.id) {
          employerMap.set(a.employers.id, {
            id: a.employers.id,
            name: a.employers.name,
          })
        }
      })
      
      const employerIds = Array.from(employerMap.keys())
      
      if (employerIds.length === 0) {
        return { employers: [], summary: { green: 0, amber: 0, red: 0, unknown: 0 } }
      }
      
      // Get compliance checks for these employers
      const { data: complianceData } = await supabase
        .from('employer_compliance_checks')
        .select('employer_id, traffic_light_rating')
        .eq('project_id', projectId)
        .eq('is_current', true)
        .in('employer_id', employerIds)
      
      // Map compliance data
      const complianceMap = new Map<string, string>()
      ;(complianceData || []).forEach((c: any) => {
        complianceMap.set(c.employer_id, c.traffic_light_rating)
      })
      
      // Build employer ratings
      const employers: EmployerRating[] = Array.from(employerMap.values()).map(emp => ({
        id: emp.id,
        name: emp.name,
        trafficLightRating: (complianceMap.get(emp.id) as 'green' | 'amber' | 'red') || null,
        hasCompliance: complianceMap.has(emp.id),
      }))
      
      // Sort: rated first (green, amber, red), then unrated
      employers.sort((a, b) => {
        const order = { green: 0, amber: 1, red: 2, null: 3 }
        return (order[a.trafficLightRating ?? 'null'] ?? 3) - (order[b.trafficLightRating ?? 'null'] ?? 3)
      })
      
      // Calculate summary
      const summary = {
        green: employers.filter(e => e.trafficLightRating === 'green').length,
        amber: employers.filter(e => e.trafficLightRating === 'amber').length,
        red: employers.filter(e => e.trafficLightRating === 'red').length,
        unknown: employers.filter(e => !e.trafficLightRating).length,
      }
      
      return { employers, summary }
    },
    staleTime: 30000,
  })
  
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
        return 'bg-green-100 border-green-200'
      case 'amber':
        return 'bg-amber-100 border-amber-200'
      case 'red':
        return 'bg-red-100 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  // Navigate to employer selection page for assessments
  const handleAddRating = () => {
    window.location.href = `/mobile/projects/${projectId}/assessments`
  }

  // Navigate to full compliance view
  const handleFullComplianceView = () => {
    window.open(`/projects/${projectId}?tab=compliance`, '_blank')
  }
  
  return (
    <div className="p-4 space-y-4 pb-safe-bottom">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Traffic light summary */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-green-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-green-700">
                {ratingsData?.summary.green || 0}
              </div>
              <div className="text-xs text-green-600 mt-0.5">Green</div>
            </div>
            <div className="bg-amber-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-amber-700">
                {ratingsData?.summary.amber || 0}
              </div>
              <div className="text-xs text-amber-600 mt-0.5">Amber</div>
            </div>
            <div className="bg-red-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-red-700">
                {ratingsData?.summary.red || 0}
              </div>
              <div className="text-xs text-red-600 mt-0.5">Red</div>
            </div>
            <div className="bg-gray-100 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">
                {ratingsData?.summary.unknown || 0}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">Unknown</div>
            </div>
          </div>
          
          {/* Employer list */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide px-1">
              Employer Ratings
            </h3>
            
            {ratingsData?.employers.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
                <Star className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No employers assigned</p>
                <p className="text-sm text-gray-400 mt-1">
                  Use &quot;Add Rating&quot; below to start auditing employers
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {ratingsData?.employers.slice(0, 5).map((employer) => (
                  <div 
                    key={employer.id}
                    className={cn(
                      'rounded-xl border p-4 flex items-center justify-between',
                      getRatingColor(employer.trafficLightRating)
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {employer.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {employer.hasCompliance ? 'Compliance checked' : 'Not checked'}
                        </div>
                      </div>
                    </div>
                    {getRatingIcon(employer.trafficLightRating)}
                  </div>
                ))}
                {(ratingsData?.employers.length || 0) > 5 && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    + {(ratingsData?.employers.length || 0) - 5} more employers
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Actions - 3 distinct options */}
      <div className="space-y-3 pt-4">
        {/* 1. Add Rating - opens the mobile compliance audit workflow */}
        <WizardButton
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleAddRating}
          icon={<Plus className="h-5 w-5" />}
        >
          Add Rating
        </WizardButton>
        
        {/* 2. Share Audit Form - generates shareable link/QR */}
        <ShareAuditFormGenerator
          projectId={projectId}
          projectName={projectName}
        />
        
        {/* 3. Full Compliance View - opens detailed view */}
        <WizardButton
          variant="outline"
          size="md"
          fullWidth
          onClick={handleFullComplianceView}
          icon={<FileText className="h-4 w-4" />}
        >
          Full Compliance View
        </WizardButton>
      </div>
    </div>
  )
}
