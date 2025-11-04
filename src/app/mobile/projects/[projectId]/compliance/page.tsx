"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { MobileComplianceAudit } from '@/components/mobile/workflows/MobileComplianceAudit'
import { useOfflineSync } from '@/hooks/mobile/useOfflineSync'
import { useMobileOptimizations } from '@/hooks/mobile/useMobileOptimizations'
import { useToast } from '@/hooks/use-toast'
import { MobileLoadingState } from '@/components/mobile/shared/MobileOptimizationProvider'

interface ProjectData {
  id: string
  name: string
  address: string
  status: string
  employer_id?: string
  primary_trade?: string
  site_contact?: string
  site_phone?: string
  coordinates?: {
    lat: number
    lng: number
  }
}

interface ComplianceAuditData {
  id: string
  project_id: string
  employer_id: string
  audit_date: string
  auditor_id: string
  overall_rating: 'green' | 'amber' | 'red'
  confidence_level: 'high' | 'medium' | 'low'
  sections: {
    safety: {
      rating: 'green' | 'amber' | 'red'
      score: number
      notes: string
      evidence: Array<{
        id: string
        type: 'photo' | 'document' | 'note'
        url?: string
        description: string
        timestamp: string
      }>
      issues: Array<{
        id: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        action_required: string
        deadline?: string
        resolved: boolean
      }>
    }
    union_rights: {
      rating: 'green' | 'amber' | 'red'
      score: number
      notes: string
      evidence: Array<{
        id: string
        type: 'photo' | 'document' | 'note'
        url?: string
        description: string
        timestamp: string
      }>
      issues: Array<{
        id: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        action_required: string
        deadline?: string
        resolved: boolean
      }>
    }
    workplace_conditions: {
      rating: 'green' | 'amber' | 'red'
      score: number
      notes: string
      evidence: Array<{
        id: string
        type: 'photo' | 'document' | 'note'
        url?: string
        description: string
        timestamp: string
      }>
      issues: Array<{
        id: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        action_required: string
        deadline?: string
        resolved: boolean
      }>
    }
    communication: {
      rating: 'green' | 'amber' | 'red'
      score: number
      notes: string
      evidence: Array<{
        id: string
        type: 'photo' | 'document' | 'note'
        url?: string
        description: string
        timestamp: string
      }>
      issues: Array<{
        id: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        description: string
        action_required: string
        deadline?: string
        resolved: boolean
      }>
    }
  }
  delegate_interviews: Array<{
    id: string
    delegate_name: string
    role: string
    interview_date: string
    concerns_raised: string[]
    positive_feedback: string[]
    action_items: string[]
  }>
  recommendations: Array<{
    id: string
    priority: 'high' | 'medium' | 'low'
    category: string
    description: string
    responsible_party: string
    deadline?: string
    status: 'pending' | 'in_progress' | 'completed'
  }>
  follow_up_required: boolean
  follow_up_date?: string
  created_at: string
  updated_at: string
}

export default function MobileComplianceAuditPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = params.projectId as string
  const { toast } = useToast()

  const {
    debounce,
    isMobile,
    isLowEndDevice,
  } = useMobileOptimizations({
    enableDebouncing: true,
    debounceDelay: 300,
  })

  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const {
    data: auditData,
    loading: syncLoading,
    isOnline,
    pendingSync,
    addItem,
    updateItem,
    forceSync,
  } = useOfflineSync<ComplianceAuditData>([], {
    storageKey: `compliance-audit-${projectId}`,
    autoSync: true,
    syncInterval: 30000,
    maxRetries: 5,
  })

  // Load project data
  useEffect(() => {
    const loadProjectData = async () => {
      try {
        // In a real app, this would fetch from your API
        // For now, we'll use mock data
        const mockProject: ProjectData = {
          id: projectId,
          name: "Sydney Metro Expansion",
          address: "123 Construction Site, Sydney NSW 2000",
          status: "active",
          employer_id: "emp_123",
          primary_trade: "Construction",
          site_contact: "John Smith",
          site_phone: "0412 345 678",
          coordinates: {
            lat: -33.8688,
            lng: 151.2093,
          },
        }

        setProjectData(mockProject)
      } catch (error) {
        console.error('Error loading project data:', error)
        toast({
          title: "Error",
          description: "Failed to load project data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (projectId) {
      loadProjectData()
    }
  }, [projectId, toast])

  // Handle form submission
  const handleSubmit = useCallback(async (data: Partial<ComplianceAuditData>) => {
    if (!projectData) return

    setSubmitting(true)
    try {
      const auditData: ComplianceAuditData = {
        id: `audit-${Date.now()}`,
        project_id: projectId,
        employer_id: projectData.employer_id || '',
        audit_date: new Date().toISOString(),
        auditor_id: "current_user", // This would come from auth context
        overall_rating: data.overall_rating || 'amber',
        confidence_level: data.confidence_level || 'medium',
        sections: data.sections || {
          safety: {
            rating: 'amber',
            score: 50,
            notes: '',
            evidence: [],
            issues: []
          },
          union_rights: {
            rating: 'amber',
            score: 50,
            notes: '',
            evidence: [],
            issues: []
          },
          workplace_conditions: {
            rating: 'amber',
            score: 50,
            notes: '',
            evidence: [],
            issues: []
          },
          communication: {
            rating: 'amber',
            score: 50,
            notes: '',
            evidence: [],
            issues: []
          }
        },
        delegate_interviews: data.delegate_interviews || [],
        recommendations: data.recommendations || [],
        follow_up_required: data.follow_up_required || false,
        follow_up_date: data.follow_up_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Save through the sync system
      await addItem(auditData)

      toast({
        title: "Compliance audit saved",
        description: isOnline
          ? "Compliance audit has been saved and synced"
          : "Compliance audit saved locally. Will sync when online.",
      })

      // Navigate back to project view
      router.push(`/mobile/projects/${projectId}`)
    } catch (error) {
      console.error('Error saving audit:', error)
      toast({
        title: "Save failed",
        description: "Failed to save compliance audit. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSubmitting(false)
    }
  }, [projectData, projectId, addItem, isOnline, toast, router])

  // Handle partial saves (auto-save)
  const handlePartialSave = useCallback(debounce(async (data: Partial<ComplianceAuditData>) => {
    if (!projectData) return

    try {
      const partialAudit = {
        project_id: projectId,
        employer_id: projectData.employer_id,
        updated_at: new Date().toISOString(),
        ...data
      } as Partial<ComplianceAuditData>

      // Save to localStorage for immediate persistence
      const existingKey = `compliance-audit-${projectId}-draft`
      const existing = localStorage.getItem(existingKey)
      const currentData = existing ? JSON.parse(existing) : {}
      const updatedData = { ...currentData, ...partialAudit }

      localStorage.setItem(existingKey, JSON.stringify(updatedData))

      // If we have a complete audit in the sync system, update it
      if (auditData && auditData.length > 0) {
        await updateItem(auditData[0].id, partialAudit)
      }
    } catch (error) {
      console.error('Error in auto-save:', error)
      // Don't show toast for auto-save errors to avoid annoying users
    }
  }, 2000), [projectData, projectId, auditData, updateItem, debounce])

  if (loading || syncLoading) {
    return <MobileLoadingState message="Loading compliance audit..." />
  }

  if (!projectData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
          <p className="text-gray-600 mb-4">The project you're looking for doesn't exist or you don't have access to it.</p>
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
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 p-2">
          <div className="flex items-center justify-center gap-2 text-sm text-amber-800">
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
            <span>Offline mode - Changes will be saved locally</span>
          </div>
        </div>
      )}

      {/* Pending sync indicator */}
      {isOnline && pendingSync > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 p-2">
          <div className="flex items-center justify-center gap-2 text-sm text-blue-800">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            <span>{pendingSync} changes pending sync</span>
            <button
              onClick={forceSync}
              className="text-blue-600 underline text-xs"
            >
              Sync now
            </button>
          </div>
        </div>
      )}

      <MobileComplianceAudit
        projectData={projectData}
        initialData={auditData?.[0]}
        onSubmit={handleSubmit}
        onPartialSave={handlePartialSave}
        submitting={submitting}
        isOnline={isOnline}
        isLowEndDevice={isLowEndDevice}
      />
    </div>
  )
}