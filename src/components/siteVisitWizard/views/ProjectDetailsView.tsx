"use client"

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { WizardButton } from '../shared/WizardButton'
import { cn } from '@/lib/utils'
import { 
  Building, 
  MapPin,
  Calendar,
  DollarSign,
  Users,
  ExternalLink,
  Loader2,
  Navigation,
  Phone,
} from 'lucide-react'

interface ProjectDetailsViewProps {
  projectId: string
}

export function ProjectDetailsView({ projectId }: ProjectDetailsViewProps) {
  // Fetch full project details
  const { data: project, isLoading } = useQuery({
    queryKey: ['wizard-project-details', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          value,
          tier,
          stage_class,
          organising_universe,
          proposed_start_date,
          proposed_finish_date,
          project_type,
          main_job_site_id,
          job_sites (
            id,
            full_address,
            location,
            latitude,
            longitude
          ),
          project_assignments (
            employers (
              id,
              name,
              phone,
              enterprise_agreement_status
            ),
            contractor_role_types (
              code,
              name
            )
          )
        `)
        .eq('id', projectId)
        .single()
      
      if (error) throw error
      return data
    },
    staleTime: 30000,
  })
  
  // Get builder info
  const builder = project?.project_assignments?.find((pa: any) => 
    pa.contractor_role_types?.code === 'builder' || 
    pa.contractor_role_types?.code === 'head_contractor'
  )?.employers
  
  // Get main job site
  const mainSite = project?.job_sites?.find((s: any) => s.id === project.main_job_site_id)
    || project?.job_sites?.[0]
  
  const formatCurrency = (value: number | null) => {
    if (!value) return null
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }
  
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }
  
  const handleGetDirections = () => {
    if (mainSite?.latitude && mainSite?.longitude) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${mainSite.latitude},${mainSite.longitude}`,
        '_blank'
      )
    } else if (mainSite?.full_address) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mainSite.full_address)}`,
        '_blank'
      )
    }
  }
  
  const handleCallBuilder = () => {
    if (builder?.phone) {
      window.location.href = `tel:${builder.phone}`
    }
  }
  
  const getTierBadgeColor = (tier: string | null) => {
    switch (tier) {
      case '1': return 'bg-red-100 text-red-700'
      case '2': return 'bg-orange-100 text-orange-700'
      case '3': return 'bg-yellow-100 text-yellow-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }
  
  const getStageLabel = (stage: string | null) => {
    switch (stage) {
      case 'future': return 'Future'
      case 'pre_construction': return 'Pre-construction'
      case 'construction': return 'Construction'
      case 'archived': return 'Archived'
      default: return stage || 'Unknown'
    }
  }
  
  return (
    <div className="p-4 space-y-4 pb-safe-bottom">
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !project ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <Building className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Project not found</p>
        </div>
      ) : (
        <>
          {/* Project header */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Building className="h-8 w-8 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-gray-900">{project.name}</h2>
                {builder && (
                  <p className="text-gray-600 mt-1">{builder.name}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {project.tier && (
                    <span className={cn(
                      'px-2.5 py-1 rounded-full text-xs font-semibold',
                      getTierBadgeColor(project.tier)
                    )}>
                      Tier {project.tier}
                    </span>
                  )}
                  {project.stage_class && (
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      {getStageLabel(project.stage_class)}
                    </span>
                  )}
                  {builder?.enterprise_agreement_status === true && (
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      EBA
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Details grid */}
          <div className="grid grid-cols-1 gap-3">
            {/* Address */}
            {mainSite?.full_address && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Address</div>
                  <div className="text-gray-900 mt-0.5">{mainSite.full_address}</div>
                </div>
              </div>
            )}
            
            {/* Value */}
            {project.value && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Project Value</div>
                  <div className="text-gray-900 font-semibold mt-0.5">
                    {formatCurrency(project.value)}
                  </div>
                </div>
              </div>
            )}
            
            {/* Timeline */}
            {(project.proposed_start_date || project.proposed_finish_date) && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Timeline</div>
                  <div className="text-gray-900 mt-0.5">
                    {project.proposed_start_date && (
                      <span>Start: {formatDate(project.proposed_start_date)}</span>
                    )}
                    {project.proposed_start_date && project.proposed_finish_date && ' - '}
                    {project.proposed_finish_date && (
                      <span>Finish: {formatDate(project.proposed_finish_date)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Employer count */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-gray-600" />
              </div>
              <div className="flex-1">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Employers</div>
                <div className="text-gray-900 font-semibold mt-0.5">
                  {project.project_assignments?.length || 0} assigned
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick actions */}
          <div className="space-y-3 pt-2">
            {mainSite && (
              <WizardButton
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleGetDirections}
                icon={<Navigation className="h-5 w-5" />}
              >
                Get Directions
              </WizardButton>
            )}
            
            {builder?.phone && (
              <WizardButton
                variant="secondary"
                size="lg"
                fullWidth
                onClick={handleCallBuilder}
                icon={<Phone className="h-5 w-5" />}
              >
                Call Builder
              </WizardButton>
            )}
            
            <WizardButton
              variant="outline"
              size="md"
              fullWidth
              onClick={() => window.open(`/projects/${projectId}`, '_blank')}
              icon={<ExternalLink className="h-4 w-4" />}
            >
              Open Full Project Page
            </WizardButton>
          </div>
        </>
      )}
    </div>
  )
}

