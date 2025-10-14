"use client"

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Building2,
  ArrowLeft,
  X,
  Loader2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { ProjectFieldsReview } from './ProjectFieldsReview'
import { SiteContactsReview } from './SiteContactsReview'
import { SubcontractorsReview } from './SubcontractorsReview'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { DuplicateProjectWarning } from './DuplicateProjectWarning'
import type { ExtractedMappingSheetData } from '@/types/mappingSheetScan'
import { useNavigationLoading } from '@/hooks/useNavigationLoading'
import { normalizeSiteContactRole } from '@/utils/siteContactRole'

interface ScanReviewContainerProps {
  scanData: any
  projectData: any
  existingContacts: any[]
  allowProjectCreation?: boolean
  onCancel?: () => void
}

export function ScanReviewContainer({
  scanData,
  projectData,
  existingContacts,
  allowProjectCreation = false,
  onCancel,
}: ScanReviewContainerProps) {
  const router = useRouter()
  const { startNavigation } = useNavigationLoading()
  const [activeTab, setActiveTab] = useState('project')
  const [isImporting, setIsImporting] = useState(false)
  const [duplicateCheck, setDuplicateCheck] = useState<any>(null)
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false)
  const [allowProceed, setAllowProceed] = useState(false)
  const [linkedProjectId, setLinkedProjectId] = useState<string | null>(null)

  const extractedData: ExtractedMappingSheetData =
    (scanData.extracted_data as ExtractedMappingSheetData | null) ?? {
      extraction_version: 'unknown',
      pages_processed: 0,
      project: {},
      site_contacts: [],
      subcontractors: [],
      confidence: {
        overall: 0,
        project: {},
        site_contacts: [],
        subcontractors: [],
      },
    }

  // Track user decisions for each section
  const [projectDecisions, setProjectDecisions] = useState<Record<string, any>>({})
  const [contactsDecisions, setContactsDecisions] = useState<any[]>([])
  const [subcontractorDecisions, setSubcontractorDecisions] = useState<any[]>([])

  // Track which tabs have been visited (simpler approach)
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['project'])) // Start with project tab visited

  // Check if all tabs have been visited
  const allTabsVisited = visitedTabs.has('project') && 
                         visitedTabs.has('contacts') && 
                         visitedTabs.has('subcontractors')

  // Update scan status to under_review when component mounts
  useEffect(() => {
    if (scanData.status === 'completed') {
      supabase
        .from('mapping_sheet_scans')
        .update({
          status: 'under_review',
          review_started_at: new Date().toISOString(),
        })
        .eq('id', scanData.id)
        .then()
    }
  }, [scanData.id, scanData.status])

  // Check for duplicate project names when creating new project
  useEffect(() => {
    if (!allowProjectCreation) return

    const projectName = projectDecisions.name || extractedData.project?.project_name || projectData?.name

    if (!projectName) return

    const checkDuplicates = async () => {
      setIsCheckingDuplicates(true)
      try {
        const { data, error } = await supabase.rpc('check_duplicate_project_names', {
          p_project_name: projectName,
          p_exclude_project_id: null,
        })

        if (error) throw error

        if (data && (data.has_exact_matches || data.has_fuzzy_matches)) {
          setDuplicateCheck(data)
          setAllowProceed(false) // User must acknowledge duplicates
        } else {
          setDuplicateCheck(null)
          setAllowProceed(true)
        }
      } catch (error) {
        console.error('Error checking for duplicates:', error)
        // Allow proceed on error to not block the user
        setAllowProceed(true)
      } finally {
        setIsCheckingDuplicates(false)
      }
    }

    checkDuplicates()
  }, [allowProjectCreation, projectDecisions.name, extractedData.project?.project_name, projectData?.name])

  const handleCancel = () => {
    if (allowProjectCreation && onCancel) {
      onCancel()
      return
    }

    // If part of batch upload, go back to batch detail page
    if (scanData.batch_id) {
      startNavigation(`/projects/batches/${scanData.batch_id}`)
      setTimeout(() => router.push(`/projects/batches/${scanData.batch_id}`), 50)
      return
    }

    // Otherwise go to project
    startNavigation(`/projects/${projectData.id}`)
    setTimeout(() => router.push(`/projects/${projectData.id}`), 50)
  }

  const handleReject = async () => {
    if (!confirm('Are you sure you want to reject this scan? This cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('mapping_sheet_scans')
        .update({ status: 'rejected' })
        .eq('id', scanData.id)

      if (error) throw error

      toast.success('Scan rejected')

      // If part of batch upload, go back to batch detail page
      if (scanData.batch_id) {
        startNavigation(`/projects/batches/${scanData.batch_id}`)
        setTimeout(() => router.push(`/projects/batches/${scanData.batch_id}`), 50)
      } else {
        startNavigation(`/projects/${projectData.id}`)
        setTimeout(() => router.push(`/projects/${projectData.id}`), 50)
      }
    } catch (error) {
      console.error('Failed to reject scan:', error)
      toast.error('Failed to reject scan')
    }
  }

  const handleLinkToExistingProject = async (projectId: string) => {
    try {
      setLinkedProjectId(projectId)
      // Update scan to link to existing project instead of creating new
      const { error } = await supabase
        .from('mapping_sheet_scans')
        .update({
          project_id: projectId,
          upload_mode: 'existing_project',
        })
        .eq('id', scanData.id)

      if (error) throw error

      toast.success('Scan linked to existing project')

      // Navigate to the scan review page for the existing project
      startNavigation(`/projects/${projectId}/scan-review/${scanData.id}`)
      setTimeout(() => router.push(`/projects/${projectId}/scan-review/${scanData.id}`), 50)
    } catch (error) {
      console.error('Failed to link to project:', error)
      toast.error('Failed to link to project')
    }
  }

  const handleProceedAnyway = () => {
    setAllowProceed(true)
    toast.info('Proceeding with new project creation')
  }

  const handleConfirmImport = async () => {
    setIsImporting(true)

    const normalizedContacts = contactsDecisions
      .map((contact) => ({
        action: contact.action,
        existingId: contact.existingId,
        role: normalizeSiteContactRole(contact.role),
        name: contact.name?.trim() || null,
        email: contact.email?.trim() || null,
        phone: contact.phone?.trim() || null,
      }))
      .filter((contact) => contact.action === 'update' && (contact.existingId || contact.role))

    const payload = {
      scanId: scanData.id,
      projectDecisions,
      contactsDecisions: normalizedContacts,
      subcontractorDecisions,
    }

    const targetUrl = allowProjectCreation
      ? `/api/projects/new-from-scan`
      : `/api/projects/${projectData.id}/import-scan`

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || error.message || 'Import failed')
      }

      const result = await response.json()

      const descriptionParts: string[] = []

      if (allowProjectCreation) {
        descriptionParts.push(
          `Created new project and staged ${contactsDecisions.length} contacts, ${subcontractorDecisions.length} subcontractors`
        )
      } else {
        descriptionParts.push(
          `Updated ${result.updatedFields || 0} fields, ${result.contactsCreated || 0} contacts, ${result.subcontractorsCreated || 0} subcontractors`
        )
      }

      if (result.organisingUniverseUpdated) {
        descriptionParts.push('Organising universe set to Active')
      }

      toast.success('Import completed successfully!', {
        description: descriptionParts.join(' • '),
      })

      if (allowProjectCreation && result.projectId) {
        startNavigation(`/projects/${result.projectId}`)
        setTimeout(() => router.push(`/projects/${result.projectId}`), 50)
      } else {
        // If part of batch upload, go back to batch detail page
        if (scanData.batch_id) {
          startNavigation(`/projects/batches/${scanData.batch_id}`)
          setTimeout(() => router.push(`/projects/batches/${scanData.batch_id}`), 50)
        } else {
          // Otherwise go to project
          startNavigation(`/projects/${projectData.id}`)
          setTimeout(() => router.push(`/projects/${projectData.id}`), 50)
        }
      }
    } catch (error) {
      console.error('Import error:', error)
      toast.error('Import failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const overallConfidence = extractedData?.confidence?.overall || 0
  const extractedDataMissing = !scanData.extracted_data

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {allowProjectCreation ? 'Back to Projects' : scanData.batch_id ? 'Back to Batch' : 'Back to Project'}
              </Button>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Review Scanned Mapping Sheet
                </h1>
                <p className="text-sm text-gray-600 mt-1">{projectData.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ConfidenceIndicator confidence={overallConfidence} showLabel />
              <Badge variant={scanData.ai_provider === 'claude' ? 'default' : 'secondary'}>
                {scanData.ai_provider === 'claude' ? 'Claude AI' : 'OpenAI'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {extractedData?.warnings && extractedData.warnings.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>Extraction warnings:</strong>
          <ul className="list-disc list-inside mt-2">
            {extractedData.warnings.map((warning, i) => (
              <li key={i} className="text-sm">{warning}</li>
            ))}
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  )}

      {extractedDataMissing && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              AI extraction results were unavailable for this scan. Please review and enter the project details manually before importing.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Duplicate Project Warning */}
      {allowProjectCreation && duplicateCheck && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <DuplicateProjectWarning
            duplicateCheck={duplicateCheck}
            onLinkToProject={handleLinkToExistingProject}
            onProceedAnyway={handleProceedAnyway}
          />
        </div>
      )}

      {/* Review Progress Alert */}
      {!allTabsVisited && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Review Required:</strong> Please visit all tabs before importing.
              {!visitedTabs.has('project') && ' • Project Details'}
              {!visitedTabs.has('contacts') && ' • Site Contacts'}
              {!visitedTabs.has('subcontractors') && ' • Subcontractors'}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(tab) => {
          setActiveTab(tab)
          // Mark tab as visited
          setVisitedTabs(prev => new Set(prev).add(tab))
        }}>
          <TabsList className="grid w-full grid-cols-3 max-w-2xl">
            <TabsTrigger value="project" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Project Details
              {visitedTabs.has('project') && <CheckCircle2 className="h-3 w-3 ml-1 text-green-600" />}
            </TabsTrigger>
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Site Contacts
              {visitedTabs.has('contacts') && <CheckCircle2 className="h-3 w-3 ml-1 text-green-600" />}
            </TabsTrigger>
            <TabsTrigger value="subcontractors" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Subcontractors
              {visitedTabs.has('subcontractors') && <CheckCircle2 className="h-3 w-3 ml-1 text-green-600" />}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="project" className="mt-6">
            <ProjectFieldsReview
              extractedData={extractedData.project || {}}
              existingData={projectData}
              confidence={extractedData.confidence?.project || {}}
              onDecisionsChange={setProjectDecisions}
              allowProjectCreation={allowProjectCreation}
            />
          </TabsContent>

          <TabsContent value="contacts" className="mt-6">
            <SiteContactsReview
              extractedContacts={extractedData.site_contacts || []}
              existingContacts={existingContacts}
              confidence={extractedData.confidence?.site_contacts || []}
              onDecisionsChange={setContactsDecisions}
            />
          </TabsContent>

          <TabsContent value="subcontractors" className="mt-6">
            <SubcontractorsReview
              extractedSubcontractors={extractedData.subcontractors || []}
              projectId={projectData.id}
              confidence={extractedData.confidence?.subcontractors || []}
              onDecisionsChange={setSubcontractorDecisions}
              allowProjectCreation={allowProjectCreation}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReject} disabled={isImporting}>
              <X className="h-4 w-4 mr-2" />
              Reject Scan
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleCancel} disabled={isImporting}>
                {allowProjectCreation ? 'Cancel' : 'Save & Continue Later'}
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={isImporting || !allTabsVisited || (allowProjectCreation && duplicateCheck && !allowProceed)}
                size="lg"
                className={(!allTabsVisited || (allowProjectCreation && duplicateCheck && !allowProceed)) ? 'opacity-50' : ''}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : isCheckingDuplicates ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Checking duplicates...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {!allTabsVisited
                      ? `Visit All Tabs (${visitedTabs.size}/3)`
                      : (allowProjectCreation && duplicateCheck && !allowProceed)
                        ? 'Review Duplicate Matches'
                        : 'Confirm & Import'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
