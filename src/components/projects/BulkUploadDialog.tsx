'use client'

import { useState, useCallback, useEffect } from 'react'
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
} from 'lucide-react'
import { toast } from 'sonner'
import { splitPdfByProjects, ProjectDefinition, SplitResult } from '@/lib/pdf/splitPdfByProjects'
import { uploadSplitPdfs } from '@/lib/pdf/uploadSplitPdfs'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { ProjectSearchDialog } from './ProjectSearchDialog'

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
  confidence?: number
}

interface AnalysisResult {
  projects: Array<{
    startPage: number
    endPage: number
    projectName: string
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

export function BulkUploadDialog({ open, onOpenChange }: BulkUploadDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [projectDefinitions, setProjectDefinitions] = useState<ProjectDefinitionForm[]>([])
  const [batchId, setBatchId] = useState<string>('')
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
  }, [])

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
        confidence: p.confidence,
      }))

      setProjectDefinitions(definitions)

      toast.success(
        `AI detected ${definitions.length} project${definitions.length !== 1 ? 's' : ''} (cost: $${data.metadata.costUsd})`
      )

      setStep('define')
    } catch (err) {
      console.error('AI analysis failed:', err)
      toast.error('AI analysis failed. Using manual mode.')
      // Fallback to manual mode
      autoSegmentProjects()
    } finally {
      setIsProcessing(false)
    }
  }

  // Auto-segmentation (fallback)
  const autoSegmentProjects = () => {
    const pagesPerProject = 2
    const numProjects = Math.ceil(totalPages / pagesPerProject)

    const definitions: ProjectDefinitionForm[] = []

    for (let i = 0; i < numProjects; i++) {
      const startPage = i * pagesPerProject + 1
      const endPage = Math.min((i + 1) * pagesPerProject, totalPages)

      definitions.push({
        id: crypto.randomUUID(),
        startPage,
        endPage,
        mode: 'new',
        tentativeName: `Project ${i + 1}`,
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
        tentativeName: `Project ${projectDefinitions.length + 1}`,
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
    for (const def of projectDefinitions) {
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

    // Check for overlaps
    const sorted = [...projectDefinitions].sort((a, b) => a.startPage - b.startPage)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].endPage >= sorted[i + 1].startPage) {
        toast.error('Page ranges cannot overlap')
        return false
      }
    }

    return true
  }

  // Process batch upload
  const processBatchUpload = async () => {
    if (!file || !pdfBytes) {
      toast.error('No file selected')
      return
    }

    if (!validateDefinitions()) {
      return
    }

    setIsProcessing(true)
    setStep('processing')
    setError(null)

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
      setBatchId(uploadedBatchId)
      setUploadProgress(25)

      // Step 2: Split PDFs client-side
      setProcessingStatus('Splitting PDF by projects...')
      const definitions = projectDefinitions.map((def, index) => ({
        startPage: def.startPage,
        endPage: def.endPage,
        tentativeName: def.tentativeName || `Project ${index + 1}`,
        mode: def.mode,
        projectId: def.projectId,
      }))

      const splitResults: SplitResult[] = await splitPdfByProjects(pdfBytes, definitions)
      setUploadProgress(50)

      // Step 3: Upload split PDFs
      setProcessingStatus('Uploading split PDFs...')
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('User not authenticated')
      }

      const uploadedScans = await uploadSplitPdfs(uploadedBatchId, user.id, splitResults)
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
      setUploadProgress(90)

      // Step 5: Poll for completion
      setProcessingStatus('Processing scans...')
      await pollBatchStatus(uploadedBatchId)

      setUploadProgress(100)
      setStep('complete')
      toast.success('Batch upload completed successfully!')
    } catch (err) {
      console.error('Batch upload error:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
      toast.error('Batch upload failed')
    } finally {
      setIsProcessing(false)
    }
  }

  // Poll batch status
  const pollBatchStatus = async (batchId: string) => {
    const maxAttempts = 60
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/projects/batch-upload/${batchId}/status`)
        if (!response.ok) throw new Error('Failed to fetch status')

        const batch = await response.json()
        setCompletedScans(batch.projects_completed || 0)

        if (batch.status === 'completed' || batch.status === 'partial') {
          return
        }

        if (batch.status === 'failed') {
          throw new Error(batch.error_message || 'Batch processing failed')
        }

        await new Promise((resolve) => setTimeout(resolve, 2000))
        attempts++
      } catch (err) {
        console.error('Status poll error:', err)
        throw err
      }
    }

    throw new Error('Processing timeout')
  }

  // Reset dialog
  const resetDialog = () => {
    setStep('upload')
    setFile(null)
    setPdfBytes(null)
    setTotalPages(0)
    setProjectDefinitions([])
    setBatchId('')
    setUploadProgress(0)
    setProcessingStatus('')
    setError(null)
    setCompletedScans(0)
    setTotalScans(0)
    setUseAI(true)
    setAiAnalysis(null)
    setSelectedProjects({})
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
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Mapping Sheets</DialogTitle>
            <DialogDescription>
              Upload a PDF containing multiple projects and split them into individual scans
            </DialogDescription>
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
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            {def.tentativeName || `Project ${index + 1}`}
                          </h4>
                          {getConfidenceBadge(def.confidence)}
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
                          onValueChange={(value: 'new' | 'match') =>
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
                  <span>{processingStatus}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>

              {totalScans > 0 && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Processing {completedScans} of {totalScans} scans
                  </p>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">{error}</p>
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
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={() => (window.location.href = `/projects/batches/${batchId}`)}>
                  View Batch Details
                </Button>
              </div>
            </div>
          )}
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
      />
    </>
  )
}
