"use client"
export const dynamic = 'force-dynamic'

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
import { ArrowLeft } from "lucide-react"
import ProjectImport from "@/components/upload/ProjectImport"
import BCICsvParser from "@/components/upload/BCICsvParser"
import BCIProjectImport from "@/components/upload/BCIProjectImport"
import PendingEmployersImport from "@/components/upload/PendingEmployersImport"
import EbaProjectSearch from "@/components/upload/EbaProjectSearch"
import { useAuth } from "@/hooks/useAuth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export default function UploadPage() {
  const { user } = useAuth()
  const [userRole, setUserRole] = useState<string | null>(null)
  const params = useSearchParams()
  const employerId = params.get("employerId")
  const employerName = params.get("employerName")
  const supabase = getSupabaseBrowserClient()

  type ParsedCSV = { headers: string[]; rows: Record<string, any>[]; filename?: string }
  const [step, setStep] = useState<"choose" | "upload" | "map" | "import">("choose")
  const [importType, setImportType] = useState<"workers" | "contractors" | "eba" | "patches" | "projects" | "bci-projects">("workers")
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
  const getAvailableImportTypes = () => {
    if (!userRole) return []
    
    if (userRole === "organiser") {
      return ["workers"]
    } else if (userRole === "lead_organiser" || userRole === "admin") {
      return ["workers", "contractors", "eba", "patches", "projects", "bci-projects", "employers"]
    }
    
    return []
  }
  
  const availableTypes = getAvailableImportTypes()
  
  // Filter import type if current selection is not available
  useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(importType)) {
      setImportType(availableTypes[0] as any)
    }
  }, [availableTypes, importType])

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

  // Don't render anything if user has no upload access
  if (availableTypes.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Access Denied</h1>
          <p className="text-gray-600 mt-2">
            You don't have permission to access the data upload functionality.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Upload Data</h1>
        {step !== "choose" && (
          <Button variant="outline" onClick={reset}>
            <ArrowLeft className="h-4 w-4 mr-2" />Start over
          </Button>
        )}
      </div>

      {step === "choose" && (
        <Card>
          <CardHeader>
            <CardTitle>Select import type</CardTitle>
            {userRole === "organiser" && (
              <p className="text-sm text-gray-600">
                As an organiser, you can only import worker data.
              </p>
            )}
          </CardHeader>
          <CardContent>
            <Tabs value={importType} onValueChange={(v: string) => setImportType(v as any)}>
              <TabsList>
                {availableTypes.map(type => (
                  <TabsTrigger key={type} value={type}>
                    {type === "bci-projects" ? "BCI Projects" : 
                     type.charAt(0).toUpperCase() + type.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {/* Render only available tab content */}
              {availableTypes.includes("workers") && (
                <TabsContent value="workers">
                  <FileUpload onFileUploaded={onFileUploaded} />
                </TabsContent>
              )}
              
              {availableTypes.includes("contractors") && (
                <TabsContent value="contractors">
                  <FileUpload onFileUploaded={onFileUploaded} />
                </TabsContent>
              )}
              
              {availableTypes.includes("eba") && (
                <TabsContent value="eba">
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>EBA Data Import</CardTitle>
                        <CardDescription>
                          Upload CSV files with EBA data or search for existing project employers
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
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
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              )}
              
              {availableTypes.includes("patches") && (
                <TabsContent value="patches">
                  <FileUpload onFileUploaded={onFileUploaded} />
                </TabsContent>
              )}
              
              {availableTypes.includes("projects") && (
                <TabsContent value="projects">
                  <FileUpload onFileUploaded={onFileUploaded} />
                </TabsContent>
              )}
              
              {availableTypes.includes("bci-projects") && (
                <TabsContent value="bci-projects">
                  <BCICsvParser 
                    onDataParsed={onBciDataParsed}
                    onError={(error) => console.error('BCI Parse Error:', error)}
                    onModeChange={(m) => setBciMode(m)}
                  />
                </TabsContent>
              )}
              
              {availableTypes.includes("employers") && (
                <TabsContent value="employers">
                  <PendingEmployersImport />
                </TabsContent>
              )}
            </Tabs>
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
        <Card>
          <CardHeader>
            <CardTitle>Import data</CardTitle>
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}

