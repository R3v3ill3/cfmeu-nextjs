'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FolderOpen, Database, Upload } from 'lucide-react'
import BCIProjectImport from '@/components/upload/BCIProjectImport'
import BCICsvParser from '@/components/upload/BCICsvParser'
import ProjectImport from '@/components/upload/ProjectImport'
import FileUpload from '@/components/upload/FileUpload'

type ProjectImportMode = 'projects-and-employers' | 'projects-only' | 'employers-to-existing' | 'employers-to-existing-quick-match' | 'csv-upload'

interface ProjectOption {
  mode: ProjectImportMode
  title: string
  description: string
}

const projectModeOptions: ProjectOption[] = [
  {
    mode: 'projects-and-employers',
    title: 'Projects + Employers',
    description: 'Import both new projects and their associated employers'
  },
  {
    mode: 'projects-only',
    title: 'Projects Only',
    description: 'Import only project data without employer information'
  },
  {
    mode: 'employers-to-existing',
    title: 'Employers to Existing Projects',
    description: 'Link employers to existing projects in the database'
  },
  {
    mode: 'employers-to-existing-quick-match',
    title: 'Quick Match Employers',
    description: 'Automatically match and link employers to existing projects'
  },
  {
    mode: 'csv-upload',
    title: 'Project CSV Upload',
    description: 'Upload project data from standard CSV format'
  }
]

export default function ProjectsManagement() {
  const [selectedMode, setSelectedMode] = useState<ProjectImportMode>('projects-and-employers')
  const [bciData, setBciData] = useState<any[]>([])
  const [csvData, setCsvData] = useState<any[]>([])
  const [showImport, setShowImport] = useState(false)

  const handleBciDataParsed = (data: any[]) => {
    setBciData(data)
    setShowImport(true)
  }

  const handleCsvUploaded = (data: { headers: string[]; rows: Record<string, any>[]; filename?: string }) => {
    setCsvData(data.rows)
    setShowImport(true)
  }

  const resetToSelection = () => {
    setSelectedMode('projects-and-employers')
    setBciData([])
    setCsvData([])
    setShowImport(false)
  }

  const isBciMode = selectedMode !== 'csv-upload'
  const selectedOption = projectModeOptions.find(opt => opt.mode === selectedMode)

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-2">Project Management</h2>
        <p className="text-gray-600">Import construction project data from BCI or standard CSV formats</p>
      </div>

      {!showImport ? (
        <div className="space-y-6">
          {/* Import Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Database className="h-5 w-5 mr-2" />
                Select Import Type
              </CardTitle>
              <CardDescription>Choose between BCI project data or standard CSV upload</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="bci" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bci">BCI Projects</TabsTrigger>
                  <TabsTrigger value="csv">CSV Upload</TabsTrigger>
                </TabsList>
                
                <TabsContent value="bci" className="mt-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {projectModeOptions.slice(0, 4).map((option) => {
                        const isSelected = selectedMode === option.mode
                        return (
                          <Card 
                            key={option.mode} 
                            className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary shadow-md' : ''}`}
                            onClick={() => setSelectedMode(option.mode)}
                          >
                            <CardHeader className="pb-3">
                              <CardTitle className="text-base">{option.title}</CardTitle>
                              <CardDescription className="text-sm">{option.description}</CardDescription>
                            </CardHeader>
                          </Card>
                        )
                      })}
                    </div>
                    
                    <div className="mt-6">
                      <h4 className="font-medium mb-3">Upload BCI Data File</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Selected mode: <strong>{selectedOption?.title}</strong> - {selectedOption?.description}
                      </p>
                      <BCICsvParser 
                        onDataParsed={handleBciDataParsed}
                        onError={(error) => console.error('BCI Parse Error:', error)}
                        onModeChange={(mode) => setSelectedMode(mode as ProjectImportMode)}
                      />
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="csv" className="mt-6">
                  <div className="space-y-4">
                    <Card className="ring-2 ring-primary shadow-md">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center">
                          <Upload className="h-4 w-4 mr-2" />
                          Project CSV Upload
                        </CardTitle>
                        <CardDescription className="text-sm">
                          Upload project data from standard CSV format
                        </CardDescription>
                      </CardHeader>
                    </Card>
                    
                    <div className="mt-6">
                      <h4 className="font-medium mb-3">Upload Project CSV File</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Upload a CSV file containing project information including names, addresses, values, and dates.
                      </p>
                      <FileUpload onFileUploaded={handleCsvUploaded} />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Import Processing */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FolderOpen className="h-5 w-5 mr-2" />
              {isBciMode ? 'BCI Project Import' : 'CSV Project Import'}
            </CardTitle>
            <CardDescription>
              {isBciMode 
                ? `Processing ${bciData.length} BCI records in ${selectedOption?.title} mode`
                : `Processing ${csvData.length} project records from CSV`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isBciMode ? (
              <BCIProjectImport 
                csvData={bciData}
                mode={selectedMode as any}
                onImportComplete={resetToSelection}
              />
            ) : (
              <ProjectImport 
                csvData={csvData}
                onImportComplete={resetToSelection}
                onBack={resetToSelection}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
