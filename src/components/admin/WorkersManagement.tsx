'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Users, Link } from 'lucide-react'
import WorkerImport from '@/components/upload/WorkerImport'
import { IncolinkImport } from '@/components/upload/IncolinkImport'
import IncolinkScrape from '@/components/upload/IncolinkScrape'
import FileUpload from '@/components/upload/FileUpload'
import { IncolinkCredentialsCard } from '@/components/admin/IncolinkCredentialsCard'

type WorkerImportMode = 'standard' | 'incolink'

interface WorkerOption {
  mode: WorkerImportMode
  title: string
  description: string
  icon: React.ComponentType<any>
}

const workerOptions: WorkerOption[] = [
  {
    mode: 'standard',
    title: 'Standard Worker Import',
    description: 'Upload worker data and membership information from CSV files',
    icon: Users
  },
  {
    mode: 'incolink',
    title: 'Incolink Worker Data',
    description: 'Import Incolink worker data via CSV upload or web scraping',
    icon: Link
  }
]

export default function WorkersManagement() {
  const [selectedMode, setSelectedMode] = useState<WorkerImportMode>('standard')
  const [csvData, setCsvData] = useState<any[]>([])
  const [showImport, setShowImport] = useState(false)

  const handleFileUploaded = (data: { headers: string[]; rows: Record<string, any>[]; filename?: string }) => {
    setCsvData(data.rows)
    setShowImport(true)
  }

  const resetToSelection = () => {
    setSelectedMode('standard')
    setCsvData([])
    setShowImport(false)
  }

  const selectedOption = workerOptions.find(opt => opt.mode === selectedMode)

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-2">Worker Management</h2>
        <p className="text-gray-600">Import worker and membership data including Incolink integration</p>
      </div>

      {!showImport ? (
        <div className="space-y-6">
          {/* Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workerOptions.map((option) => {
              const Icon = option.icon
              const isSelected = selectedMode === option.mode
              return (
                <Card 
                  key={option.mode} 
                  className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary shadow-md' : ''}`}
                  onClick={() => setSelectedMode(option.mode)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center">
                        <Icon className="h-4 w-4 mr-2" />
                        {option.title}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-sm">{option.description}</CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>

          {/* Upload Interface */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                {selectedOption && <selectedOption.icon className="h-5 w-5 mr-2" />}
                {selectedOption?.title || 'Worker Import'}
              </CardTitle>
              <CardDescription>{selectedOption?.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedMode === 'standard' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Upload a CSV file containing worker information including names, contact details, 
                    membership status, and union-related data.
                  </p>
                  <FileUpload onFileUploaded={handleFileUploaded} />
                </div>
              )}

              {selectedMode === 'incolink' && (
                <div className="space-y-6">
                  <IncolinkCredentialsCard />
                  <Tabs defaultValue="upload" className="w-full">
                    <TabsList>
                      <TabsTrigger value="upload">Upload CSV</TabsTrigger>
                      <TabsTrigger value="scrape">Web Scraping</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upload" className="mt-4">
                      <div className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          Upload an Incolink CSV file containing worker data including employment history, 
                          payment information, and project assignments.
                        </p>
                        <FileUpload onFileUploaded={handleFileUploaded} />
                      </div>
                    </TabsContent>
                    
                    <TabsContent value="scrape" className="mt-4 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Ensure your credentials are saved before running a scrape. The job will use the stored login and respect per-user limits.
                      </p>
                      <IncolinkScrape />
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Import Processing */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              {selectedOption && <selectedOption.icon className="h-5 w-5 mr-2" />}
              {selectedMode === 'standard' ? 'Worker Import' : 'Incolink Worker Import'}
            </CardTitle>
            <CardDescription>
              Processing {csvData.length} worker records
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedMode === 'standard' ? (
              <WorkerImport 
                csvData={csvData}
                onImportComplete={resetToSelection}
                onBack={resetToSelection}
              />
            ) : (
              <IncolinkImport 
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
