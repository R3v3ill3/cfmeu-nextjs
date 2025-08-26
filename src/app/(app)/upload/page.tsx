"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

export default function UploadPage() {
  const params = useSearchParams()
  const employerId = params.get("employerId")
  const employerName = params.get("employerName")

  type ParsedCSV = { headers: string[]; rows: Record<string, any>[]; filename?: string }
  const [step, setStep] = useState<"choose" | "upload" | "map" | "import">("choose")
  const [importType, setImportType] = useState<"workers" | "contractors" | "eba" | "patches" | "projects">("workers")
  const [csv, setCsv] = useState<ParsedCSV | null>(null)
  const [mappedRows, setMappedRows] = useState<Record<string, any>[]>([])

  const selectedEmployer = useMemo(() => {
    if (employerId && employerName) return { id: employerId, name: employerName }
    return undefined
  }, [employerId, employerName])

  const onFileUploaded = (parsed: ParsedCSV) => {
    setCsv(parsed)
    setStep("map")
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
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Upload Data</h1>
        {step !== "choose" && (
          <Button variant="outline" onClick={reset}><ArrowLeft className="h-4 w-4 mr-2" />Start over</Button>
        )}
      </div>

      {step === "choose" && (
        <Card>
          <CardHeader>
            <CardTitle>Select import type</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={importType} onValueChange={(v: string) => setImportType(v as any)}>
              <TabsList>
                <TabsTrigger value="workers">Workers</TabsTrigger>
                <TabsTrigger value="contractors">Contractors</TabsTrigger>
                <TabsTrigger value="eba">EBA</TabsTrigger>
                <TabsTrigger value="patches">Patches</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
              </TabsList>
              <TabsContent value="workers">
                <FileUpload onFileUploaded={onFileUploaded} />
              </TabsContent>
              <TabsContent value="contractors">
                <FileUpload onFileUploaded={onFileUploaded} />
              </TabsContent>
              <TabsContent value="eba">
                <FileUpload onFileUploaded={onFileUploaded} />
              </TabsContent>
              <TabsContent value="patches">
                <FileUpload onFileUploaded={onFileUploaded} />
              </TabsContent>
              <TabsContent value="projects">
                <FileUpload onFileUploaded={onFileUploaded} />
              </TabsContent>
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

      {step === "import" && csv && (
        <Card>
          <CardHeader>
            <CardTitle>Import Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {importType === "workers" && (
              <WorkerImport
                csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                selectedEmployer={selectedEmployer}
                onImportComplete={() => setStep("choose")}
                onBack={() => setStep("map")}
              />
            )}
            {importType === "contractors" && (
              <ContractorImport
                csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                onImportComplete={() => setStep("choose")}
                onBack={() => setStep("map")}
              />
            )}
            {importType === "eba" && (
              <EbaImport
                csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                onImportComplete={() => setStep("choose")}
                onBack={() => setStep("map")}
              />
            )}
            {importType === "patches" && (
              <PatchImport
                csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                onImportComplete={() => setStep("choose")}
                onBack={() => setStep("map")}
              />
            )}
            {importType === "projects" && (
              <ProjectImport
                csvData={mappedRows.length > 0 ? mappedRows : csv.rows}
                onImportComplete={() => setStep("choose")}
                onBack={() => setStep("map")}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

