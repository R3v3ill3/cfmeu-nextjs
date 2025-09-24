'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FolderOpen, Database, Upload } from 'lucide-react'
// Removed BCI-specific imports from Projects management per new UX
// import BCIProjectImport from '@/components/upload/BCIProjectImport'
// import BCICsvParser from '@/components/upload/BCICsvParser'
import ProjectImport from '@/components/upload/ProjectImport'
import FileUpload from '@/components/upload/FileUpload'

type ProjectImportMode = 'csv-upload'

interface ProjectOption {
  mode: ProjectImportMode
  title: string
  description: string
}

const projectModeOptions: ProjectOption[] = [
  {
    mode: 'csv-upload',
    title: 'Project CSV Upload',
    description: 'Upload project data from standard CSV format'
  }
]

export default function ProjectsManagement() {
  const [selectedMode, setSelectedMode] = useState<ProjectImportMode>('csv-upload')
  const [csvData, setCsvData] = useState<any[]>([])
  const [showImport, setShowImport] = useState(false)

  // Removed BCI handling

  const handleCsvUploaded = (data: { headers: string[]; rows: Record<string, any>[]; filename?: string }) => {
    setCsvData(data.rows)
    setShowImport(true)
  }

  const resetToSelection = () => {
    setSelectedMode('csv-upload')
    setCsvData([])
    setShowImport(false)
  }

  const selectedOption = projectModeOptions.find(opt => opt.mode === selectedMode)

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-2">Project Management</h2>
        <p className="text-gray-600">Import construction project data from BCI or standard CSV formats</p>
      </div>

      {!showImport ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Project CSV Upload
              </CardTitle>
              <CardDescription>Upload project data from standard CSV format</CardDescription>
            </CardHeader>
            <CardContent>
                  <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    Upload a CSV file containing project information including names, addresses, values, and dates.
                  </p>
                  <FileUpload onFileUploaded={handleCsvUploaded} />
                  </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Import Processing */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FolderOpen className="h-5 w-5 mr-2" />
              CSV Project Import
            </CardTitle>
            <CardDescription>
              {`Processing ${csvData.length} project records from CSV`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectImport 
              csvData={csvData}
              onImportComplete={resetToSelection}
              onBack={resetToSelection}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
