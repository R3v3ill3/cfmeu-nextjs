'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CheckCircle, AlertCircle, Upload, FileSpreadsheet, ArrowLeft } from 'lucide-react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { validateCsvFile, validateExcelFile } from '@/lib/validation/clientFileValidation'
import { EbaImport } from '@/components/upload/EbaImport'

type ParsedData = {
  headers: string[]
  rows: Array<Record<string, any>>
  filename?: string
}

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

const MAX_FILE_SIZE = 10 * 1024 * 1024

export default function EbaSpreadsheetImport() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; rows: number } | null>(null)

  const resetUpload = () => {
    setUploadStatus('idle')
    setUploadProgress(0)
    setError(null)
    setParsedData(null)
    setFileInfo(null)
  }

  const parseCsvFile = (file: File): Promise<ParsedData> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            const errorMessages = results.errors.map(err => err.message).join(', ')
            reject(new Error(`CSV parsing errors: ${errorMessages}`))
            return
          }

          if (results.data.length === 0) {
            reject(new Error('CSV file is empty or contains no valid data'))
            return
          }

          const headers = results.meta.fields || []
          if (headers.length === 0) {
            reject(new Error('CSV file has no headers'))
            return
          }

          resolve({
            headers,
            rows: results.data as Record<string, any>[],
            filename: file.name,
          })
        },
        error: (parseError) => {
          reject(new Error(`Failed to parse CSV: ${parseError.message}`))
        },
      })
    })
  }

  const parseXlsxFile = async (file: File): Promise<ParsedData> => {
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

    if (!workbook.SheetNames.length) {
      throw new Error('XLSX file has no worksheets')
    }

    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
      raw: true,
    })

    if (rows.length === 0) {
      throw new Error('XLSX worksheet is empty or contains no valid data')
    }

    const headers = Object.keys(rows[0] || {})
    if (headers.length === 0) {
      throw new Error('XLSX worksheet has no headers')
    }

    return {
      headers,
      rows,
      filename: file.name,
    }
  }

  const processFile = useCallback(async (file: File) => {
    setUploadStatus('processing')
    setError(null)

    try {
      const isXlsx = file.name.toLowerCase().endsWith('.xlsx')
      const isCsv = file.name.toLowerCase().endsWith('.csv')

      if (isXlsx) {
        const validation = await validateExcelFile(file)
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid XLSX file')
        }
        const parsed = await parseXlsxFile(file)
        setParsedData(parsed)
        setFileInfo({ name: file.name, size: file.size, rows: parsed.rows.length })
      } else if (isCsv) {
        const validation = await validateCsvFile(file)
        if (!validation.valid) {
          throw new Error(validation.error || 'Invalid CSV file')
        }
        const parsed = await parseCsvFile(file)
        setParsedData(parsed)
        setFileInfo({ name: file.name, size: file.size, rows: parsed.rows.length })
      } else {
        throw new Error('Please upload a .csv or .xlsx file')
      }

      setUploadStatus('success')
      setUploadProgress(100)
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'Failed to parse file')
      setUploadStatus('error')
    }
  }, [])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB')
      setUploadStatus('error')
      return
    }

    setUploadStatus('uploading')
    setUploadProgress(15)

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval)
          return prev
        }
        return prev + 15
      })
    }, 120)

    await processFile(file)
    clearInterval(progressInterval)
  }, [processFile])

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
    multiple: false,
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (parsedData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">EBA Spreadsheet Import</h3>
            {fileInfo && (
              <p className="text-sm text-muted-foreground">
                {fileInfo.name} • {fileInfo.rows.toLocaleString()} rows • {formatFileSize(fileInfo.size)}
              </p>
            )}
          </div>
          <Button variant="outline" onClick={resetUpload} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Upload another file
          </Button>
        </div>
        <EbaImport csvData={parsedData.rows} onImportComplete={() => {}} onBack={resetUpload} />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          EBA Spreadsheet Import
        </CardTitle>
        <CardDescription>
          Upload a .csv or .xlsx containing Company Name, Sector, and FWC Certified Date.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-primary bg-primary/5' : 'border-border'
          } ${isDragReject ? 'border-destructive bg-destructive/5' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">
              {isDragActive ? 'Drop the file here' : 'Drag and drop a CSV/XLSX file here'}
            </p>
            <p className="text-xs text-muted-foreground">
              .csv or .xlsx files only • max 10MB
            </p>
            <Button type="button" variant="outline" size="sm">
              Select file
            </Button>
          </div>
        </div>

        {uploadStatus === 'uploading' || uploadStatus === 'processing' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>{uploadStatus === 'uploading' ? 'Uploading...' : 'Processing...'}</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        ) : null}

        {uploadStatus === 'success' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              File uploaded. Preparing EBA import review.
            </AlertDescription>
          </Alert>
        )}

        {uploadStatus === 'error' && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
