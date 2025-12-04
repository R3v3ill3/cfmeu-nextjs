'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { PDFDocument } from 'pdf-lib'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Search,
  Brain,
  BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import { splitPdfByProjects, ProjectDefinition, SplitResult } from '@/lib/pdf/splitPdfByProjects'
import { uploadSplitPdfs } from '@/lib/pdf/uploadSplitPdfs'
import { OptimizedPdfProcessor, OptimizedPdfUploader } from '@/lib/pdf/optimizedPdfProcessor'
import { AdaptivePoller, RequestDeduplicator, PerformanceMonitor } from '@/lib/performance/adaptivePolling'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ProjectSearchDialog } from './ProjectSearchDialog'
import { BatchManagementDashboard } from './BatchManagementDashboard'

type Step = 'upload' | 'analyze' | 'define' | 'processing' | 'complete'

interface Project {
  id: string
  project_name: string
  project_address: string
  project_number: string | null
  builder: string | null
}

interface ProjectDefinitionForm extends ProjectDefinition {
  id: string
  tentativeName?: string
  tentativeAddress?: string | null
  confidence?: number
  mode: 'new' | 'match' | 'skip'
}

interface AnalysisResult {
  projects: Array<{
    startPage: number
    endPage: number
    projectName: string
    projectAddress?: string | null
    confidence: number
    reasoning?: string
  }>
  totalPages: number
  detectionMethod: string
  notes?: string[]
}

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Progress persistence utilities
const PROGRESS_STORAGE_KEY = 'bulk_upload_progress'

interface SavedProgress {
  step: Step
  file: {
    name: string
    size: number
    lastModified: number
  } | null
  totalPages: number
  projectDefinitions: ProjectDefinitionForm[]
  batchId: string
  batchUploaderId: string
  useAI: boolean
  aiAnalysis: AnalysisResult | null
  selectedProjects: Record<string, Project>
  timestamp: number
}

export function BulkUploadDialog({ open, onOpenChange }: BulkUploadDialogProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [projectDefinitions, setProjectDefinitions] = useState<ProjectDefinitionForm[]>([])
  const [batchId, setBatchId] = useState<string>('')
  const [batchUploaderId, setBatchUploaderId] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processingStatus, setProcessingStatus] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [completedScans, setCompletedScans] = useState(0)
  const [totalScans, setTotalScans] = useState(0)
  const [useAI, setUseAI] = useState(true)
  const [aiAnalysis, setAiAnalysis] = useState<AnalysisResult | null>(null)
  const [searchDialogOpen, setSearchDialogOpen] = useState(false)
  const [searchingForDefId, setSearchingForDefId] = useState<string | null>(null)
  const [selectedProjects, setSelectedProjects] = useState<Record<string, Project>>({})
  const [screenReaderAnnouncement, setScreenReaderAnnouncement] = useState('')
  const announcementRef = useRef<HTMLDivElement>(null)

  // Progress persistence and cancellation
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [savedProgress, setSavedProgress] = useState<SavedProgress | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Performance optimization state
  const [useOptimizedProcessing, setUseOptimizedProcessing] = useState(true)
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null)
  const [processingStats, setProcessingStats] = useState({
    memoryUsage: 0,
    processingTime: 0,
    networkRequests: 0
  })

  // Refs for performance utilities
  const adaptivePollerRef = useRef<AdaptivePoller | null>(null)
  const requestDeduplicatorRef = useRef<RequestDeduplicator | null>(null)
  const performanceMonitorRef = useRef<PerformanceMonitor | null>(null)
  const pdfProcessorRef = useRef<OptimizedPdfProcessor | null>(null)
  const pdfUploaderRef = useRef<OptimizedPdfUploader | null>(null)

  // Dashboard state
  const [dashboardOpen, setDashboardOpen] = useState(false)

  // Screen reader announcements
  const announceToScreenReader = useCallback((message: string) => {
    setScreenReaderAnnouncement(message)
    // Clear announcement after it's been read
    setTimeout(() => setScreenReaderAnnouncement(''), 1000)
  }, [])

  // Progress persistence functions
  const saveProgress = useCallback(() => {
    if (!file || step === 'upload') return

    const progress: SavedProgress = {
      step,
      file: {
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
      },
      totalPages,
      projectDefinitions,
      batchId,
      batchUploaderId,
      useAI,
      aiAnalysis,
      selectedProjects,
      timestamp: Date.now(),
    }

    try {
      sessionStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress))
    } catch (error) {
      console.warn('Failed to save progress:', error)
    }
  }, [file, step, totalPages, projectDefinitions, batchId, batchUploaderId, useAI, aiAnalysis, selectedProjects])

  const loadSavedProgress = useCallback((): SavedProgress | null => {
    try {
      const saved = sessionStorage.getItem(PROGRESS_STORAGE_KEY)
      if (!saved) return null

      const progress = JSON.parse(saved) as SavedProgress

      // Check if progress is recent (less than 24 hours)
      const hoursSince = (Date.now() - progress.timestamp) / (1000 * 60 * 60)
      if (hoursSince > 24) {
        sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
        return null
      }

      return progress
    } catch (error) {
      console.warn('Failed to load saved progress:', error)
      return null
    }
  }, [])

  const clearSavedProgress = useCallback(() => {
    try {
      sessionStorage.removeItem(PROGRESS_STORAGE_KEY)
    } catch (error) {
      console.warn('Failed to clear saved progress:', error)
    }
  }, [])

  const restoreProgress = useCallback(async (progress: SavedProgress) => {
    try {
      // Restore file if we can (re-upload required)
      if (progress.file) {
        toast.info('Please re-upload your PDF file to restore progress')
        setStep('upload')
        setUseAI(progress.useAI)
        return
      }

      // Restore other state
      setStep(progress.step)
      setTotalPages(progress.totalPages)
      setProjectDefinitions(progress.projectDefinitions)
      setBatchId(progress.batchId)
      setBatchUploaderId(progress.batchUploaderId)
      setUseAI(progress.useAI)
      setAiAnalysis(progress.aiAnalysis)
      setSelectedProjects(progress.selectedProjects)

      toast.success('Progress restored successfully')
    } catch (error) {
      console.error('Failed to restore progress:', error)
      toast.error('Failed to restore progress')
    }
  }, [])

  // Auto-save effect
  useEffect(() => {
    if (open && step !== 'upload' && step !== 'complete') {
      autoSaveIntervalRef.current = setInterval(saveProgress, 30000) // Save every 30 seconds
    } else {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
        autoSaveIntervalRef.current = null
      }
    }

    return () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
        autoSaveIntervalRef.current = null
      }
    }
  }, [open, step, saveProgress])

  // Check for saved progress on mount
  useEffect(() => {
    if (open) {
      const progress = loadSavedProgress()
      if (progress) {
        setSavedProgress(progress)
        setShowRecoveryDialog(true)
      }
    }
  }, [open, loadSavedProgress])

  // File upload handling
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0]
    if (!uploadedFile) return

    if (uploadedFile.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    setFile(uploadedFile)
    setError(null)

    try {
      // Read PDF to get page count
      const arrayBuffer = await uploadedFile.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      setPdfBytes(bytes)

      const pdfDoc = await PDFDocument.load(bytes)
      const pageCount = pdfDoc.getPageCount()
      setTotalPages(pageCount)

      toast.success(`PDF loaded: ${pageCount} pages`)
    } catch (err) {
      console.error('Failed to read PDF:', err)
      toast.error('Failed to read PDF file')
      setError('Failed to read PDF file')
    }
  }, [useAI])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  })

  // AI Analysis
  const analyzeWithAI = async () => {
    if (!file) return

    setStep('analyze')
    setIsProcessing(true)
    setProcessingStatus('Analyzing PDF with AI...')
    announceToScreenReader('Starting AI analysis. This may take 10-20 seconds.')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/projects/batch-upload/analyze', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      const data = await response.json()
      setAiAnalysis(data.analysis)

      // Convert AI results to project definitions
      const definitions: ProjectDefinitionForm[] = data.analysis.projects.map((p: any) => ({
        id: crypto.randomUUID(),
        startPage: p.startPage,
        endPage: p.endPage,
        mode: 'new' as const,
        tentativeName: p.projectName,
        tentativeAddress: p.projectAddress,
        confidence: p.confidence,
      }))

      setProjectDefinitions(definitions)

      toast.success(
        `AI detected ${definitions.length} project${definitions.length !== 1 ? 's' : ''} (cost: $${data.metadata.costUsd})`
      )

      setStep('define')
      announceToScreenReader(`AI analysis complete. Found ${definitions.length} project${definitions.length !== 1 ? 's' : ''}. Please review and configure each project.`)
    } catch (err) {
      console.error('AI analysis failed:', err)
      toast.error('AI analysis failed. Using manual mode.')
      // Fallback to manual mode
      autoSegmentProjects()
    } finally {
      setIsProcessing(false)
    }
  }

  // Auto-segmentation (fallback) with improved naming
  const autoSegmentProjects = () => {
    const pagesPerProject = 2
    const numProjects = Math.ceil(totalPages / pagesPerProject)

    const definitions: ProjectDefinitionForm[] = []

    for (let i = 0; i < numProjects; i++) {
      const startPage = i * pagesPerProject + 1
      const endPage = Math.min((i + 1) * pagesPerProject, totalPages)

      // Create more descriptive project names using page ranges
      const projectName = numProjects === 1
        ? `Full Document (Pages ${startPage}-${endPage})`
        : `Section ${i + 1} (Pages ${startPage}-${endPage})`

      definitions.push({
        id: crypto.randomUUID(),
        startPage,
        endPage,
        mode: 'new',
        tentativeName: projectName,
      })
    }

    setProjectDefinitions(definitions)
    setStep('define')
  }

  // Proceed from upload step
  const handleProceedFromUpload = () => {
    if (useAI) {
      analyzeWithAI()
    } else {
      autoSegmentProjects()
    }
  }

  // Add new project definition
  const addProjectDefinition = () => {
    const lastDef = projectDefinitions[projectDefinitions.length - 1]
    const newStartPage = lastDef ? lastDef.endPage + 1 : 1

    if (newStartPage > totalPages) {
      toast.error('All pages have been assigned')
      return
    }

    setProjectDefinitions([
      ...projectDefinitions,
      {
        id: crypto.randomUUID(),
        startPage: newStartPage,
        endPage: totalPages,
        mode: 'new',
        tentativeName: `Section ${projectDefinitions.filter(def => def.mode !== 'skip').length + 1} (Pages ${newStartPage}-${totalPages})`,
      },
    ])
  }

  // Remove project definition
  const removeProjectDefinition = (id: string) => {
    if (projectDefinitions.length === 1) {
      toast.error('You must have at least one project')
      return
    }
    setProjectDefinitions(projectDefinitions.filter((def) => def.id !== id))
    // Remove from selected projects if exists
    const newSelected = { ...selectedProjects }
    delete newSelected[id]
    setSelectedProjects(newSelected)
  }

  // Update project definition
  const updateProjectDefinition = (id: string, updates: Partial<ProjectDefinitionForm>) => {
    setProjectDefinitions(
      projectDefinitions.map((def) => (def.id === id ? { ...def, ...updates } : def))
    )
  }

  // Open search dialog
  const openSearchDialog = (defId: string) => {
    setSearchingForDefId(defId)
    setSearchDialogOpen(true)
  }

  // Handle project selection from search
  const handleProjectSelect = (project: Project) => {
    if (searchingForDefId) {
      setSelectedProjects({
        ...selectedProjects,
        [searchingForDefId]: project,
      })
      updateProjectDefinition(searchingForDefId, {
        mode: 'match',
        projectId: project.id,
      })
    }
  }

  // Validate definitions
  const validateDefinitions = (): boolean => {
    // Filter out skipped projects for validation
    const activeDefinitions = projectDefinitions.filter((def) => def.mode !== 'skip')

    if (activeDefinitions.length === 0) {
      toast.error('At least one project must be selected for processing')
      return false
    }

    for (const def of activeDefinitions) {
      if (def.startPage < 1 || def.endPage > totalPages) {
        toast.error(`Invalid page range: ${def.startPage}-${def.endPage}`)
        return false
      }
      if (def.startPage > def.endPage) {
        toast.error(`Start page cannot be greater than end page`)
        return false
      }
      if (def.mode === 'match' && !def.projectId) {
        toast.error(`Please select a project to match or change to "Create New"`)
        return false
      }
    }

    // Check for overlaps (only among active definitions)
    const sorted = [...activeDefinitions].sort((a, b) => a.startPage - b.startPage)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].endPage >= sorted[i + 1].startPage) {
        toast.error('Page ranges cannot overlap')
        return false
      }
    }

    return true
  }

  // Cancel processing with cleanup
  const cancelProcessing = useCallback(() => {
    // Cancel abort controller
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Stop adaptive polling
    if (adaptivePollerRef.current) {
      adaptivePollerRef.current.stop()
    }

    // Clear request deduplicator
    if (requestDeduplicatorRef.current) {
      requestDeduplicatorRef.current.clear()
    }

    // Stop performance monitoring
    if (performanceMonitorRef.current) {
      performanceMonitorRef.current.stop()
    }

    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current)
      autoSaveIntervalRef.current = null
    }

    setIsCancelling(false)
    setIsProcessing(false)
    toast.info('Processing cancelled')
    setStep('define')
  }, [])

  // Process batch upload with performance optimizations
  const processBatchUpload = async () => {
    if (!file || !pdfBytes) {
      toast.error('No file selected')
      return
    }

    if (!validateDefinitions()) {
      return
    }

    // Initialize performance monitoring
    performanceMonitorRef.current = new PerformanceMonitor()
    performanceMonitorRef.current.start()

    // Create new abort controller for this processing session
    abortControllerRef.current = new AbortController()
    setIsProcessing(true)
    setStep('processing')
    setError(null)
    setIsCancelling(false)
    announceToScreenReader('Processing started. This will take several minutes as we process all the mapping sheets.')

    try {
      // Step 1: Initialize batch upload (upload original PDF)
      setProcessingStatus('Uploading original PDF...')
      setUploadProgress(10)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('totalPages', totalPages.toString())

      const initResponse = await fetch('/api/projects/batch-upload/init', {
        method: 'POST',
        body: formData,
      })

      if (!initResponse.ok) {
        throw new Error('Failed to initialize batch upload')
      }

      const initData = await initResponse.json()
      const uploadedBatchId = initData.batchId
      const uploaderIdFromInit: string | undefined = initData.uploaderId
      setBatchId(uploadedBatchId)
      if (uploaderIdFromInit) {
        setBatchUploaderId(uploaderIdFromInit)
      }
      setUploadProgress(25)

      // Step 2: Split PDFs client-side with optimization
      setProcessingStatus('Splitting PDF by projects...')
      // Filter out skipped projects before processing
      const activeProjectDefinitions = projectDefinitions.filter((def) => def.mode !== 'skip')
      const definitions = activeProjectDefinitions.map((def, index) => ({
        startPage: def.startPage,
        endPage: def.endPage,
        tentativeName: def.tentativeName || `Project ${index + 1}`,
        mode: def.mode === 'match' ? 'existing_project' : 'new_project',
        projectId: def.projectId,
      }))

      let splitResults: SplitResult[]

      if (useOptimizedProcessing) {
        // Use optimized PDF processor
        if (!pdfProcessorRef.current) {
          pdfProcessorRef.current = new OptimizedPdfProcessor({
            enableMemoryOptimization: true,
            batchSize: 3,
            concurrency: 2,
            onProgress: (progress, current) => {
              const overallProgress = 25 + (progress * 0.25) // 25-50% range
              setUploadProgress(overallProgress)
              setProcessingStatus(`Splitting PDFs: ${current}`)
            },
            onMemoryWarning: (warning) => {
              toast.warning(warning)
            }
          })
        }

        const optimizedResults = await pdfProcessorRef.current.processPdfInBatches(pdfBytes, definitions)
        splitResults = optimizedResults.map(result => ({
          fileName: result.fileName,
          pdfBytes: result.pdfBytes,
          pageCount: result.pageCount,
          definition: result.definition
        }))

        // Update processing stats
        const metrics = pdfProcessorRef.current.getPerformanceMetrics()
        setProcessingStats(prev => ({
          ...prev,
          processingTime: metrics.timing.duration,
          memoryUsage: metrics.memoryUsage?.used || 0
        }))

      } else {
        // Fallback to original processing
        splitResults = await splitPdfByProjects(pdfBytes, definitions)
      }

      setUploadProgress(50)

      // Step 3: Upload split PDFs with parallel processing
      setProcessingStatus('Uploading split PDFs...')
      let effectiveUploaderId = uploaderIdFromInit || batchUploaderId
      if (!effectiveUploaderId) {
        const supabase = getSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('User not authenticated')
        }
        effectiveUploaderId = user.id
        setBatchUploaderId(user.id)
      }

      let uploadedScans

      if (useOptimizedProcessing) {
        // Use optimized parallel uploader
        if (!pdfUploaderRef.current) {
          pdfUploaderRef.current = new OptimizedPdfUploader()
        }

        uploadedScans = await pdfUploaderRef.current.uploadSplitPdfsInParallel(
          uploadedBatchId,
          effectiveUploaderId,
          splitResults,
          3 // Parallel uploads
        )

        // Update processing stats
        const uploadMetrics = pdfUploaderRef.current.getPerformanceMetrics()
        setProcessingStats(prev => ({
          ...prev,
          networkRequests: uploadMetrics.network.requests
        }))

      } else {
        // Fallback to original sequential upload
        uploadedScans = await uploadSplitPdfs(uploadedBatchId, effectiveUploaderId, splitResults)
      }

      setUploadProgress(75)

      // Step 4: Create batch and scan records
      setProcessingStatus('Creating batch records...')
      const processResponse = await fetch('/api/projects/batch-upload/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: uploadedBatchId,
          originalFileUrl: initData.fileUrl,
          originalFileName: initData.fileName,
          originalFileSize: initData.fileSize,
          totalPages: initData.totalPages,
          projectDefinitions: definitions,
          uploadedScans,
        }),
      })

      if (!processResponse.ok) {
        throw new Error('Failed to process batch upload')
      }

      const processData = await processResponse.json()
      setTotalScans(processData.scanIds.length)

      // Update batchId with the actual database record ID from RPC
      const actualBatchId = processData.batchId
      setBatchId(actualBatchId)
      setUploadProgress(90)

      // Step 5: Poll for completion using adaptive polling
      setProcessingStatus('Processing scans...')
      await pollBatchStatus(actualBatchId)

      setUploadProgress(100)
      setStep('complete')

      // Final performance metrics
      if (performanceMonitorRef.current) {
        performanceMonitorRef.current.stop()
        const finalMetrics = performanceMonitorRef.current.getMetrics()
        setPerformanceMetrics(finalMetrics)

        console.log('Performance metrics:', finalMetrics)
      }

      announceToScreenReader(`Upload complete! Successfully processed ${totalScans} mapping sheet${totalScans !== 1 ? 's' : ''}.`)
      toast.success('Batch upload completed successfully!')
    } catch (err) {
      if (abortControllerRef.current?.signal.aborted) {
        console.log('Processing was cancelled')
        return
      }

      console.error('Batch upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
      toast.error('Batch upload failed')
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setIsProcessing(false)
      }
      abortControllerRef.current = null

      // Stop performance monitoring
      if (performanceMonitorRef.current) {
        performanceMonitorRef.current.stop()
      }
    }
  }

  // Optimized adaptive polling for batch status
  const pollBatchStatus = async (batchId: string) => {
    if (!adaptivePollerRef.current) {
      adaptivePollerRef.current = new AdaptivePoller({
        initialInterval: 1000, // Start with 1 second
        maxInterval: 30000,    // Max 30 seconds
        fastInterval: 1000,    // 1 second during active processing
        idleInterval: 5000,    // 5 seconds when idle
        maxAttempts: 300,      // Allow more attempts with adaptive polling
        timeout: 600000,       // 10 minutes total timeout
      })
    }

    if (!requestDeduplicatorRef.current) {
      requestDeduplicatorRef.current = new RequestDeduplicator()
    }

    const poller = adaptivePollerRef.current
    const deduplicator = requestDeduplicatorRef.current

    console.log(`[bulk-upload] Starting adaptive polling for batch ${batchId}`)

    try {
      const result = await poller.start(
        async (signal) => {
          // Deduplicate requests to avoid multiple concurrent status checks
          return deduplicator.deduplicate(
            `status-${batchId}-${Date.now()}`,
            async () => {
              const response = await fetch(`/api/projects/batch-upload/${batchId}/status`, {
                signal,
                headers: {
                  'Cache-Control': 'no-cache',
                },
              })

              if (!response.ok) {
                throw new Error('Failed to fetch status')
              }

              performanceMonitorRef.current?.recordRequest()
              return response.json()
            }
          )
        },
        (batch) => {
          // Check if batch is complete
          return batch.status === 'completed' || batch.status === 'partial'
        },
        (batch) => {
          // Check for activity - processing is active if status is 'processing' or if progress is being made
          const completed = batch.projects_completed || 0
          const total = batch.total_scans || totalScans
          const progressPercentage = total > 0 ? (completed / total) * 100 : 0

          // Consider active if status is processing or if we're making progress (< 100%)
          return batch.status === 'processing' || progressPercentage < 100
        }
      )

      // Update final state
      const completed = result.projects_completed || 0
      const total = result.total_scans || totalScans
      setCompletedScans(completed)
      setTotalScans(total)

      console.log(`[bulk-upload] Adaptive polling complete: ${result.status} (${completed}/${total} scans)`)

      if (result.status === 'failed') {
        throw new Error(result.error_message || 'Batch processing failed')
      }

    } catch (error) {
      if (error instanceof Error && error.message.includes('aborted')) {
        console.log('[bulk-upload] Adaptive polling cancelled')
        return
      }
      console.error('[bulk-upload] Adaptive polling error:', error)
      performanceMonitorRef.current?.recordFailure()
      throw error
    } finally {
      // Cleanup
      deduplicator.clear()
    }
  }

  // Reset dialog with performance cleanup
  const resetDialog = () => {
    // Cancel any ongoing processing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    // Stop adaptive polling
    if (adaptivePollerRef.current) {
      adaptivePollerRef.current.stop()
      adaptivePollerRef.current = null
    }

    // Clear request deduplicator
    if (requestDeduplicatorRef.current) {
      requestDeduplicatorRef.current.clear()
      requestDeduplicatorRef.current = null
    }

    // Stop performance monitoring
    if (performanceMonitorRef.current) {
      performanceMonitorRef.current.stop()
      performanceMonitorRef.current = null
    }

    // Clear auto-save interval
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current)
      autoSaveIntervalRef.current = null
    }

    // Clear saved progress
    clearSavedProgress()

    // Reset all state
    setStep('upload')
    setFile(null)
    setPdfBytes(null)
    setTotalPages(0)
    setProjectDefinitions([])
    setBatchId('')
    setBatchUploaderId('')
    setUploadProgress(0)
    setProcessingStatus('')
    setError(null)
    setCompletedScans(0)
    setTotalScans(0)
    setUseAI(true)
    setAiAnalysis(null)
    setSelectedProjects({})
    setShowRecoveryDialog(false)
    setSavedProgress(null)
    setIsCancelling(false)
    setUseOptimizedProcessing(true)
    setPerformanceMetrics(null)
    setProcessingStats({
      memoryUsage: 0,
      processingTime: 0,
      networkRequests: 0
    })
  }

  const handleClose = () => {
    if (!isProcessing) {
      resetDialog()
      onOpenChange(false)
    }
  }

  // Get confidence badge
  const getConfidenceBadge = (confidence?: number) => {
    if (!confidence) return null

    const percentage = Math.round(confidence * 100)
    const variant =
      confidence >= 0.85 ? 'default' : confidence >= 0.6 ? 'secondary' : 'destructive'

    return (
      <Badge variant={variant} className="ml-2">
        {percentage}% confident
      </Badge>
    )
  }

  return (
    <>
      {/* Screen reader live region for announcements */}
      <div
        ref={announcementRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {screenReaderAnnouncement}
      </div>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          aria-describedby="bulk-upload-description"
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Bulk Upload Mapping Sheets</DialogTitle>
                <DialogDescription id="bulk-upload-description">
                  Upload a PDF containing multiple projects and split them into individual scans
                  {step !== 'upload' && (
                    <span className="block mt-1">
                      Current step: {step === 'analyze' ? 'Analyzing with AI' :
                                    step === 'define' ? 'Define projects' :
                                    step === 'processing' ? 'Processing upload' :
                                    step === 'complete' ? 'Upload complete' : 'Upload file'}
                    </span>
                  )}
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDashboardOpen(true)}
                className="ml-4"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Batch History
              </Button>
            </div>
          </DialogHeader>

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                {file ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-5 w-5" />
                      <p className="font-medium">{file.name}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">{totalPages} pages</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium">
                      {isDragActive ? 'Drop PDF here' : 'Drag and drop PDF, or click to browse'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Upload a PDF containing multiple mapping sheets
                    </p>
                  </div>
                )}
              </div>

              {file && (
                <>
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Brain className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">AI-Assisted Detection</p>
                        <p className="text-sm text-muted-foreground">
                          Automatically detect projects and extract names
                        </p>
                      </div>
                    </div>
                    <Switch checked={useAI} onCheckedChange={setUseAI} />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <Upload className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">Performance Optimization</p>
                        <p className="text-sm text-muted-foreground">
                          Faster processing with parallel uploads and memory optimization
                        </p>
                      </div>
                    </div>
                    <Switch checked={useOptimizedProcessing} onCheckedChange={setUseOptimizedProcessing} />
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">{error}</p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button onClick={handleProceedFromUpload} disabled={!file || !totalPages}>
                  {useAI ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Analyze with AI
                    </>
                  ) : (
                    'Next: Define Projects'
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: AI Analysis */}
          {step === 'analyze' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium mb-2">{processingStatus}</p>
                <p className="text-sm text-muted-foreground">
                  This may take 10-20 seconds depending on PDF size
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Define Projects */}
          {step === 'define' && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm">
                  <strong>File:</strong> {file?.name}
                </p>
                <p className="text-sm">
                  <strong>Total Pages:</strong> {totalPages}
                </p>
                {aiAnalysis && (
                  <p className="text-sm flex items-center gap-2 mt-1">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <strong>AI Detection:</strong> {aiAnalysis.detectionMethod}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">
                    Project Definitions ({projectDefinitions.length})
                  </Label>
                  <Button onClick={addProjectDefinition} size="sm" variant="outline">
                    Add Project
                  </Button>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                  {projectDefinitions.map((def, index) => (
                    <div key={def.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">
                              {def.tentativeName || `Project ${index + 1}`}
                            </h4>
                            {getConfidenceBadge(def.confidence)}
                          </div>
                          {def.tentativeAddress && (
                            <p className="text-sm text-muted-foreground">
                              {def.tentativeAddress}
                            </p>
                          )}
                        </div>
                        {projectDefinitions.length > 1 && (
                          <Button
                            onClick={() => removeProjectDefinition(def.id)}
                            size="sm"
                            variant="ghost"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`start-${def.id}`}>Start Page</Label>
                          <Input
                            id={`start-${def.id}`}
                            type="number"
                            min={1}
                            max={totalPages}
                            value={def.startPage}
                            onChange={(e) =>
                              updateProjectDefinition(def.id, {
                                startPage: parseInt(e.target.value) || 1,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label htmlFor={`end-${def.id}`}>End Page</Label>
                          <Input
                            id={`end-${def.id}`}
                            type="number"
                            min={1}
                            max={totalPages}
                            value={def.endPage}
                            onChange={(e) =>
                              updateProjectDefinition(def.id, {
                                endPage: parseInt(e.target.value) || totalPages,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Project Mode</Label>
                        <RadioGroup
                          value={def.mode}
                          onValueChange={(value: 'new' | 'match' | 'skip') =>
                            updateProjectDefinition(def.id, { mode: value, projectId: undefined })
                          }
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="new" id={`new-${def.id}`} />
                            <Label htmlFor={`new-${def.id}`} className="font-normal">
                              Create New Project
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="match" id={`match-${def.id}`} />
                            <Label htmlFor={`match-${def.id}`} className="font-normal">
                              Match to Existing Project
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="skip" id={`skip-${def.id}`} />
                            <Label htmlFor={`skip-${def.id}`} className="font-normal text-muted-foreground">
                              Skip Project (Don't Process)
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      {def.mode === 'match' && (
                        <div className="space-y-2">
                          <Button
                            variant="outline"
                            onClick={() => openSearchDialog(def.id)}
                            className="w-full justify-start"
                          >
                            <Search className="h-4 w-4 mr-2" />
                            {selectedProjects[def.id]
                              ? selectedProjects[def.id].project_name
                              : 'Search for project...'}
                          </Button>
                          {selectedProjects[def.id] && (
                            <div className="text-sm text-muted-foreground pl-2">
                              {selectedProjects[def.id].project_address}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Back
                </Button>
                <Button onClick={processBatchUpload}>Process Upload</Button>
              </div>
            </div>
          )}

          {/* Step 4: Processing */}
          {step === 'processing' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span id="processing-status" aria-live="polite">{processingStatus}</span>
                  <span aria-label={`Upload progress: ${uploadProgress} percent complete`}>{uploadProgress}%</span>
                </div>
                <Progress
                  value={uploadProgress}
                  aria-labelledby="processing-status"
                  aria-valuenow={uploadProgress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>

              {totalScans > 0 && (
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">
                    Processing {completedScans} of {totalScans} scans
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Multiple workers processing in parallel. This may take 2-5 minutes.
                  </p>
                  {completedScans > 0 && (
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                      <p className="text-xs text-green-600">
                        {completedScans} scan{completedScans !== 1 ? 's' : ''} completed
                      </p>
                    </div>
                  )}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{error}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {batchId && (
                        <>
                          Batch ID: {batchId}. You can check the batch status page later or try again.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {error && batchId && (
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/projects/batches/${batchId}`)}
                  >
                    View Batch Status
                  </Button>
                  <Button
                    onClick={() => {
                      setError(null)
                      setIsProcessing(false)
                      setStep('define')
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              )}

              {!error && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => setIsCancelling(true)}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      'Cancel Processing'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center py-8">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>

              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">Upload Complete!</h3>
                <p className="text-muted-foreground">
                  Successfully processed {totalScans} mapping sheet
                  {totalScans !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Batch ID:</span>
                  <span className="text-sm font-mono">{batchId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Scans:</span>
                  <span className="text-sm font-medium">{totalScans}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Completed:</span>
                  <span className="text-sm font-medium">{completedScans}</span>
                </div>

                {performanceMetrics && (
                  <>
                    <div className="border-t pt-2 mt-2">
                      <p className="text-sm font-medium mb-2">Performance Metrics</p>
                      <div className="flex justify-between">
                        <span className="text-sm">Processing Time:</span>
                        <span className="text-sm">
                          {((performanceMetrics.timing.duration || 0) / 1000).toFixed(1)}s
                        </span>
                      </div>
                      {performanceMetrics.memoryUsage && (
                        <div className="flex justify-between">
                          <span className="text-sm">Memory Used:</span>
                          <span className="text-sm">
                            {((performanceMetrics.memoryUsage.used || 0) / 1024 / 1024).toFixed(1)}MB
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm">Network Requests:</span>
                        <span className="text-sm">{performanceMetrics.network.requests}</span>
                      </div>
                      {useOptimizedProcessing && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="h-2 w-2 bg-green-500 rounded-full" />
                          <span className="text-xs text-green-600">Performance optimization enabled</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={() => router.push(`/projects/batches/${batchId}`)}>
                  View Batch Details
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Recovery Dialog */}
      <Dialog open={showRecoveryDialog} onOpenChange={setShowRecoveryDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resume Previous Upload?</DialogTitle>
            <DialogDescription>
              We found saved progress from a previous bulk upload session. Would you like to restore it?
            </DialogDescription>
          </DialogHeader>

          {savedProgress && (
            <div className="space-y-2 text-sm">
              <p><strong>File:</strong> {savedProgress.file?.name}</p>
              <p><strong>Pages:</strong> {savedProgress.totalPages}</p>
              <p><strong>Projects:</strong> {savedProgress.projectDefinitions.length}</p>
              <p><strong>Step:</strong> {savedProgress.step}</p>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRecoveryDialog(false)
                clearSavedProgress()
              }}
            >
              Start Fresh
            </Button>
            <Button
              onClick={() => {
                if (savedProgress) {
                  restoreProgress(savedProgress)
                }
                setShowRecoveryDialog(false)
              }}
            >
              Restore Progress
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancellation Confirmation Dialog */}
      <Dialog open={isCancelling} onOpenChange={setIsCancelling}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Processing?</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel the bulk upload process? This will stop all ongoing operations and you may lose progress.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• All ongoing uploads will be stopped</p>
            <p>• Any completed scans will be saved</p>
            <p>• Your current settings will be preserved</p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setIsCancelling(false)}
            >
              Continue Processing
            </Button>
            <Button
              variant="destructive"
              onClick={cancelProcessing}
            >
              Cancel Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Project Search Dialog */}
      <ProjectSearchDialog
        open={searchDialogOpen}
        onOpenChange={setSearchDialogOpen}
        onSelectProject={handleProjectSelect}
        suggestedName={
          searchingForDefId
            ? projectDefinitions.find((d) => d.id === searchingForDefId)?.tentativeName
            : undefined
        }
        suggestedAddress={
          searchingForDefId
            ? projectDefinitions.find((d) => d.id === searchingForDefId)?.tentativeAddress
            : undefined
        }
      />

      {/* Batch Management Dashboard */}
      <BatchManagementDashboard
        open={dashboardOpen}
        onOpenChange={setDashboardOpen}
      />
    </>
  )
}
