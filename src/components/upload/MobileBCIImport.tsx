"use client"

import { useState, useEffect, useCallback } from 'react'
import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Building,
  Users,
  ArrowRight
} from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { mapBciStageToStageClass } from '@/utils/stageClassification'
import { WizardButton } from '@/components/siteVisitWizard/shared/WizardButton'
import type { 
  BCINormalizedProject, 
  BCINormalizedCompany,
  SelectedProject 
} from '@/components/siteVisitWizard/hooks/useWizardState'

interface MobileBCIImportProps {
  project: BCINormalizedProject
  companies: BCINormalizedCompany[]
  onComplete: (project: SelectedProject) => void
  onError: (error: string) => void
}

type ImportStep = 'importing' | 'complete' | 'error'

interface ImportProgress {
  step: string
  current: number
  total: number
}

export function MobileBCIImport({
  project,
  companies,
  onComplete,
  onError,
}: MobileBCIImportProps) {
  const [step, setStep] = useState<ImportStep>('importing')
  const [progress, setProgress] = useState<ImportProgress>({
    step: 'Preparing import...',
    current: 0,
    total: 3,
  })
  const [results, setResults] = useState<{
    projectId: string | null
    projectName: string
    jobSiteId: string | null
    employersStaged: number
    errors: string[]
  }>({
    projectId: null,
    projectName: project.projectName,
    jobSiteId: null,
    employersStaged: 0,
    errors: [],
  })

  const runImport = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    const errors: string[] = []
    
    try {
      // Step 1: Check if project already exists
      setProgress({ step: 'Checking for existing project...', current: 1, total: 3 })
      
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id, name, main_job_site_id')
        .eq('bci_project_id', project.projectId)
        .maybeSingle()
      
      let projectId: string
      let jobSiteId: string | null = null
      
      if (existingProject) {
        // Project already exists, use it
        projectId = existingProject.id
        jobSiteId = existingProject.main_job_site_id
        console.log(`[MobileBCIImport] Project ${project.projectId} already exists: ${projectId}`)
      } else {
        // Step 2: Create new project
        setProgress({ step: 'Creating project...', current: 2, total: 3 })
        
        const fullAddress = [
          project.projectAddress,
          project.projectTown,
          project.projectState,
          project.postCode,
        ].filter(Boolean).join(', ')
        
        const { data: newProject, error: projectError } = await supabase
          .from('projects')
          .insert({
            name: project.projectName || `Project ${project.projectId}`,
            bci_project_id: project.projectId,
            value: project.localValue || 0,
            project_stage: project.projectStage,
            project_status: project.projectStatus,
            stage_class: mapBciStageToStageClass(project.projectStage, project.projectStatus),
          } as Record<string, unknown>)
          .select('id')
          .single()
        
        if (projectError) {
          throw new Error(`Failed to create project: ${projectError.message}`)
        }
        
        projectId = newProject.id
        
        // Create job site
        const { data: newSite, error: siteError } = await supabase
          .from('job_sites')
          .insert({
            name: project.projectName || `Project ${project.projectId}`,
            location: fullAddress,
            full_address: fullAddress,
            project_id: projectId,
            is_main_site: true,
            latitude: project.latitude,
            longitude: project.longitude,
          } as Record<string, unknown>)
          .select('id')
          .single()
        
        if (siteError) {
          errors.push(`Job site creation warning: ${siteError.message}`)
        } else {
          jobSiteId = newSite.id
          // Link job site to project
          await supabase
            .from('projects')
            .update({ main_job_site_id: jobSiteId } as Record<string, unknown>)
            .eq('id', projectId)
        }
        
        console.log(`[MobileBCIImport] Created project ${projectId} with job site ${jobSiteId}`)
      }
      
      // Step 3: Stage employers to pending_employers
      setProgress({ step: 'Staging employers...', current: 3, total: 3 })
      
      // Filter companies for this project
      const projectCompanies = companies.filter(c => c.projectId === project.projectId)
      let employersStaged = 0
      
      if (projectCompanies.length > 0) {
        // Skip non-construction roles
        const skipRoles = ['design', 'engineer', 'consultant', 'assessment', 'acoustic', 'fire', 'environmental', 'planning', 'architect', 'surveyor', 'auditor']
        
        // Group companies by ID or name
        const employerGroups = new Map<string, {
          companyId?: string
          companyName: string
          csvRole: string
        }>()
        
        for (const company of projectCompanies) {
          // Skip empty names
          if (!company.companyName || company.companyName.trim() === '') {
            continue
          }
          
          // Skip non-construction roles
          const role = (company.roleOnProject || '').toLowerCase()
          if (skipRoles.some(skip => role.includes(skip))) {
            continue
          }
          
          // Use company ID or normalized name as key for deduplication
          const key = company.companyId || company.companyName.toLowerCase().trim()
          
          if (!employerGroups.has(key)) {
            employerGroups.set(key, {
              companyId: company.companyId,
              companyName: company.companyName,
              csvRole: company.roleOnProject,
            })
          }
        }
        
        // Insert to pending_employers
        const pendingEmployers = Array.from(employerGroups.values()).map(emp => ({
          company_name: emp.companyName,
          csv_role: emp.csvRole,
          source: 'bci_mobile',
          bci_company_id: emp.companyId || null,
          project_associations: [{
            project_id: project.projectId,
            project_name: project.projectName,
            csv_role: emp.csvRole,
          }],
        }))
        
        if (pendingEmployers.length > 0) {
          const { error: pendingError } = await supabase
            .from('pending_employers')
            .upsert(pendingEmployers, {
              onConflict: 'bci_company_id',
              ignoreDuplicates: false,
            })
          
          if (pendingError) {
            console.warn('[MobileBCIImport] Pending employers warning:', pendingError)
            // Don't fail the import for this
          } else {
            employersStaged = pendingEmployers.length
          }
        }
      }
      
      // Complete!
      setResults({
        projectId,
        projectName: project.projectName,
        jobSiteId,
        employersStaged,
        errors,
      })
      setStep('complete')
      
    } catch (err) {
      console.error('[MobileBCIImport] Import error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Import failed'
      setResults(prev => ({
        ...prev,
        errors: [...prev.errors, errorMessage],
      }))
      setStep('error')
      onError(errorMessage)
    }
  }, [project, companies, onError])

  // Start import on mount
  useEffect(() => {
    runImport()
  }, [runImport])

  const handleContinue = () => {
    if (results.projectId) {
      onComplete({
        id: results.projectId,
        name: results.projectName,
        address: [
          project.projectAddress,
          project.projectTown,
          project.projectState,
        ].filter(Boolean).join(', ') || null,
        builderName: null,
        mainJobSiteId: results.jobSiteId,
      })
    }
  }

  return (
    <div className="p-4 space-y-6 pb-safe-bottom">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">
          {step === 'importing' && 'Importing Project...'}
          {step === 'complete' && 'Import Complete!'}
          {step === 'error' && 'Import Failed'}
        </h1>
        <p className="text-gray-600">
          {project.projectName}
        </p>
      </div>

      {/* Progress/Status */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
            <div className="text-center">
              <p className="font-semibold text-gray-900">{progress.step}</p>
              <p className="text-sm text-gray-500 mt-1">
                Step {progress.current} of {progress.total}
              </p>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <p className="font-semibold text-gray-900 text-center">
                Project imported successfully
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <Building className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Project</p>
                  <p className="font-medium text-gray-900">{results.projectName}</p>
                </div>
              </div>

              {results.employersStaged > 0 && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Users className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Employers staged</p>
                    <p className="font-medium text-gray-900">
                      {results.employersStaged} employer{results.employersStaged !== 1 ? 's' : ''} ready for review
                    </p>
                  </div>
                </div>
              )}
            </div>

            {results.errors.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> {results.errors.join('. ')}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-600" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-900">Something went wrong</p>
              <p className="text-sm text-red-600 mt-2">
                {results.errors[results.errors.length - 1] || 'Unknown error'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {step === 'complete' && (
        <WizardButton
          variant="primary"
          onClick={handleContinue}
          className="w-full"
        >
          Continue to Site Visit
          <ArrowRight className="h-5 w-5 ml-2" />
        </WizardButton>
      )}
    </div>
  )
}
