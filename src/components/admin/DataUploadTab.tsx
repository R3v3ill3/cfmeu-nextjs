"use client"

import { useMemo, useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import FileUpload from "@/components/upload/FileUpload"
import ColumnMapper from "@/components/upload/ColumnMapper"
import WorkerImport from "@/components/upload/WorkerImport"
import ContractorImport from "@/components/upload/ContractorImport"
import { EbaImport } from "@/components/upload/EbaImport"
import { Button } from "@/components/ui/button"
import PatchImport from "@/components/upload/PatchImport"
import { ArrowLeft, Users, Building, FileText, Map, FolderOpen, Database, UserPlus, RefreshCw, BarChart3, Link } from "lucide-react"
import ProjectImport from "@/components/upload/ProjectImport"
import BCICsvParser from "@/components/upload/BCICsvParser"
import BCIProjectImport from "@/components/upload/BCIProjectImport"
import PendingEmployersImport from "@/components/upload/PendingEmployersImport"
import EbaProjectSearch from "@/components/upload/EbaProjectSearch"
import { useAuth } from "@/hooks/useAuth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { BackfillProjectCoordinates } from "@/components/admin/BackfillProjectCoordinates"
import { EbaBackfillManager } from "@/components/admin/EbaBackfillManager"
import { IncolinkImport } from "@/components/upload/IncolinkImport"

type ImportType = "workers" | "contractors" | "eba" | "patches" | "projects" | "bci-projects" | "project-backfill" | "eba-backfill" | "employers" | "incolink"
type ParsedCSV = { headers: string[]; rows: Record<string, any>[]; filename?: string }

interface ImportOption {
  type: ImportType
  title: string
  description: string
  icon: React.ComponentType<any>
  category: "data" | "backfill"
}

const importOptions: ImportOption[] = [
  {
    type: "workers",
    title: "Import Workers",
    description: "Upload worker data and membership information",
    icon: Users,
    category: "data"
  },
  {
    type: "contractors", 
    title: "Import Contractors",
    description: "Upload contractor and employer information",
    icon: Building,
    category: "data"
  },
  {
    type: "eba",
    title: "Import EBA Data",
    description: "Upload Enterprise Bargaining Agreement data or search existing projects",
    icon: FileText,
    category: "data"
  },
  {
    type: "patches",
    title: "Import Patches",
    description: "Upload patch boundary and geographic data",
    icon: Map,
    category: "data"
  },
  {
    type: "projects",
    title: "Import Projects", 
    description: "Upload construction project information",
    icon: FolderOpen,
    category: "data"
  },
  {
    type: "bci-projects",
    title: "Import BCI Projects",
    description: "Upload Building and Construction Industry project data",
    icon: Database,
    category: "data"
  },
  {
    type: "employers",
    title: "Import Employers",
    description: "Import pending employer records for processing",
    icon: UserPlus,
    category: "data"
  },
  {
    type: "incolink",
    title: "Import Incolink Data",
    description: "Upload Incolink employer data with fuzzy name matching",
    icon: Link,
    category: "data"
  },
  {
    type: "project-backfill",
    title: "Project Backfill",
    description: "Backfill missing coordinates and geocoding data for projects",
    icon: RefreshCw,
    category: "backfill"
  },
  {
    type: "eba-backfill",
    title: "EBA Backfill",
    description: "Search and backfill Enterprise Bargaining Agreements for employers",
    icon: BarChart3,
    category: "backfill"
  }
]

export default function DataUploadTab() {
  const { user } = useAuth()
  const [userRole, setUserRole] = useState<string | null>(null)
  const params = useSearchParams()
  const employerId = params.get("employerId")
  const employerName = params.get("employerName")
  const supabase = getSupabaseBrowserClient()

  const [step, setStep] = useState<"choose" | "upload" | "map" | "import">("choose")
  const [importType, setImportType] = useState<ImportType>("workers")
  const [csv, setCsv] = useState<ParsedCSV | null>(null)
  const [mappedRows, setMappedRows] = useState<Record<string, any>[]>([])
  const [bciData, setBciData] = useState<any[]>([])
  const [bciMode, setBciMode] = useState<'projects-and-employers' | 'projects-only' | 'employers-to-existing' | 'employers-to-existing-quick-match'>('projects-and-employers')

  // Get user role on component mount
  useEffect(() => {
    const checkUserRole = async () => {
      if (!user) return
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        setUserRole((profile as { role?: string } | null)?.role || null)
      } catch (error) {
        console.error("Error fetching user role:", error)
      }
    }
    checkUserRole()
  }, [user, supabase])

  // Get available import types based on user role
  const getAvailableImportTypes = (): ImportType[] => {
    if (!userRole) return []
    
    if (userRole === "organiser") {
      return ["workers"]
    } else if (userRole === "lead_organiser" || userRole === "admin") {
      return ["workers", "contractors", "eba", "patches", "projects", "bci-projects", "employers", "incolink", "project-backfill", "eba-backfill"]
    }
    
    return []
  }
  
  const availableTypes = getAvailableImportTypes()
  const availableOptions = importOptions.filter(option => availableTypes.includes(option.type))

  const selectedEmployer = useMemo(() => {
    if (employerId && employerName) return { id: employerId, name: employerName }
    return undefined
  }, [employerId, employerName])

  const onFileUploaded = (parsed: ParsedCSV) => {
    setCsv(parsed)
    setStep("map")
  }

  const onBciDataParsed = (data: any[]) => {
    setBciData(data)
    setStep("import")
  }

  const onMappingComplete = (table: string, mappings: any[]) => {
    if (!csv) return
    // Simple projection using mapped columns
    const output = csv.rows.map((row) => {
      const out: Record<string, any> = {}
      mappings.forEach((m: any) => {
        if (m.action !== 'skip' && m.dbColumn) {
          out[m.dbColumn] = row[m.csvColumn]
        }
      })
      return out
    })
    setMappedRows(output)
    setStep("import")
  }

  const reset = () => {
    setStep("choose")
    setCsv(null)
    setMappedRows([])
    setBciData([])
  }

  const startImport = (type: ImportType) => {
    setImportType(type)
    // Backfill types go straight to their interface, others need file upload
    if (type === "project-backfill" || type === "eba-backfill") {
      setStep("import")
    } else {
      setStep("upload")
    }
  }

  // Don't render anything if user has no upload access
  if (availableTypes.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-gray-600 mt-2">
            You don't have permission to access the data upload functionality.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Data Upload</h2>
        {step !== "choose" && (
          <Button variant="outline" onClick={reset}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Selection
          </Button>
        )}
      </div>

      {step === "choose" && (
        <div className="space-y-6">
          {userRole === "organiser" && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> As an organiser, you have access to worker data import only. 
                Contact a lead organiser or admin for additional import capabilities.
              </p>
            </div>
          )}
          
          {/* Data Import Cards */}
          <div>
            <h3 className="text-lg font-medium mb-4">Data Import</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableOptions
                .filter(option => option.category === "data")
                .map((option) => {
                  const Icon = option.icon
                  return (
                    <Card 
                      key={option.type} 
                      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                      onClick={() => startImport(option.type)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <CardTitle className="text-base">{option.title}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="text-sm">
                          {option.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </div>

          {/* Backfill Cards */}
          {availableOptions.some(option => option.category === "backfill") && (
            <div>
              <h3 className="text-lg font-medium mb-4">Data Backfill & Maintenance</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableOptions
                  .filter(option => option.category === "backfill")
                  .map((option) => {
                    const Icon = option.icon
                    return (
                      <Card 
                        key={option.type} 
                        className="cursor-pointer transition-all hover:shadow-md hover:border-orange-500/50"
                        onClick={() => startImport(option.type)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-orange-100">
                              <Icon className="h-5 w-5 text-orange-600" />
                            </div>
                            <CardTitle className="text-base">{option.title}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-sm">
                            {option.description}
                          </CardDescription>
                        </CardContent>
                      </Card>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle>
              {importOptions.find(opt => opt.type === importType)?.title || 'Upload Data'}
            </CardTitle>
            <CardDescription>
              {importType === "eba" 
                ? "Upload CSV files with EBA data or search for existing project employers" 
                : `Select and upload your ${importType} CSV file to continue`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {importType === "eba" ? (
              <Tabs defaultValue="upload" className="w-full">
                <TabsList>
                  <TabsTrigger value="upload">Upload EBA CSV</TabsTrigger>
                  <TabsTrigger value="search">Search Project Employers</TabsTrigger>
                </TabsList>
                
                <TabsContent value="upload" className="mt-4">
                  <FileUpload onFileUploaded={onFileUploaded} />
                </TabsContent>
                
                <TabsContent value="search" className="mt-4">
                  <EbaProjectSearch />
                </TabsContent>
              </Tabs>
            ) : importType === "bci-projects" ? (
              <BCICsvParser 
                onDataParsed={onBciDataParsed}
                onError={(error) => console.error('BCI Parse Error:', error)}
                onModeChange={(m) => setBciMode(m)}
              />
            ) : importType === "employers" ? (
              <PendingEmployersImport />
            ) : (
              <FileUpload onFileUploaded={onFileUploaded} />
            )}
          </CardContent>
        </Card>
      )}

      {step === "map" && csv && (
        <ColumnMapper
          parsedCSV={csv}
          onBack={() => setStep("choose")}
          onMappingComplete={onMappingComplete}
        />
      )}

      {step === "import" && (
        <div className="space-y-4">
          {/* Backfill components render directly without cards */}
          {importType === "project-backfill" && (
            <BackfillProjectCoordinates />
          )}
          {importType === "eba-backfill" && (
            <EbaBackfillManager />
          )}
          
          {/* Regular import processes use cards */}
          {importType !== "project-backfill" && importType !== "eba-backfill" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {importOptions.find(opt => opt.type === importType)?.title || 'Import Data'}
                </CardTitle>
                <CardDescription>
                  Review and process your {importType} data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {importType === "workers" && csv && (
                  <WorkerImport
                    csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                    selectedEmployer={selectedEmployer}
                    onImportComplete={() => setStep("choose")}
                    onBack={() => setStep("map")}
                  />
                )}
                {importType === "contractors" && csv && (
                  <ContractorImport
                    csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                    onImportComplete={() => setStep("choose")}
                    onBack={() => setStep("map")}
                  />
                )}
                {importType === "eba" && csv && (
                  <EbaImport
                    csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                    onImportComplete={() => setStep("choose")}
                    onBack={() => setStep("map")}
                  />
                )}
                {importType === "patches" && csv && (
                  <PatchImport
                    csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                    onImportComplete={() => setStep("choose")}
                    onBack={() => setStep("map")}
                  />
                )}
                {importType === "projects" && csv && (
                  <ProjectImport
                    csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                    onImportComplete={() => setStep("choose")}
                    onBack={() => setStep("map")}
                  />
                )}
                {importType === "bci-projects" && bciData.length > 0 && (
                  <BCIProjectImport
                    csvData={bciData}
                    mode={bciMode}
                    onImportComplete={() => setStep("choose")}
                  />
                )}
                {importType === "incolink" && csv && (
                  <IncolinkImport
                    csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                    onImportComplete={() => setStep("choose")}
                    onBack={() => setStep("map")}
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
