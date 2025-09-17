"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Users, Building, FileText, FolderOpen } from "lucide-react"
import EbaProjectSearch from "@/components/upload/EbaProjectSearch"
import { useAuth } from "@/hooks/useAuth"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import EmployersManagement from "@/components/admin/EmployersManagement"
import ProjectsManagement from "@/components/admin/ProjectsManagement"
import WorkersManagement from "@/components/admin/WorkersManagement"

type ImportType = "employers" | "projects" | "ebas" | "workers"

interface ImportOption {
  type: ImportType
  title: string
  description: string
  icon: React.ComponentType<any>
  category: "data"
}

const importOptions: ImportOption[] = [
  {
    type: "employers",
    title: "Employers",
    description: "Manage employer records, BCI imports, duplicates, and Incolink data",
    icon: Building,
    category: "data"
  },
  {
    type: "projects", 
    title: "Projects",
    description: "Import construction project data from various sources including BCI",
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
  const { user } = useAuth()
  const [userRole, setUserRole] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  const [step, setStep] = useState<"choose" | "import">("choose")
  const [importType, setImportType] = useState<ImportType>("employers")

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
      return ["employers", "projects", "ebas", "workers"]
    }
    
    return []
  }
  
  const availableTypes = getAvailableImportTypes()
  const availableOptions = importOptions.filter(option => availableTypes.includes(option.type))

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
    // All main categories go straight to their interface
    setStep("import")
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
          {importType === "employers" && <EmployersManagement />}
          {importType === "projects" && <ProjectsManagement />}
          {importType === "ebas" && <EbaProjectSearch />}
          {importType === "workers" && <WorkersManagement />}
        </div>
      )}
    </div>
  )
}
