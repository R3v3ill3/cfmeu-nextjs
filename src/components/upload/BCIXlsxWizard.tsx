'use client'

import {  useCallback, useEffect, useMemo, useRef, useState  } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Upload, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import BCIProjectImport from '@/components/upload/BCIProjectImport'

type NormalizedProjectRow = {
  projectId: string
  projectName: string
  projectStage: string
  projectStatus?: string
  localValue?: number
  fundingTypePrimary?: string
  ownerTypeLevel1Primary?: string
  constructionStartDate?: string
  constructionEndDate?: string
  projectAddress?: string
  projectTown?: string
  projectState?: string
  postCode?: string
  latitude?: number
  longitude?: number
  lastUpdate?: string
}

type NormalizedCompanyRow = {
  projectId: string
  companyId?: string
  companyName: string
  roleOnProject: string
}

// Minimal shape used by BCIProjectImport
type BCICsvRow = {
  projectId: string
  projectName: string
  projectStage: string
  projectStatus?: string
  localValue: string
  fundingTypePrimary?: string
  ownerTypeLevel1Primary?: string
  constructionStartDate?: string
  constructionEndDate?: string
  projectAddress?: string
  projectTown?: string
  projectState?: string
  postCode?: string
  latitude?: string
  longitude?: string
  lastUpdate?: string
  roleOnProject?: string
  roleGroupOnProject?: string
  companyId?: string
  companyName?: string
}

type WizardStage = 'upload' | 'projects' | 'employers' | 'done'
type EmployerMode = 'quick' | 'fuzzy'

type ErrorInfo = {
  message: string
  code?: string
  isRetryable?: boolean
}

export default function BCIXlsxWizard() {
  const [stage, setStage] = useState<WizardStage>('upload')
  const [error, setError] = useState<ErrorInfo | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [lastFile, setLastFile] = useState<File | null>(null)
  const [projects, setProjects] = useState<NormalizedProjectRow[]>([])
  const [companies, setCompanies] = useState<NormalizedCompanyRow[]>([])
  const [employerMode, setEmployerMode] = useState<EmployerMode>('quick')
  useEffect(() => {
    console.log('[BCIXlsxWizard] stage =', stage)
  }, [stage])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const projectRowsForImport: BCICsvRow[] = useMemo(() => {
    return projects.map((p) => ({
      projectId: p.projectId,
      projectName: p.projectName || `Project ${p.projectId}`,
      projectStage: p.projectStage,
      projectStatus: p.projectStatus,
      localValue: (p.localValue ?? 0).toString(),
      fundingTypePrimary: p.fundingTypePrimary,
      ownerTypeLevel1Primary: p.ownerTypeLevel1Primary,
      constructionStartDate: p.constructionStartDate,
      constructionEndDate: p.constructionEndDate,
      projectAddress: p.projectAddress,
      projectTown: p.projectTown,
      projectState: p.projectState,
      postCode: p.postCode,
      latitude: p.latitude != null ? String(p.latitude) : undefined,
      longitude: p.longitude != null ? String(p.longitude) : undefined,
      lastUpdate: p.lastUpdate
    }))
  }, [projects])

  const combinedRowsForEmployers: BCICsvRow[] = useMemo(() => {
    const map = new Map(projects.map(p => [p.projectId, p]))
    return companies.map((c) => {
      const p = map.get(c.projectId)
      return {
        projectId: c.projectId,
        projectName: p?.projectName || `Project ${c.projectId}`,
        projectStage: p?.projectStage || '',
        projectStatus: p?.projectStatus,
        localValue: (p?.localValue ?? 0).toString(),
        fundingTypePrimary: p?.fundingTypePrimary,
        ownerTypeLevel1Primary: p?.ownerTypeLevel1Primary,
        constructionStartDate: p?.constructionStartDate,
        constructionEndDate: p?.constructionEndDate,
        projectAddress: p?.projectAddress,
        projectTown: p?.projectTown,
        projectState: p?.projectState,
        postCode: p?.postCode,
        latitude: p?.latitude != null ? String(p.latitude) : undefined,
        longitude: p?.longitude != null ? String(p.longitude) : undefined,
        lastUpdate: p?.lastUpdate,
        roleOnProject: c.roleOnProject,
        companyId: c.companyId,
        companyName: c.companyName
      }
    })
  }, [projects, companies])

  const onFileSelected = useCallback(async (file: File) => {
    setError(null)
    setLastFile(file)
    
    if (!file || !file.name.toLowerCase().endsWith('.xlsx')) {
      setError({ message: 'Please select a valid .xlsx file', isRetryable: false })
      return
    }
    if (file.size > 1_000_000) {
      setError({ message: 'File is too large. Please keep under 1MB.', isRetryable: false })
      return
    }
    
    setIsUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/dev/bci/normalize-xlsx', { method: 'POST', body: form })
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        const errorCode = data?.code || (res.status === 504 ? 'TIMEOUT' : res.status === 502 ? 'PROXY_ERROR' : undefined)
        const isRetryable = res.status === 504 || res.status === 502 || res.status >= 500
        
        let message = data?.error || 'Failed to normalize file'
        if (errorCode === 'TIMEOUT') {
          message = 'Request timed out. The import service may be starting up — please try again in a few seconds.'
        } else if (res.status === 502) {
          message = 'Unable to connect to the import service. Please try again in a moment.'
        } else if (res.status === 500 && message.includes('not configured')) {
          message = 'The BCI import service is not properly configured. Please contact support.'
        }
        
        throw { message, code: errorCode, isRetryable }
      }
      
      const data = await res.json()
      setProjects(data.projects || [])
      setCompanies(data.companies || [])
      setStage('projects')
    } catch (e: any) {
      console.error('[BCIXlsxWizard] Upload error:', e)
      if (e.code || e.isRetryable !== undefined) {
        setError(e as ErrorInfo)
      } else {
        setError({ 
          message: e?.message || 'Upload failed. Please check your connection and try again.',
          isRetryable: true 
        })
      }
    } finally {
      setIsUploading(false)
    }
  }, [])

  const handleRetry = useCallback(() => {
    if (lastFile) {
      onFileSelected(lastFile)
    }
  }, [lastFile, onFileSelected])

  const renderUpload = () => (
    <Card>
      <CardHeader>
        <CardTitle>BCI XLSX Import</CardTitle>
        <CardDescription>
          Upload a BCI .xlsx file. We'll split Project and Company sheets, clean the blank top row, then import projects first, followed by employers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Import Error</AlertTitle>
              <AlertDescription className="mt-2">
                <p>{error.message}</p>
                {error.isRetryable && lastFile && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-3"
                    onClick={handleRetry}
                    disabled={isUploading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
          <div className="inline-flex items-center gap-2 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onFileSelected(f)
              }}
            />
            <Button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              {isUploading ? 'Processing…' : 'Select .xlsx file'}
            </Button>
            <span className="text-sm text-muted-foreground">Max 1MB. Sheets must be Project and Company.</span>
          </div>
          {isUploading && (
            <p className="text-sm text-muted-foreground">
              Uploading and processing your file. This may take up to 30 seconds if the service is starting up…
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (stage === 'upload') return renderUpload()

  if (stage === 'projects') {
    return (
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground">Stage: projects</div>
        <Card>
          <CardHeader>
            <CardTitle>Stage 1: Import Projects</CardTitle>
            <CardDescription>
              Importing {projects.length} projects. Once complete, you will be taken to employer matching.
            </CardDescription>
          </CardHeader>
        </Card>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setStage('employers')}>Continue to employers</Button>
        </div>
        <BCIProjectImport
          key="projects-import"
          csvData={projectRowsForImport as any}
          mode={'projects-only' as any}
          onImportComplete={() => {
            console.log('[BCIXlsxWizard] Projects step complete → advancing to employers')
            setStage('employers')
          }}
          initialFile={undefined as any}
          onEmployersStaged={undefined as any}
        />
      </div>
    )
  }

  if (stage === 'employers') {
    return (
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground">Stage: employers</div>
        <Card>
          <CardHeader>
            <CardTitle>Stage 2: Employers → Existing Projects</CardTitle>
            <CardDescription>
              Matching and importing {companies.length} employer records against imported projects.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Matching mode</CardTitle>
            <CardDescription>
              Quick match uses BCI Company ID only. Switch to fuzzy to use name matching.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Button variant={employerMode === 'quick' ? 'default' : 'outline'} size="sm" onClick={() => setEmployerMode('quick')}>Quick match</Button>
              <Button variant={employerMode === 'fuzzy' ? 'default' : 'outline'} size="sm" onClick={() => setEmployerMode('fuzzy')}>Fuzzy match</Button>
            </div>
          </CardContent>
        </Card>
        <BCIProjectImport
          key={`employers-import-${employerMode}`}
          csvData={combinedRowsForEmployers as any}
          mode={(employerMode === 'quick' ? 'employers-to-existing-quick-match' : 'employers-to-existing') as any}
          autoQuickFlow={true}
          showTopConfirmAllButton={true}
          onImportComplete={() => setStage('done')}
          initialFile={undefined as any}
          onEmployersStaged={undefined as any}
        />
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>BCI XLSX Import</CardTitle>
        <CardDescription>All done.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2">
          <Button onClick={() => { setStage('upload'); setProjects([]); setCompanies([]); }}>Run again</Button>
        </div>
      </CardContent>
    </Card>
  )
}


