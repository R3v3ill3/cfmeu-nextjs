"use client"

import { useState } from 'react'
import { 
  ArrowLeft, 
  Building, 
  MapPin, 
  DollarSign,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { WizardButton } from '../shared/WizardButton'
import { cn } from '@/lib/utils'
import type { BCINormalizedProject } from '../hooks/useWizardState'

interface BCIProjectSelectorProps {
  projects: BCINormalizedProject[]
  onSelectProject: (projectId: string) => void
  onBack: () => void
}

function formatValue(value?: number): string {
  if (!value) return ''
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`
  }
  return `$${value.toLocaleString()}`
}

function formatAddress(project: BCINormalizedProject): string | null {
  const parts = [
    project.projectAddress,
    project.projectTown,
    project.projectState,
    project.postCode,
  ].filter(Boolean)
  
  return parts.length > 0 ? parts.join(', ') : null
}

export function BCIProjectSelector({
  projects,
  onSelectProject,
  onBack,
}: BCIProjectSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    // Auto-select if only one project
    projects.length === 1 ? projects[0].projectId : null
  )

  const handleConfirm = () => {
    if (selectedId) {
      onSelectProject(selectedId)
    }
  }

  return (
    <div className="p-4 space-y-6 pb-safe-bottom">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Select Project</h1>
        <p className="text-gray-600">
          {projects.length === 1
            ? 'Confirm this is the project you want to import'
            : `Found ${projects.length} projects in the file. Select one to import.`}
        </p>
      </div>

      {/* Info Banner for multiple projects */}
      {projects.length > 1 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            You can only import one project at a time. Select the project you&apos;re visiting.
          </p>
        </div>
      )}

      {/* Project List */}
      <div className="space-y-3">
        {projects.map((project) => {
          const isSelected = selectedId === project.projectId
          const address = formatAddress(project)
          const value = formatValue(project.localValue)
          
          return (
            <button
              key={project.projectId}
              type="button"
              onClick={() => setSelectedId(project.projectId)}
              className={cn(
                "w-full text-left p-4 rounded-2xl border-2 transition-all touch-manipulation",
                isSelected
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300 active:bg-gray-50"
              )}
            >
              <div className="flex items-start gap-3">
                {/* Selection indicator */}
                <div className={cn(
                  "flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5",
                  isSelected
                    ? "border-blue-500 bg-blue-500"
                    : "border-gray-300 bg-white"
                )}>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  )}
                </div>
                
                {/* Project info */}
                <div className="flex-1 min-w-0 space-y-2">
                  <h3 className={cn(
                    "font-semibold text-base",
                    isSelected ? "text-blue-900" : "text-gray-900"
                  )}>
                    {project.projectName || `Project ${project.projectId}`}
                  </h3>
                  
                  {address && (
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{address}</span>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-3 text-sm">
                    {project.projectStage && (
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                        project.projectStage.toLowerCase().includes('construction')
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-700"
                      )}>
                        <Building className="h-3 w-3" />
                        {project.projectStage}
                      </span>
                    )}
                    
                    {value && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        <DollarSign className="h-3 w-3" />
                        {value}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div className="space-y-3 pt-2">
        <WizardButton
          variant="primary"
          onClick={handleConfirm}
          disabled={!selectedId}
          className="w-full"
        >
          Import Selected Project
        </WizardButton>
        
        <WizardButton
          variant="secondary"
          onClick={onBack}
          className="w-full"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Upload Different File
        </WizardButton>
      </div>
    </div>
  )
}
