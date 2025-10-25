'use client'

import React, { useEffect, useRef } from 'react'
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

// Context and hooks
import { BulkUploadProvider, useBulkUpload } from '@/contexts/BulkUploadContext'
import { useBulkUploadState } from '@/hooks/useBulkUploadState'
import { usePDFProcessing } from '@/hooks/usePDFProcessing'
import { useAIAnalysis } from '@/hooks/useAIAnalysis'
import { useBatchProcessing } from '@/hooks/useBatchProcessing'
import { useProgressPersistence } from '@/hooks/useProgressPersistence'

// Error boundaries
import { BulkUploadErrorBoundaryWrapper } from './BulkUploadErrorBoundary'

// Components
import { ProjectSearchDialog } from './ProjectSearchDialog'

// Utils
import { getConfidenceBadgeVariant } from '@/lib/bulkUpload/utils'
import { ARIA_LABELS, STEP_CONFIG } from '@/lib/bulkUpload/constants'

// Types
import { Project } from '@/contexts/BulkUploadContext'

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function BulkUploadDialogContent({ open, onOpenChange }: BulkUploadDialogProps) {
  // Core state from context
  const { state, dispatch, announceToScreenReader, resetState } = useBulkUpload()

  // Custom hooks for specific functionality
  const bulkUploadState = useBulkUploadState()
  const pdfProcessing = usePDFProcessing()
  const aiAnalysis = useAIAnalysis()
  const batchProcessing = useBatchProcessing()
  const progressPersistence = useProgressPersistence()

  // Refs
  const announcementRef = useRef<HTMLDivElement>(null)

  // Handle dialog close
  const handleClose = () => {
    if (!state.isProcessing) {
      resetState()
      onOpenChange(false)
    }
  }

  // Handle AI analysis
  const handleAIAnalysis = async () => {
    const success = await aiAnalysis.analyzeWithAI()
    if (!success) {
      bulkUploadState.autoSegmentProjects()
    }
  }

  // Handle batch processing
  const handleBatchProcessing = async () => {
    if (bulkUploadState.validateDefinitions()) {
      await batchProcessing.processBatchUpload()
    }
  }

  // Handle recovery
  const handleRecoveryComplete = () => {
    // Check if we have a file after recovery
    if (!state.file && state.savedProgress?.file) {
      // User needs to re-upload file
      // Progress will be restored after file upload
      dispatch({ type: 'SET_STEP', payload: 'upload' })
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pdfProcessing.cleanup()
      aiAnalysis.cleanup()
      batchProcessing.cleanup()
      progressPersistence.cleanup()
    }
  }, [pdfProcessing.cleanup, aiAnalysis.cleanup, batchProcessing.cleanup, progressPersistence.cleanup])

  return (
    <>
      {/* Screen reader live region */}
      <div
        ref={announcementRef}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        role="status"
      >
        {state.screenReaderAnnouncement}
      </div>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] overflow-y-auto"
          aria-describedby="bulk-upload-description"
        >
          <DialogHeader>
            <DialogTitle>Bulk Upload Mapping Sheets</DialogTitle>
            <DialogDescription id="bulk-upload-description">
              Upload a PDF containing multiple projects and split them into individual scans
              {state.step !== 'upload' && (
                <span className="block mt-1">
                  Current step: {STEP_CONFIG[state.step].title}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Upload */}
          {state.step === 'upload' && (
            <BulkUploadErrorBoundaryWrapper operation="file-upload">
              <UploadStep
                pdfProcessing={pdfProcessing}
                useAI={state.useAI}
                onUseAIChange={(useAI) => dispatch({ type: 'SET_USE_AI', payload: useAI })}
                onProceed={state.useAI ? handleAIAnalysis : bulkUploadState.autoSegmentProjects}
                canProceed={bulkUploadState.canProceedFromUpload}
                error={state.error}
              />
            </BulkUploadErrorBoundaryWrapper>
          )}

          {/* Step 2: AI Analysis */}
          {state.step === 'analyze' && (
            <BulkUploadErrorBoundaryWrapper
              operation="ai-analysis"
              onRetry={handleAIAnalysis}
            >
              <AnalysisStep
                processingStatus={state.processingStatus}
                isProcessing={aiAnalysis.isAnalyzing}
                error={state.error}
              />
            </BulkUploadErrorBoundaryWrapper>
          )}

          {/* Step 3: Define Projects */}
          {state.step === 'define' && (
            <BulkUploadErrorBoundaryWrapper operation="pdf-splitting">
              <DefineProjectsStep
                file={state.file}
                totalPages={state.totalPages}
                projectDefinitions={state.projectDefinitions}
                aiAnalysis={state.aiAnalysis}
                selectedProjects={state.selectedProjects}
                onAddProject={bulkUploadState.addProjectDefinition}
                onUpdateProject={bulkUploadState.updateProjectDefinition}
                onRemoveProject={bulkUploadState.removeProjectDefinition}
                onOpenSearch={bulkUploadState.openSearchDialog}
                onProceed={handleBatchProcessing}
                onBack={() => dispatch({ type: 'SET_STEP', payload: 'upload' })}
                canProceed={bulkUploadState.canProceedFromDefine}
                getConfidenceBadge={bulkUploadState.getConfidenceBadge}
                getSelectedProject={bulkUploadState.getSelectedProject}
              />
            </BulkUploadErrorBoundaryWrapper>
          )}

          {/* Step 4: Processing */}
          {state.step === 'processing' && (
            <BulkUploadErrorBoundaryWrapper
              operation="batch-processing"
              onRetry={handleBatchProcessing}
            >
              <ProcessingStep
                progress={batchProcessing.progress}
                processingStatus={batchProcessing.status}
                completedScans={batchProcessing.completedScans}
                totalScans={batchProcessing.totalScans}
                error={batchProcessing.error}
                batchId={batchProcessing.batchId}
                isCancelling={batchProcessing.isCancelling}
                onCancel={() => dispatch({ type: 'SET_IS_CANCELLING', payload: true })}
                onRetry={batchProcessing.retryProcessing}
              />
            </BulkUploadErrorBoundaryWrapper>
          )}

          {/* Step 5: Complete */}
          {state.step === 'complete' && (
            <CompleteStep
              batchId={batchProcessing.batchId}
              totalScans={batchProcessing.totalScans}
              completedScans={batchProcessing.completedScans}
              onClose={handleClose}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Recovery Dialog */}
      {progressPersistence.showRecoveryDialog && (
        <RecoveryDialog
          savedProgress={state.savedProgress}
          onRestore={progressPersistence.handleRestoreProgress}
          onStartFresh={progressPersistence.handleStartFresh}
        />
      )}

      {/* Cancellation Confirmation Dialog */}
      {batchProcessing.isCancelling && (
        <CancellationDialog
          onConfirm={batchProcessing.cancelProcessing}
          onCancel={() => dispatch({ type: 'SET_IS_CANCELLING', payload: false })}
        />
      )}

      {/* Project Search Dialog */}
      <ProjectSearchDialog
        open={state.searchDialogOpen}
        onOpenChange={bulkUploadState.closeSearchDialog}
        onSelectProject={(project) => {
          if (state.searchingForDefId) {
            bulkUploadState.handleProjectSelect(state.searchingForDefId, project)
          }
        }}
        suggestedName={state.searchingForDefId ?
          bulkUploadState.getProjectDefinition(state.searchingForDefId)?.tentativeName :
          undefined
        }
        suggestedAddress={state.searchingForDefId ?
          bulkUploadState.getProjectDefinition(state.searchingForDefId)?.tentativeAddress :
          undefined
        }
      />
    </>
  )
}

// Step components
function UploadStep({
  pdfProcessing,
  useAI,
  onUseAIChange,
  onProceed,
  canProceed,
  error
}: {
  pdfProcessing: any
  useAI: boolean
  onUseAIChange: (value: boolean) => void
  onProceed: () => void
  canProceed: boolean
  error: string | null
}) {
  const { getRootProps, getInputProps, isDragActive, fileInfo } = pdfProcessing

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
        }`}
        aria-label={ARIA_LABELS.DRAG_ZONE}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        {fileInfo ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <FileText className="h-5 w-5" />
              <p className="font-medium">{fileInfo.name}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              {fileInfo.sizeFormatted} • {pdfProcessing.totalPages} pages
            </p>
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

      {fileInfo && (
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
          <Switch checked={useAI} onCheckedChange={onUseAIChange} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => window.location.href = '/projects'}>
          Cancel
        </Button>
        <Button onClick={onProceed} disabled={!canProceed}>
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
  )
}

function AnalysisStep({
  processingStatus,
  isProcessing,
  error
}: {
  processingStatus: string
  isProcessing: boolean
  error: string | null
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-8">
        {isProcessing ? (
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        ) : error ? (
          <AlertCircle className="h-12 w-12 text-destructive" />
        ) : (
          <Brain className="h-12 w-12 text-primary" />
        )}
      </div>
      <div className="text-center">
        <p className="text-lg font-medium mb-2">{processingStatus}</p>
        <p className="text-sm text-muted-foreground">
          This may take 10-20 seconds depending on PDF size
        </p>
      </div>
    </div>
  )
}

function DefineProjectsStep({
  file,
  totalPages,
  projectDefinitions,
  aiAnalysis,
  selectedProjects,
  onAddProject,
  onUpdateProject,
  onRemoveProject,
  onOpenSearch,
  onProceed,
  onBack,
  canProceed,
  getConfidenceBadge,
  getSelectedProject
}: {
  file: File | null
  totalPages: number
  projectDefinitions: any[]
  aiAnalysis: any
  selectedProjects: Record<string, Project>
  onAddProject: () => void
  onUpdateProject: (id: string, updates: any) => void
  onRemoveProject: (id: string) => void
  onOpenSearch: (id: string) => void
  onProceed: () => void
  onBack: () => void
  canProceed: boolean
  getConfidenceBadge: (confidence?: number) => any
  getSelectedProject: (defId: string) => Project | undefined
}) {
  return (
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
          <Button onClick={onAddProject} size="sm" variant="outline">
            Add Project
          </Button>
        </div>

        <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
          {projectDefinitions.map((def, index) => (
            <ProjectDefinitionCard
              key={def.id}
              definition={def}
              index={index}
              totalPages={totalPages}
              totalDefinitions={projectDefinitions.length}
              selectedProject={getSelectedProject(def.id)}
              onUpdate={(updates) => onUpdateProject(def.id, updates)}
              onRemove={() => onRemoveProject(def.id)}
              onSearch={() => onOpenSearch(def.id)}
              getConfidenceBadge={getConfidenceBadge}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onProceed}>
          Process Upload
        </Button>
      </div>
    </div>
  )
}

function ProjectDefinitionCard({
  definition,
  index,
  totalPages,
  totalDefinitions,
  selectedProject,
  onUpdate,
  onRemove,
  onSearch,
  getConfidenceBadge
}: {
  definition: any
  index: number
  totalPages: number
  totalDefinitions: number
  selectedProject?: Project
  onUpdate: (updates: any) => void
  onRemove: () => void
  onSearch: () => void
  getConfidenceBadge: (confidence?: number) => any
}) {
  const confidenceBadge = getConfidenceBadge(definition.confidence)

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium">
              {definition.tentativeName || `Project ${index + 1}`}
            </h4>
            {confidenceBadge && (
              <Badge variant={confidenceBadge.variant} className="ml-2">
                {confidenceBadge.percentage}% confident
              </Badge>
            )}
          </div>
          {definition.tentativeAddress && (
            <p className="text-sm text-muted-foreground">
              {definition.tentativeAddress}
            </p>
          )}
        </div>
        {totalDefinitions > 1 && (
          <Button
            onClick={onRemove}
            size="sm"
            variant="ghost"
          >
            <XCircle className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`start-${definition.id}`}>Start Page</Label>
          <Input
            id={`start-${definition.id}`}
            type="number"
            min={1}
            max={totalPages}
            value={definition.startPage}
            onChange={(e) =>
              onUpdate({
                startPage: parseInt(e.target.value) || 1,
              })
            }
            aria-label={ARIA_LABELS.PAGE_RANGE_INPUT('start', index)}
          />
        </div>
        <div>
          <Label htmlFor={`end-${definition.id}`}>End Page</Label>
          <Input
            id={`end-${definition.id}`}
            type="number"
            min={1}
            max={totalPages}
            value={definition.endPage}
            onChange={(e) =>
              onUpdate({
                endPage: parseInt(e.target.value) || totalPages,
              })
            }
            aria-label={ARIA_LABELS.PAGE_RANGE_INPUT('end', index)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Project Mode</Label>
        <RadioGroup
          value={definition.mode}
          onValueChange={(value: 'new' | 'match' | 'skip') =>
            onUpdate({ mode: value, projectId: undefined })
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="new" id={`new-${definition.id}`} />
            <Label htmlFor={`new-${definition.id}`} className="font-normal">
              Create New Project
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="match" id={`match-${definition.id}`} />
            <Label htmlFor={`match-${definition.id}`} className="font-normal">
              Match to Existing Project
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="skip" id={`skip-${definition.id}`} />
            <Label htmlFor={`skip-${definition.id}`} className="font-normal text-muted-foreground">
              Skip Project (Don't Process)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {definition.mode === 'match' && (
        <div className="space-y-2">
          <Button
            variant="outline"
            onClick={onSearch}
            className="w-full justify-start"
          >
            <Search className="h-4 w-4 mr-2" />
            {selectedProject
              ? selectedProject.project_name
              : 'Search for project...'}
          </Button>
          {selectedProject && (
            <div className="text-sm text-muted-foreground pl-2">
              {selectedProject.project_address}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProcessingStep({
  progress,
  processingStatus,
  completedScans,
  totalScans,
  error,
  batchId,
  isCancelling,
  onCancel,
  onRetry
}: {
  progress: number
  processingStatus: string
  completedScans: number
  totalScans: number
  error: string | null
  batchId: string
  isCancelling: boolean
  onCancel: () => void
  onRetry: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span id="processing-status" aria-live="polite">{processingStatus}</span>
          <span aria-label={`Upload progress: ${progress} percent complete`}>{progress}%</span>
        </div>
        <Progress
          value={progress}
          aria-labelledby="processing-status"
          aria-valuenow={progress}
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
            onClick={() => window.location.href = `/projects/batches/${batchId}`}
          >
            View Batch Status
          </Button>
          <Button onClick={onRetry}>
            Try Again
          </Button>
        </div>
      )}

      {!error && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onCancel}
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
  )
}

function CompleteStep({
  batchId,
  totalScans,
  completedScans,
  onClose
}: {
  batchId: string
  totalScans: number
  completedScans: number
  onClose: () => void
}) {
  return (
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
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={() => (window.location.href = `/projects/batches/${batchId}`)}>
          View Batch Details
        </Button>
      </div>
    </div>
  )
}

function RecoveryDialog({
  savedProgress,
  onRestore,
  onStartFresh
}: {
  savedProgress: any
  onRestore: () => void
  onStartFresh: () => void
}) {
  return (
    <Dialog open={true} onOpenChange={() => {}}>
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
          <Button variant="outline" onClick={onStartFresh}>
            Start Fresh
          </Button>
          <Button onClick={onRestore}>
            Restore Progress
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CancellationDialog({
  onConfirm,
  onCancel
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Dialog open={true} onOpenChange={() => {}}>
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
          <Button variant="outline" onClick={onCancel}>
            Continue Processing
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Cancel Upload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Main exported component with provider
export function BulkUploadDialogRefactored(props: BulkUploadDialogProps) {
  return (
    <BulkUploadProvider>
      <BulkUploadDialogContent {...props} />
    </BulkUploadProvider>
  )
}

export default BulkUploadDialogRefactored