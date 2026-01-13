"use client"

import { useState, useMemo } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle,
  CheckCircle2
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WizardButton } from '../shared/WizardButton'
import { GoogleAddressInput, type GoogleAddress, type AddressValidationError } from '@/components/projects/GoogleAddressInput'
import { SingleEmployerDialogPicker } from '@/components/projects/SingleEmployerDialogPicker'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { SelectedProject } from '../hooks/useWizardState'

interface MobileManualProjectFormProps {
  onComplete: (project: SelectedProject) => void
  onBack: () => void
}

interface FormErrors {
  name?: string
  address?: string
  value?: string
  general?: string
}

export function MobileManualProjectForm({
  onComplete,
  onBack,
}: MobileManualProjectFormProps) {
  const queryClient = useQueryClient()
  
  // Form state
  const [name, setName] = useState('')
  const [addressData, setAddressData] = useState<GoogleAddress | null>(null)
  const [addressValidationError, setAddressValidationError] = useState<AddressValidationError | null>(null)
  const [value, setValue] = useState('')
  const [builderId, setBuilderId] = useState<string>('')
  const [builderName, setBuilderName] = useState<string>('')
  
  // Error state
  const [errors, setErrors] = useState<FormErrors>({})
  const [showSuccess, setShowSuccess] = useState(false)

  // Validation
  const canSubmit = useMemo(() => {
    return name.trim() &&
           addressData?.formatted &&
           !addressValidationError &&
           addressData?.place_id
  }, [name, addressData, addressValidationError])

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}
    
    if (!name.trim()) {
      newErrors.name = 'Project name is required'
    }
    
    if (!addressData?.formatted || !addressData?.place_id) {
      newErrors.address = 'Please select an address from the dropdown'
    }
    
    if (addressValidationError) {
      newErrors.address = addressValidationError.message
    }
    
    if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
      newErrors.value = 'Please enter a valid positive number'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const supabase = getSupabaseBrowserClient()
      
      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: name.trim(),
          value: value ? parseFloat(value) : null,
          builder_id: builderId || null,
        } as Record<string, unknown>)
        .select('id')
        .single()
      
      if (projectError) throw projectError
      
      // Create job site with address
      const { data: site, error: siteError } = await supabase
        .from('job_sites')
        .insert({
          name: name.trim(),
          project_id: project.id,
          location: addressData?.formatted,
          full_address: addressData?.formatted,
          is_main_site: true,
          latitude: addressData?.lat,
          longitude: addressData?.lng,
          place_id: addressData?.place_id,
        } as Record<string, unknown>)
        .select('id')
        .single()
      
      if (siteError) {
        console.warn('[MobileManualProjectForm] Job site creation warning:', siteError)
      }
      
      // Link job site to project
      if (site) {
        await supabase
          .from('projects')
          .update({ main_job_site_id: site.id } as Record<string, unknown>)
          .eq('id', project.id)
      }
      
      return {
        id: project.id,
        name: name.trim(),
        address: addressData?.formatted || null,
        builderName: builderName || null,
        mainJobSiteId: site?.id || null,
      }
    },
    onSuccess: (data) => {
      setShowSuccess(true)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      
      // Brief delay to show success, then continue
      setTimeout(() => {
        onComplete(data)
      }, 1000)
    },
    onError: (error: Error) => {
      console.error('[MobileManualProjectForm] Error:', error)
      setErrors({
        general: error.message || 'Failed to create project. Please try again.',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    createMutation.mutate()
  }

  return (
    <div className="p-4 pb-safe-bottom">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Create Project</h1>
          <p className="text-gray-600">
            Enter the project details below
          </p>
        </div>

        {/* Error Alert */}
        {errors.general && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.general}</AlertDescription>
          </Alert>
        )}

        {/* Success Alert */}
        {showSuccess && (
          <Alert className="border-green-500 bg-green-50 text-green-900">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>Project created! Continuing...</AlertDescription>
          </Alert>
        )}

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-sm font-medium text-gray-700">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                clearFieldError('name')
              }}
              placeholder="Enter project name"
              className={`h-14 text-base ${errors.name ? 'border-red-500' : ''}`}
              disabled={createMutation.isPending}
            />
            {errors.name && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Project Address <span className="text-red-500">*</span>
            </Label>
            <GoogleAddressInput
              value={addressData?.formatted || ''}
              onChange={(addr, error) => {
                setAddressData(addr)
                setAddressValidationError(error || null)
                clearFieldError('address')
              }}
              placeholder="Start typing an address..."
              required={true}
              requireSelection={true}
              onValidationChange={setAddressValidationError}
            />
            {errors.address && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.address}
              </p>
            )}
          </div>

          {/* Project Value */}
          <div className="space-y-2">
            <Label htmlFor="project-value" className="text-sm font-medium text-gray-700">
              Project Value (AUD)
            </Label>
            <Input
              id="project-value"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                clearFieldError('value')
              }}
              placeholder="0.00"
              className={`h-14 text-base ${errors.value ? 'border-red-500' : ''}`}
              disabled={createMutation.isPending}
            />
            {errors.value && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.value}
              </p>
            )}
          </div>

          {/* Builder */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-gray-700">
              Builder
            </Label>
            <SingleEmployerDialogPicker
              selectedId={builderId}
              onSelect={(id, name) => {
                setBuilderId(id)
                setBuilderName(name)
              }}
              disabled={createMutation.isPending}
              placeholder="Select builder (optional)"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <WizardButton
            type="submit"
            variant="primary"
            disabled={!canSubmit || createMutation.isPending}
            className="w-full"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </WizardButton>

          <WizardButton
            type="button"
            variant="secondary"
            onClick={onBack}
            disabled={createMutation.isPending}
            className="w-full"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back
          </WizardButton>
        </div>
      </form>
    </div>
  )
}
