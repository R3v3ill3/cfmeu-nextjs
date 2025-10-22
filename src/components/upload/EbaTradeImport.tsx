'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  Trash2,
  PlayCircle,
  Eye,
  Edit,
  Search,
  Save,
  X,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import {
  mapFilenameToTradeType,
  extractTradeLabelFromFilename,
  getAllTradeOptions,
  type TradeType,
} from '@/utils/ebaTradeTypeMapping'

type WorkflowStep = 'upload' | 'review' | 'match' | 'complete'

interface UploadedFile {
  file: File
  id: string
  detectedTradeType: TradeType | null
  manualTradeType?: TradeType
  status: 'pending' | 'parsing' | 'parsed' | 'error'
  parsedCount?: number
  error?: string
  costUsd?: number
  parseResult?: ParseResult
}

interface ParsedEmployer {
  companyName: string
  aliases?: string[]
  streetAddress?: string
  suburb?: string
  state?: string
  postcode?: string
  phones: string[]
  sectorCode?: string
}

interface ReviewEmployer extends ParsedEmployer {
  id: string
  tradeType: TradeType | null
  tradeLabel: string
  sourceFile: string
  isValid: boolean
  isEditing: boolean
  notes?: string
}

interface ParseResult {
  success: boolean
  tradeType: string | null
  tradeLabel: string
  sourceFile: string
  employers: ParsedEmployer[]
  totalParsed: number
  metadata?: {
    modelUsed: string
    costUsd: number
    processingTimeMs: number
  }
}

interface EbaTradeImportProps {
  onNavigateToPendingImport?: () => void
}

export default function EbaTradeImport({ onNavigateToPendingImport }: EbaTradeImportProps) {
  const [workflowStep, setWorkflowStep] = useState<WorkflowStep>('upload')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [batchId] = useState(() => `eba_batch_${Date.now()}`)
  const [completedCount, setCompletedCount] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  
  // Review state
  const [reviewEmployers, setReviewEmployers] = useState<ReviewEmployer[]>([])
  const [editingEmployer, setEditingEmployer] = useState<ReviewEmployer | null>(null)

  const supabase = getSupabaseBrowserClient()

  // File upload handling
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedFile[] = acceptedFiles.map((file) => ({
      file,
      id: `${file.name}_${Date.now()}`,
      detectedTradeType: mapFilenameToTradeType(file.name),
      status: 'pending',
    }))

    setFiles((prev) => [...prev, ...newFiles])
    toast.success(`${acceptedFiles.length} file(s) added`)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  })

  // Remove a file from the list
  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  // Update trade type for a file
  const updateTradeType = (fileId: string, tradeType: TradeType) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId ? { ...f, manualTradeType: tradeType } : f
      )
    )
  }

  // Parse a single PDF
  const parsePdf = async (uploadedFile: UploadedFile): Promise<ParseResult> => {
    const formData = new FormData()
    formData.append('file', uploadedFile.file)
    
    if (uploadedFile.manualTradeType) {
      formData.append('tradeType', uploadedFile.manualTradeType)
    }

    const response = await fetch('/api/admin/eba-trade-import/parse', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Parse failed')
    }

    return response.json()
  }

  // Process all pending files - parse only, don't store yet
  const processAllFiles = async () => {
    if (files.length === 0) {
      toast.error('No files to process')
      return
    }

    setIsProcessing(true)
    setCompletedCount(0)
    setTotalCost(0)
    const allParsedEmployers: ReviewEmployer[] = []

    for (const uploadedFile of files) {
      if (uploadedFile.status !== 'pending') continue

      try {
        // Update status: parsing
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id ? { ...f, status: 'parsing' } : f
          )
        )

        // Parse PDF with Claude
        const parseResult = await parsePdf(uploadedFile)

        // Update status: parsed
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id
              ? {
                  ...f,
                  status: 'parsed',
                  parsedCount: parseResult.totalParsed,
                  costUsd: parseResult.metadata?.costUsd,
                  parseResult,
                }
              : f
          )
        )

        // Convert to review format
        const tradeType = uploadedFile.manualTradeType || uploadedFile.detectedTradeType
        const newEmployers: ReviewEmployer[] = parseResult.employers.map((emp) => ({
          ...emp,
          id: `${uploadedFile.id}_${emp.companyName}_${Date.now()}`,
          tradeType,
          tradeLabel: parseResult.tradeLabel,
          sourceFile: parseResult.sourceFile,
          isValid: true,
          isEditing: false,
        }))

        allParsedEmployers.push(...newEmployers)

        setCompletedCount((prev) => prev + 1)
        setTotalCost((prev) => prev + (parseResult.metadata?.costUsd || 0))

        toast.success(
          `${uploadedFile.file.name}: ${parseResult.totalParsed} employers parsed`
        )
      } catch (error) {
        console.error(`Failed to process ${uploadedFile.file.name}:`, error)
        
        setFiles((prev) =>
          prev.map((f) =>
            f.id === uploadedFile.id
              ? {
                  ...f,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Unknown error',
                }
              : f
          )
        )

        toast.error(`Failed to process ${uploadedFile.file.name}`)
      }
    }

    setIsProcessing(false)
    setReviewEmployers(allParsedEmployers)

    if (allParsedEmployers.length > 0) {
      setWorkflowStep('review')
      toast.success(
        `Parsing complete! Review ${allParsedEmployers.length} employers before importing`,
        { duration: 5000 }
      )
    }
  }

  // Review screen functions
  const toggleEmployerEdit = (employerId: string) => {
    const employer = reviewEmployers.find((e) => e.id === employerId)
    if (employer) {
      setEditingEmployer({ ...employer })
    }
  }

  const saveEmployerEdit = () => {
    if (!editingEmployer) return

    setReviewEmployers((prev) =>
      prev.map((e) =>
        e.id === editingEmployer.id
          ? { ...editingEmployer, isEditing: false }
          : e
      )
    )
    setEditingEmployer(null)
    toast.success('Employer updated')
  }

  const removeEmployer = (employerId: string) => {
    const employer = reviewEmployers.find((e) => e.id === employerId)
    if (!employer) return

    setReviewEmployers((prev) => prev.filter((e) => e.id !== employerId))
    toast.success(`Removed "${employer.companyName}"`)
  }

  const toggleEmployerValidity = (employerId: string) => {
    setReviewEmployers((prev) =>
      prev.map((e) =>
        e.id === employerId ? { ...e, isValid: !e.isValid } : e
      )
    )
  }

  // Store reviewed employers to pending_employers table
  const storeReviewedEmployers = async (andContinue: boolean = false) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('User not authenticated')
      return
    }

    const validEmployers = reviewEmployers.filter((e) => e.isValid)
    if (validEmployers.length === 0) {
      toast.error('No valid employers to store')
      return
    }

    try {
      const employerRecords = validEmployers.map((emp) => ({
        company_name: emp.companyName,
        csv_role: emp.tradeType || 'unknown',
        our_role: 'subcontractor',
        inferred_trade_type: emp.tradeType || null,
        import_status: 'pending',
        source: `eba_trade_pdf:${batchId}:${emp.sourceFile}`,
        created_by: user.id,
        raw: {
          aliases: emp.aliases || [], // Store trading names for import
          streetAddress: emp.streetAddress,
          suburb: emp.suburb,
          state: emp.state,
          postcode: emp.postcode,
          phones: emp.phones,
          sectorCode: emp.sectorCode,
          sourceFile: emp.sourceFile,
          tradeLabel: emp.tradeLabel,
          batchId,
          notes: emp.notes,
          address_line_1: emp.streetAddress,
          suburb: emp.suburb,
          state: emp.state,
          postcode: emp.postcode,
          phone: emp.phones?.[0] || null,
        },
      }))

      const { error } = await supabase
        .from('pending_employers')
        .insert(employerRecords)

      if (error) {
        console.error('Failed to insert pending employers:', error)
        throw new Error(`Database insert failed: ${error.message}`)
      }

      toast.success(
        `${validEmployers.length} employers added to pending import queue`,
        { duration: 5000 }
      )

      if (andContinue && onNavigateToPendingImport) {
        // Navigate directly to pending employers
        onNavigateToPendingImport()
      } else {
        setWorkflowStep('complete')
      }
    } catch (error) {
      console.error('Store error:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to store employers'
      )
    }
  }

  const resetWorkflow = () => {
    setWorkflowStep('upload')
    setFiles([])
    setReviewEmployers([])
    setCompletedCount(0)
    setTotalCost(0)
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="h-5 w-5 text-gray-400" />
      case 'parsing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'parsed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusLabel = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return 'Ready'
      case 'parsing':
        return 'Parsing with AI...'
      case 'parsed':
        return 'Parsed'
      case 'error':
        return 'Error'
      default:
        return status
    }
  }

  const pendingFiles = files.filter((f) => f.status === 'pending')
  const parsedFiles = files.filter((f) => f.status === 'parsed')
  const errorFiles = files.filter((f) => f.status === 'error')

  const tradeOptions = getAllTradeOptions()
  const validEmployersCount = reviewEmployers.filter((e) => e.isValid).length

  // Render different screens based on workflow step
  if (workflowStep === 'complete') {
    return (
      <div className="space-y-6">
        <Alert>
          <CheckCircle2 className="h-4 w-4" />
          <AlertDescription>
            <strong>{validEmployersCount} employers</strong> have been stored in the pending
            import queue. Continue with manual matching and FWC EBA search.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Import Complete</CardTitle>
            <CardDescription>
              Next steps: Review pending employers, match duplicates, and run FWC EBA searches
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{parsedFiles.length}</p>
                <p className="text-sm text-gray-500">Files Processed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{validEmployersCount}</p>
                <p className="text-sm text-gray-500">Employers Stored</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  ${totalCost.toFixed(3)}
                </p>
                <p className="text-sm text-gray-500">Total AI Cost</p>
              </div>
            </div>

            <div className="flex gap-2">
              {onNavigateToPendingImport && (
                <Button onClick={onNavigateToPendingImport} className="flex-1" size="lg">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go to Pending Employers
                </Button>
              )}
              <Button 
                onClick={resetWorkflow} 
                className={onNavigateToPendingImport ? 'flex-1' : 'w-full'} 
                variant="outline"
              >
                Start New Import
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (workflowStep === 'review') {
    return (
      <div className="space-y-6">
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            Review parsed employers below. You can edit details, remove invalid entries, or add
            notes. When ready, click "Store in Pending Queue" to continue.
          </AlertDescription>
        </Alert>
        
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>⚠️ Trade Type Confirmation:</strong> Review the trade type dropdown for each employer. 
            Auto-detected from filename (e.g., "Waterproofing.pdf" → waterproofing), but verify it's correct. 
            Common variations like "concreting/concreter/concrete" should all use the same canonical trade type.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Review Parsed Employers ({reviewEmployers.length})</CardTitle>
                <CardDescription>
                  {validEmployersCount} valid • {reviewEmployers.length - validEmployersCount}{' '}
                  marked invalid
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setWorkflowStep('upload')} variant="outline">
                  <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
                  Back to Upload
                </Button>
                {onNavigateToPendingImport ? (
                  <>
                    <Button
                      onClick={() => storeReviewedEmployers(false)}
                      disabled={validEmployersCount === 0}
                      variant="outline"
                      size="lg"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Store {validEmployersCount} Employers
                    </Button>
                    <Button
                      onClick={() => storeReviewedEmployers(true)}
                      disabled={validEmployersCount === 0}
                      size="lg"
                    >
                      <Search className="h-4 w-4 mr-2" />
                      Store & Continue to Matching
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => storeReviewedEmployers(false)}
                    disabled={validEmployersCount === 0}
                    size="lg"
                  >
                    Store {validEmployersCount} Employers in Pending Queue
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Valid</TableHead>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Trade</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviewEmployers.map((employer) => (
                    <TableRow
                      key={employer.id}
                      className={!employer.isValid ? 'opacity-50 bg-gray-50' : ''}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={employer.isValid}
                          onChange={() => toggleEmployerValidity(employer.id)}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div>
                          {employer.companyName}
                          {employer.aliases && employer.aliases.length > 0 && (
                            <div className="text-xs text-gray-500 font-normal mt-1">
                              T/A: {employer.aliases.join(', ')}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {[
                          employer.streetAddress,
                          employer.suburb,
                          employer.state,
                          employer.postcode,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {(employer.phones || []).join(', ') || '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={employer.tradeType || 'general_construction'}
                          onValueChange={(value) => {
                            setReviewEmployers((prev) =>
                              prev.map((e) =>
                                e.id === employer.id
                                  ? { ...e, tradeType: value as TradeType }
                                  : e
                              )
                            )
                          }}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getAllTradeOptions().map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {employer.tradeType !== employer.tradeLabel && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            Modified
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {employer.sourceFile}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleEmployerEdit(employer.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEmployer(employer.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={!!editingEmployer} onOpenChange={() => setEditingEmployer(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Employer</DialogTitle>
              <DialogDescription>
                Make corrections to the parsed employer data
              </DialogDescription>
            </DialogHeader>
            
            {editingEmployer && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Company Name (Legal Entity)</label>
                  <Input
                    value={editingEmployer.companyName}
                    onChange={(e) =>
                      setEditingEmployer({ ...editingEmployer, companyName: e.target.value })
                    }
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Trading Names / Aliases (comma-separated)</label>
                  <Input
                    value={editingEmployer.aliases?.join(', ') || ''}
                    onChange={(e) =>
                      setEditingEmployer({
                        ...editingEmployer,
                        aliases: e.target.value.split(',').map((a) => a.trim()).filter(Boolean),
                      })
                    }
                    placeholder="e.g., Deluxe Cleaning, Deluxe Services"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    These will be stored as employer aliases for better duplicate matching
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Street Address</label>
                    <Input
                      value={editingEmployer.streetAddress || ''}
                      onChange={(e) =>
                        setEditingEmployer({
                          ...editingEmployer,
                          streetAddress: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Suburb</label>
                    <Input
                      value={editingEmployer.suburb || ''}
                      onChange={(e) =>
                        setEditingEmployer({ ...editingEmployer, suburb: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">State</label>
                    <Input
                      value={editingEmployer.state || ''}
                      onChange={(e) =>
                        setEditingEmployer({ ...editingEmployer, state: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Postcode</label>
                    <Input
                      value={editingEmployer.postcode || ''}
                      onChange={(e) =>
                        setEditingEmployer({ ...editingEmployer, postcode: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Phone Numbers (comma-separated)</label>
                  <Input
                    value={(editingEmployer.phones || []).join(', ')}
                    onChange={(e) =>
                      setEditingEmployer({
                        ...editingEmployer,
                        phones: e.target.value.split(',').map((p) => p.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Trade Type</label>
                  <Select
                    value={editingEmployer.tradeType || 'general_construction'}
                    onValueChange={(value) =>
                      setEditingEmployer({ ...editingEmployer, tradeType: value as TradeType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAllTradeOptions().map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Detected from filename: <strong>{editingEmployer.tradeLabel}</strong>
                    {editingEmployer.tradeType !== editingEmployer.tradeLabel && (
                      <span className="text-amber-600 ml-2">
                        ⚠️ Modified from detected value
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={editingEmployer.notes || ''}
                    onChange={(e) =>
                      setEditingEmployer({ ...editingEmployer, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingEmployer(null)}>
                Cancel
              </Button>
              <Button onClick={saveEmployerEdit}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  // Default: Upload screen
  return (
    <div className="space-y-6">
      {/* Instructions */}
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertDescription>
          <strong>Step 1:</strong> Upload EBA trade-categorized PDFs. Each PDF will be parsed
          using AI to extract employer information. You'll be able to review and edit the
          results before storing them.
        </AlertDescription>
      </Alert>

      {/* Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload EBA Trade PDFs</CardTitle>
          <CardDescription>
            Drop multiple PDFs here or click to browse. Trade types will be auto-detected from
            filenames.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
              transition-colors
              ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-300 hover:border-primary'
              }
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-lg font-medium">Drop PDFs here...</p>
            ) : (
              <>
                <p className="text-lg font-medium mb-2">Drag & drop EBA trade PDFs here</p>
                <p className="text-sm text-gray-500">or click to select files</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Files ({files.length})</CardTitle>
                <CardDescription>
                  {pendingFiles.length} pending • {parsedFiles.length} parsed
                  {errorFiles.length > 0 && ` • ${errorFiles.length} errors`}
                </CardDescription>
              </div>
              <Button
                onClick={processAllFiles}
                disabled={isProcessing || pendingFiles.length === 0}
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing {completedCount}/{files.length}
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Parse All Files with AI
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.map((uploadedFile) => (
              <div key={uploadedFile.id} className="flex items-center gap-4 p-4 border rounded-lg">
                {/* Status Icon */}
                <div className="flex-shrink-0">{getStatusIcon(uploadedFile.status)}</div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{uploadedFile.file.name}</p>
                    <Badge variant="outline" className="text-xs">
                      {extractTradeLabelFromFilename(uploadedFile.file.name)}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500">
                    {getStatusLabel(uploadedFile.status)}
                    {uploadedFile.parsedCount && <> • {uploadedFile.parsedCount} employers</>}
                    {uploadedFile.costUsd && <> • ${uploadedFile.costUsd.toFixed(3)}</>}
                  </p>
                  {uploadedFile.error && (
                    <p className="text-sm text-red-600 mt-1">{uploadedFile.error}</p>
                  )}
                </div>

                {/* Trade Type Selector */}
                {uploadedFile.status === 'pending' && (
                  <div className="w-48">
                    <Select
                      value={
                        uploadedFile.manualTradeType || uploadedFile.detectedTradeType || ''
                      }
                      onValueChange={(value) =>
                        updateTradeType(uploadedFile.id, value as TradeType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select trade..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tradeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Remove Button */}
                {uploadedFile.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(uploadedFile.id)}
                    disabled={isProcessing}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Progress Summary */}
      {isProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Parsing files with AI...</span>
                <span>
                  {completedCount} / {files.length}
                </span>
              </div>
              <Progress value={(completedCount / files.length) * 100} />
              <div className="flex justify-between text-sm text-gray-500">
                <span>Estimated cost: ${totalCost.toFixed(3)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Summary */}
      {totalCost > 0 && parsedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parsing Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">{parsedFiles.length}</p>
                <p className="text-sm text-gray-500">Files Parsed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {parsedFiles.reduce((sum, f) => sum + (f.parsedCount || 0), 0)}
                </p>
                <p className="text-sm text-gray-500">Employers Found</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">${totalCost.toFixed(3)}</p>
                <p className="text-sm text-gray-500">Total AI Cost</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
