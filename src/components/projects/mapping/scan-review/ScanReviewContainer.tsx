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
import type { ExtractedMappingSheetData } from '@/types/mappingSheetScan'
import { useNavigationLoading } from '@/hooks/useNavigationLoading'

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
  
  const extractedData: ExtractedMappingSheetData = scanData.extracted_data

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

  const handleCancel = () => {
    if (allowProjectCreation && onCancel) {
      onCancel()
      return
    }
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
      startNavigation(`/projects/${projectData.id}`)
      setTimeout(() => router.push(`/projects/${projectData.id}`), 50)
    } catch (error) {
      console.error('Failed to reject scan:', error)
      toast.error('Failed to reject scan')
    }
  }

  const handleConfirmImport = async () => {
    setIsImporting(true)

    try {
      // Call API route to perform import
      const response = await fetch(`/api/projects/${projectData.id}/import-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scanId: scanData.id,
          projectDecisions,
          contactsDecisions,
          subcontractorDecisions,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Import failed')
      }

      const result = await response.json()

      // Mark scan as confirmed
      await supabase
        .from('mapping_sheet_scans')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', scanData.id)

      toast.success('Import completed successfully!', {
        description: `Updated ${result.updatedFields || 0} fields, ${result.contactsCreated || 0} contacts, ${result.subcontractorsCreated || 0} subcontractors`,
      })

      startNavigation(`/projects/${projectData.id}`)
      setTimeout(() => router.push(`/projects/${projectData.id}`), 50)
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

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {allowProjectCreation ? 'Back to Projects' : 'Back to Project'}
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
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
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
                disabled={isImporting || !allTabsVisited} 
                size="lg"
                className={!allTabsVisited ? 'opacity-50' : ''}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {allTabsVisited ? 'Confirm & Import' : `Visit All Tabs (${visitedTabs.size}/3)`}
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
