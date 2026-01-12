"use client"

import { useState, useRef, useCallback } from 'react'
import { 
  ExternalLink, 
  Upload, 
  Loader2, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { WizardButton } from '../shared/WizardButton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import type { BCIImportData, BCINormalizedProject, BCINormalizedCompany } from '../hooks/useWizardState'

interface BCIImportPanelProps {
  onFileProcessed: (data: BCIImportData) => void
  onBack: () => void
}

const BCI_LOGIN_URL = 'https://www.bcicentral.com/lmlogin/'

export function BCIImportPanel({ onFileProcessed, onBack }: BCIImportPanelProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInstructions, setShowInstructions] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return
    
    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Please select a valid .xlsx file from BCI')
      return
    }
    
    // Validate file size (max 1MB)
    if (file.size > 1_000_000) {
      setError('File is too large. Please keep under 1MB.')
      return
    }
    
    setError(null)
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/bci/normalize-single', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || `Upload failed (${response.status})`)
      }
      
      const data = await response.json()
      
      if (!data.success || !data.projects || data.projects.length === 0) {
        throw new Error('No projects found in the file. Please check you exported the correct project from BCI.')
      }
      
      // Call the callback with normalized data
      onFileProcessed({
        projects: data.projects as BCINormalizedProject[],
        companies: data.companies as BCINormalizedCompany[],
      })
    } catch (err) {
      console.error('[BCIImportPanel] Upload error:', err)
      setError(err instanceof Error ? err.message : 'Failed to process file')
    } finally {
      setIsUploading(false)
    }
  }, [onFileProcessed])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }, [handleFileSelect])

  return (
    <div className="p-4 space-y-6 pb-safe-bottom">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Import from BCI</h1>
        <p className="text-gray-600">
          Export project data from BCI Central and upload here
        </p>
      </div>

      {/* Instructions Card - Collapsible but stays visible */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowInstructions(!showInstructions)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="h-4 w-4 text-blue-600" />
            </div>
            <span className="font-semibold text-blue-900">How to export from BCI</span>
          </div>
          {showInstructions ? (
            <ChevronUp className="h-5 w-5 text-blue-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-blue-600" />
          )}
        </button>
        
        {showInstructions && (
          <div className="px-4 pb-4 space-y-3">
            <ol className="space-y-3 text-sm text-blue-800">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center font-semibold text-xs">
                  1
                </span>
                <span>Log into BCI Central using the link below</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center font-semibold text-xs">
                  2
                </span>
                <span>Search for your project (Projects → Search)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center font-semibold text-xs">
                  3
                </span>
                <span>Select the project to view details</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center font-semibold text-xs">
                  4
                </span>
                <span>Click <strong>&quot;Export to Excel&quot;</strong> to download</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-200 text-blue-700 rounded-full flex items-center justify-center font-semibold text-xs">
                  5
                </span>
                <span>Return here and upload the file below</span>
              </li>
            </ol>

            {/* BCI Login Link */}
            <a
              href={BCI_LOGIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-semibold transition-colors touch-manipulation"
            >
              <ExternalLink className="h-5 w-5" />
              Open BCI Central
            </a>
          </div>
        )}
      </div>

      {/* File Upload Area */}
      <div className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleInputChange}
          className="hidden"
        />
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "w-full py-6 px-4 border-2 border-dashed rounded-2xl transition-all touch-manipulation",
            isUploading
              ? "bg-gray-50 border-gray-300 cursor-wait"
              : "bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 active:bg-blue-100"
          )}
        >
          <div className="flex flex-col items-center gap-3">
            {isUploading ? (
              <>
                <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                <div className="text-center">
                  <p className="font-semibold text-gray-900">Processing file...</p>
                  <p className="text-sm text-gray-500 mt-1">This may take a few seconds</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Upload className="h-7 w-7 text-gray-600" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">Tap to select file</p>
                  <p className="text-sm text-gray-500 mt-1">.xlsx files only (max 1MB)</p>
                </div>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Back Button */}
      <div className="pt-2">
        <WizardButton
          variant="secondary"
          onClick={onBack}
          disabled={isUploading}
          className="w-full"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </WizardButton>
      </div>
    </div>
  )
}
