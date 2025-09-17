'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building, UserPlus, RefreshCw, UserX, Link, Database } from 'lucide-react'
import BCIProjectImport from '@/components/upload/BCIProjectImport'
import PendingEmployersImport from '@/components/upload/PendingEmployersImport'
import ContractorImport from '@/components/upload/ContractorImport'
import { BackfillProjectCoordinates } from '@/components/admin/BackfillProjectCoordinates'
import DuplicateEmployerManager from '@/components/admin/DuplicateEmployerManager'
import { IncolinkImport } from '@/components/upload/IncolinkImport'
import FileUpload from '@/components/upload/FileUpload'

type EmployerImportMode = 'bci-employers' | 'pending-employers' | 'csv-upload' | 'project-backfill' | 'duplicates' | 'incolink'

interface EmployerOption {
  mode: EmployerImportMode
  title: string
  description: string
  icon: React.ComponentType<any>
  requiresUpload?: boolean
}

const employerOptions: EmployerOption[] = [
  {
    mode: 'bci-employers',
    title: 'BCI Project Employers',
    description: 'Import employers from BCI project data to existing projects',
    icon: Database,
    requiresUpload: false
  },
  {
    mode: 'pending-employers',
    title: 'Import Pending Employers',
    description: 'Process and import pending employer records',
    icon: UserPlus,
    requiresUpload: false
  },
  {
    mode: 'csv-upload',
    title: 'Employer CSV Upload',
    description: 'Upload contractor and employer information from CSV files',
    icon: Building,
    requiresUpload: true
  },
  {
    mode: 'project-backfill',
    title: 'Project Backfill',
    description: 'Backfill missing coordinates and geocoding data for projects',
    icon: RefreshCw,
    requiresUpload: false
  },
  {
    mode: 'duplicates',
    title: 'Duplicate Employers',
    description: 'Find and merge duplicate employer records in the database',
    icon: UserX,
    requiresUpload: false
  },
  {
    mode: 'incolink',
    title: 'Import Incolink Data',
    description: 'Upload Incolink data or scrape from existing employers with Incolink IDs',
    icon: Link,
    requiresUpload: false // Can be either upload or web scraping
  }
]

export default function EmployersManagement() {
  const [selectedMode, setSelectedMode] = useState<EmployerImportMode>('pending-employers')
  const [csvData, setCsvData] = useState<any[]>([])

  const handleFileUploaded = (data: { headers: string[]; rows: Record<string, any>[]; filename?: string }) => {
    setCsvData(data.rows)
  }

  const resetToSelection = () => {
    setSelectedMode('pending-employers')
    setCsvData([])
  }

  const selectedOption = employerOptions.find(opt => opt.mode === selectedMode)

  return (
    <div className="space-y-6">
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold mb-2">Employer Management</h2>
        <p className="text-gray-600">Manage employer records, imports, duplicates, and data backfill operations</p>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {employerOptions.map((option) => {
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

      {/* Selected Mode Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            {selectedOption && <selectedOption.icon className="h-5 w-5 mr-2" />}
            {selectedOption?.title || 'Employer Management'}
          </CardTitle>
          <CardDescription>{selectedOption?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {selectedMode === 'bci-employers' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Import employers from BCI project data to link with existing projects.
              </p>
              <BCIProjectImport 
                csvData={[]}
                mode="employers-to-existing"
                onImportComplete={resetToSelection}
              />
            </div>
          )}

          {selectedMode === 'pending-employers' && (
            <div className="space-y-4">
              <PendingEmployersImport />
            </div>
          )}

          {selectedMode === 'csv-upload' && (
            <div className="space-y-4">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList>
                  <TabsTrigger value="upload">Upload CSV</TabsTrigger>
                  {csvData.length > 0 && <TabsTrigger value="import">Process Import</TabsTrigger>}
                </TabsList>
                
                <TabsContent value="upload" className="mt-4">
                  <FileUpload onFileUploaded={handleFileUploaded} />
                </TabsContent>
                
                {csvData.length > 0 && (
                  <TabsContent value="import" className="mt-4">
                    <ContractorImport 
                      csvData={csvData}
                      onImportComplete={resetToSelection}
                      onBack={() => setCsvData([])}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}

          {selectedMode === 'project-backfill' && (
            <div className="space-y-4">
              <BackfillProjectCoordinates />
            </div>
          )}

          {selectedMode === 'duplicates' && (
            <div className="space-y-4">
              <DuplicateEmployerManager />
            </div>
          )}

          {selectedMode === 'incolink' && (
            <div className="space-y-4">
              <Tabs defaultValue="upload" className="w-full">
                <TabsList>
                  <TabsTrigger value="upload">Upload CSV</TabsTrigger>
                  <TabsTrigger value="scrape">Web Scraping</TabsTrigger>
                  {csvData.length > 0 && <TabsTrigger value="import">Process Import</TabsTrigger>}
                </TabsList>
                
                <TabsContent value="upload" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Upload an Incolink CSV file containing employer data.
                    </p>
                    <FileUpload onFileUploaded={handleFileUploaded} />
                  </div>
                </TabsContent>
                
                <TabsContent value="scrape" className="mt-4">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Select an employer with an Incolink ID to scrape their data automatically.
                    </p>
                    <div className="p-4 border rounded-lg bg-blue-50">
                      <p className="text-sm">🚧 Incolink web scraping feature coming soon</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        This will allow automatic data collection from employers with existing Incolink IDs
                      </p>
                    </div>
                  </div>
                </TabsContent>
                
                {csvData.length > 0 && (
                  <TabsContent value="import" className="mt-4">
                    <IncolinkImport 
                      csvData={csvData}
                      onImportComplete={resetToSelection}
                      onBack={() => setCsvData([])}
                    />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
