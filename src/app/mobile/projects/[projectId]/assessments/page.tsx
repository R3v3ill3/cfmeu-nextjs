"use client"

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { MobileEmployerSelection } from '@/components/mobile/assessments/MobileEmployerSelection'
import { Loader2 } from 'lucide-react'

export default function MobileAssessmentsPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  // Fetch project data
  const { data: projectData, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', projectId)
        .single()

      if (error) throw error
      return data
    },
  })

  const handleStartAssessment = (selectedEmployerIds: string[]) => {
    if (selectedEmployerIds.length === 0) return
    
    // Navigate to first employer's assessment page
    // Store selected employer IDs in sessionStorage for navigation
    sessionStorage.setItem(`assessment-employers-${projectId}`, JSON.stringify(selectedEmployerIds))
    router.push(`/mobile/projects/${projectId}/assessments/${selectedEmployerIds[0]}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-sm text-muted-foreground">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!projectData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Project not found</h2>
          <p className="text-gray-600">The project you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MobileEmployerSelection
        projectId={projectId}
        projectName={projectData.name || 'Unknown Project'}
        onStartAssessment={handleStartAssessment}
      />
    </div>
  )
}



