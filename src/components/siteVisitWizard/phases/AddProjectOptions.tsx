"use client"

import { FileSpreadsheet, Edit, ArrowLeft } from 'lucide-react'
import { WizardButton } from '../shared/WizardButton'

interface AddProjectOptionsProps {
  onSelectBCIImport: () => void
  onSelectManualCreate: () => void
  onBack: () => void
}

export function AddProjectOptions({
  onSelectBCIImport,
  onSelectManualCreate,
  onBack,
}: AddProjectOptionsProps) {
  return (
    <div className="p-4 space-y-6 pb-safe-bottom">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Add New Project</h1>
        <p className="text-gray-600">
          Choose how you&apos;d like to add the project
        </p>
      </div>

      {/* Options */}
      <div className="space-y-4">
        {/* BCI Import Option */}
        <button
          type="button"
          onClick={onSelectBCIImport}
          className="w-full flex items-start gap-4 p-5 bg-white border-2 border-gray-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 active:bg-blue-100 transition-all touch-manipulation text-left"
        >
          <div className="flex-shrink-0 w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center">
            <FileSpreadsheet className="h-7 w-7 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">
              Import from BCI
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Export project data from BCI Central and upload the Excel file
            </p>
          </div>
        </button>

        {/* Manual Create Option */}
        <button
          type="button"
          onClick={onSelectManualCreate}
          className="w-full flex items-start gap-4 p-5 bg-white border-2 border-gray-200 rounded-2xl hover:border-green-400 hover:bg-green-50/50 active:bg-green-100 transition-all touch-manipulation text-left"
        >
          <div className="flex-shrink-0 w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center">
            <Edit className="h-7 w-7 text-green-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">
              Create Manually
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Enter project details manually using a simple form
            </p>
          </div>
        </button>
      </div>

      {/* Back Button */}
      <div className="pt-4">
        <WizardButton
          variant="secondary"
          onClick={onBack}
          className="w-full"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Search
        </WizardButton>
      </div>
    </div>
  )
}
