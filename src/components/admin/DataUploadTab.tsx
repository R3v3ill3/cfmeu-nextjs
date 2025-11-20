"use client"

import React, { useState, type ComponentType } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, Building, FileText, FolderOpen, FileSpreadsheet, Loader2 } from "lucide-react"
import EbaProjectSearch from "@/components/upload/EbaProjectSearch"
import { useUserRole } from "@/hooks/useUserRole"
import EmployersManagement from "@/components/admin/EmployersManagement"
import ProjectsManagement from "@/components/admin/ProjectsManagement"
import BCIXlsxWizard from "@/components/upload/BCIXlsxWizard"
import BCICsvParser from "@/components/upload/BCICsvParser"
import BCIProjectImport from "@/components/upload/BCIProjectImport"
import WorkersManagement from "@/components/admin/WorkersManagement"

type ImportType = "bci" | "employers" | "projects" | "ebas" | "workers"

type ParsedCSV = {
  headers: string[];
  rows: Array<Record<string, any>>;
  filename?: string;
}

interface ImportOption {
  type: ImportType
  title: string
  description: string
  icon: ComponentType<any>
  category: "data"
}

const importOptions: ImportOption[] = [
  {
    type: "bci",
    title: "BCI Imports",
    description: "Import BCI projects and employers via XLSX or CSV",
    icon: FileSpreadsheet,
    category: "data"
  },
  {
    type: "employers",
    title: "Employers",
    description: "Manage employer records, duplicates, and Incolink data",
    icon: Building,
    category: "data"
  },
  {
    type: "projects", 
    title: "Projects",
    description: "Import construction project data from CSV or tools",
    icon: FolderOpen,
    category: "data"
  },
  {
    type: "ebas",
    title: "EBAs",
    description: "Search and manage Enterprise Bargaining Agreement data",
    icon: FileText,
    category: "data"
  },
  {
    type: "workers",
    title: "Workers",
    description: "Import worker and membership data including Incolink integration",
    icon: Users,
    category: "data"
  }
]

export default function DataUploadTab() {
  const { role: userRole, isLoading: roleLoading } = useUserRole()

  const [step, setStep] = useState<"choose" | "import">("choose")
  const [importType, setImportType] = useState<ImportType>("bci")
  // BCI CSV local state
  const [bciCsvRows, setBciCsvRows] = useState<any[]>([])
  const [bciCsvMode, setBciCsvMode] = useState<any>("projects-only")
  const [showBciCsvImport, setShowBciCsvImport] = useState(false)

  // Get available import types based on user role
  const getAvailableImportTypes = (): ImportType[] => {
    if (!userRole) return []
    
    if (userRole === "organiser") {
      return ["workers"]
    } else if (userRole === "lead_organiser" || userRole === "admin") {
      return ["bci", "employers", "projects", "ebas", "workers"]
    }
    
    return []
  }
  
  const availableTypes = getAvailableImportTypes()
  const availableOptions = importOptions.filter(option => availableTypes.includes(option.type))

  const reset = () => {
    setStep("choose")
  }

  if (roleLoading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking data upload permissions…
      </div>
    )
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
        <h2 className="text-xl font-semibold">Data Management</h2>
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
          
          {/* Main Data Management Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {availableOptions.map((option) => {
              const Icon = option.icon
              const isSelected = importType === option.type
              return (
                <Card 
                  key={option.type} 
                  className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-primary shadow-md' : ''}`}
                  onClick={() => {
                    setImportType(option.type)
                    setStep("import")
                  }}
                >
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-center mb-4">
                      <div className="p-4 rounded-full bg-primary/10">
                        <Icon className="h-8 w-8 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-lg text-center">{option.title}</CardTitle>
                    <CardDescription className="text-sm text-center">{option.description}</CardDescription>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Legacy upload and mapping steps removed - all handled in category components */}

      {step === "import" && (
        <div className="space-y-4">
          {importType === "bci" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>BCI Import</CardTitle>
                  <CardDescription>Upload a BCI .xlsx file (recommended), or import BCI CSV with limited modes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <BCIXlsxWizard />
                    <div className="border-t pt-4">
                      <CardTitle className="text-base mb-2">BCI CSV (advanced)</CardTitle>
                      <CardDescription className="mb-3">CSV import supports Projects Only, Employers → Existing Projects, and Quick Match.</CardDescription>
                      <div className="mt-2 space-y-4">
                        {!showBciCsvImport ? (
                          <BCICsvParser
                            onDataParsed={(rows) => { setBciCsvRows(rows); setShowBciCsvImport(true); }}
                            onError={(err) => console.error('BCI CSV error:', err)}
                            onModeChange={(m) => setBciCsvMode(m)}
                            allowedModes={["projects-only", "employers-to-existing", "employers-to-existing-quick-match"] as any}
                          />
                        ) : (
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Process BCI CSV</CardTitle>
                              <CardDescription>Mode: {String(bciCsvMode)}</CardDescription>
                            </CardHeader>
                            <CardContent>
                              <BCIProjectImport
                                csvData={bciCsvRows as any}
                                mode={bciCsvMode}
                                onImportComplete={() => { setShowBciCsvImport(false); setBciCsvRows([]); }}
                              />
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {importType === "employers" && <EmployersManagement />}
          {importType === "projects" && <ProjectsManagement />}
          {importType === "ebas" && <EbaProjectSearch />}
          {importType === "workers" && <WorkersManagement />}
        </div>
      )}
    </div>
  )
}
