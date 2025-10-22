"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertCircle, TrendingUp, TrendingDown, Minus, Search, FileSearch, Building2 } from 'lucide-react'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { EmployerMatchDialog } from './EmployerMatchDialog'
import { FwcEbaSearchModal } from '@/components/employers/FwcEbaSearchModal'
import { supabase } from '@/integrations/supabase/client'
import DateInput from '@/components/ui/date-input'
import { GoogleAddressInput, GoogleAddress } from '@/components/projects/GoogleAddressInput'
import {
  PROJECT_TYPE_OPTIONS,
  formatProjectTypeLabel,
  getProjectTypeDescription,
  normalizeProjectType,
  ProjectTypeValue,
} from '@/utils/projectType'

interface ProjectFieldsReviewProps {
  extractedData: Record<string, any>
  existingData: Record<string, any>
  confidence: Record<string, number>
  onDecisionsChange: (decisions: Record<string, any>) => void
  allowProjectCreation?: boolean
}

type FieldDecision = 'keep' | 'replace' | 'custom'

interface FieldConfig {
  extractedKey: string // Key in extracted_data.project
  existingKey: string  // Key in database project table
  label: string
  type: 'text' | 'number' | 'date' | 'email' | 'boolean'
  formatValue?: (value: any) => string
  validate?: (value: any) => string | null // Returns error message or null
}

const FIELD_CONFIGS: FieldConfig[] = [
  { extractedKey: 'organiser', existingKey: 'organiser_names', label: 'Organiser', type: 'text' },
  { extractedKey: 'builder', existingKey: 'builder_name', label: 'Builder', type: 'text' },
  { extractedKey: 'project_name', existingKey: 'name', label: 'Project Name', type: 'text' },
  { 
    extractedKey: 'project_value',
    existingKey: 'value',
    label: 'Project Value', 
    type: 'number',
    formatValue: (val) => val ? `$${val.toLocaleString()}` : '',
    validate: (val) => {
      if (val !== null && val !== undefined && val < 0) {
        return 'Project value must be positive'
      }
      return null
    }
  },
  { extractedKey: 'address', existingKey: 'address', label: 'Address', type: 'text' },
  { 
    extractedKey: 'proposed_start_date',
    existingKey: 'proposed_start_date',
    label: 'Proposed Start Date', 
    type: 'date',
    validate: (val) => {
      if (val && new Date(val) < new Date('2000-01-01')) {
        return 'Date seems too far in the past'
      }
      if (val && new Date(val) > new Date('2100-01-01')) {
        return 'Date seems too far in the future'
      }
      return null
    }
  },
  { 
    extractedKey: 'proposed_finish_date',
    existingKey: 'proposed_finish_date',
    label: 'Proposed Finish Date', 
    type: 'date',
    validate: (val) => {
      if (val && new Date(val) < new Date('2000-01-01')) {
        return 'Date seems too far in the past'
      }
      if (val && new Date(val) > new Date('2100-01-01')) {
        return 'Date seems too far in the future'
      }
      return null
    }
  },
  { extractedKey: 'eba_with_cfmeu', existingKey: 'eba_with_cfmeu', label: 'EBA with CFMEU', type: 'boolean' },
  { 
    extractedKey: 'roe_email',
    existingKey: 'roe_email',
    label: 'ROE Email', 
    type: 'email',
    validate: (val) => {
      if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        return 'Invalid email format'
      }
      return null
    }
  },
  { 
    extractedKey: 'state_funding',
    existingKey: 'state_funding',
    label: 'State Funding', 
    type: 'number',
    formatValue: (val) => val ? `$${val.toLocaleString()}` : '',
    validate: (val) => {
      if (val !== null && val !== undefined && val < 0) {
        return 'Funding must be positive'
      }
      return null
    }
  },
  { 
    extractedKey: 'federal_funding',
    existingKey: 'federal_funding',
    label: 'Federal Funding', 
    type: 'number',
    formatValue: (val) => val ? `$${val.toLocaleString()}` : '',
    validate: (val) => {
      if (val !== null && val !== undefined && val < 0) {
        return 'Funding must be positive'
      }
      return null
    }
  },
]

export function ProjectFieldsReview({
  extractedData,
  existingData,
  confidence,
  onDecisionsChange,
  allowProjectCreation = false,
}: ProjectFieldsReviewProps) {
  const [decisions, setDecisions] = useState<Record<string, {
    action: FieldDecision
    value: any
    error?: string
  }>>({})

  // Builder matching dialog state
  const [builderMatchOpen, setBuilderMatchOpen] = useState(false)
  const [allEmployers, setAllEmployers] = useState<any[]>([])
  const [builderSuggestedMatch, setBuilderSuggestedMatch] = useState<any>(null)

  // EBA search modal state
  const [ebaSearchOpen, setEbaSearchOpen] = useState(false)
  const [ebaEmployerInfo, setEbaEmployerInfo] = useState<{employerId: string, employerName: string} | null>(null)

  // Load all employers for matching and check for fuzzy match
  // NOTE: Paginate to get ALL employers, not just the first 1000
  useEffect(() => {
    const loadEmployers = async () => {
      let allData: any[] = []
      let from = 0
      const pageSize = 1000
      
      // Paginate through all employers to bypass Supabase's default limit
      while (true) {
        const { data, error } = await supabase
          .from('employers')
          .select('id, name, enterprise_agreement_status')
          .order('name')
          .range(from, from + pageSize - 1)
        
        if (error) {
          console.error('[ProjectFieldsReview] Error loading employers:', error)
          break
        }
        
        if (!data || data.length === 0) break
        
        allData = allData.concat(data)
        
        // If we got less than a full page, we've reached the end
        if (data.length < pageSize) break
        
        from += pageSize
      }

      setAllEmployers(allData)
      
      // Check for fuzzy match for builder
      const extractedBuilder = extractedData.builder
      if (extractedBuilder && allData.length > 0) {
        const { findBestEmployerMatch } = await import('@/utils/fuzzyMatching')
        const match = findBestEmployerMatch(extractedBuilder, allData)
        setBuilderSuggestedMatch(match)
      }
    }
    loadEmployers()
  }, [extractedData.builder])

  // Initialize decisions
  useEffect(() => {
    const initial: typeof decisions = {}
    FIELD_CONFIGS.forEach(config => {
      const extracted = extractedData[config.extractedKey]
      const existing = existingData[config.existingKey]
      
      // Auto-select action
      let action: FieldDecision = 'keep'
      if (extracted !== null && extracted !== undefined && extracted !== '') {
        if (existing === null || existing === undefined || existing === '') {
          action = 'replace' // Fill empty field
        } else if (config.existingKey === 'value' && extracted !== existing) {
          action = 'keep' // Require user decision for value conflicts
        }
      }
      
      initial[config.existingKey] = {
        action,
        value: action === 'replace' ? extracted : existing,
      }
    })

    const existingProjectType = normalizeProjectType(existingData.project_type)
    const extractedProjectType = normalizeProjectType(extractedData.project_type)

    initial.project_type = {
      action:
        extractedProjectType && extractedProjectType !== existingProjectType
          ? 'replace'
          : 'keep',
      value: extractedProjectType ?? existingProjectType ?? null,
    }
    setDecisions(initial)
  }, [extractedData, existingData])

  // Notify parent of changes
  useEffect(() => {
    const finalDecisions: Record<string, any> = {}
    Object.entries(decisions).forEach(([key, decision]) => {
      if (decision.action !== 'keep') {
        finalDecisions[key] = decision.value
      }
    })
    onDecisionsChange(finalDecisions)
  }, [decisions, onDecisionsChange])

  const handleDecisionChange = (existingKey: string, action: FieldDecision, customValue?: any) => {
    const config = FIELD_CONFIGS.find(f => f.existingKey === existingKey)
    if (!config) return

    let value: any

    if (action === 'keep') {
      value = existingData[config.existingKey]
    } else if (action === 'replace') {
      value = extractedData[config.extractedKey]
    } else {
      value = customValue
    }

    // Validate
    const error = config?.validate ? config.validate(value) : null

    setDecisions(prev => ({
      ...prev,
      [existingKey]: { action, value, error: error || undefined },
    }))
  }

  // Special handler for address field with geocoding
  const handleAddressChange = (addressData: GoogleAddress | null) => {
    if (!addressData) {
      handleDecisionChange('address', 'custom', '')
      return
    }

    // Store both the formatted address and lat/lng coordinates
    setDecisions(prev => ({
      ...prev,
      address: {
        action: 'custom',
        value: addressData.formatted,
        error: undefined,
      },
      // Store geocoding data separately for the API
      address_latitude: {
        action: 'custom',
        value: addressData.lat,
        error: undefined,
      },
      address_longitude: {
        action: 'custom',
        value: addressData.lng,
        error: undefined,
      },
    }))
  }

  const handleProjectTypeChange = (value: ProjectTypeValue | null) => {
    const existingProjectType = normalizeProjectType(existingData.project_type)
    setDecisions(prev => ({
      ...prev,
      project_type: {
        action: value === existingProjectType ? 'keep' : 'custom',
        value,
        error: undefined,
      },
    }))
  }

  const handleBuilderMatch = async (
    employerId: string, 
    employerName: string, 
    isNewEmployer: boolean,
    extras?: { contractorType?: string }
  ) => {
    // Fetch the employer's current EBA status
    let employerEbaStatus = null
    if (!isNewEmployer) {
      try {
        const { data: ebaData } = await supabase
          .from('employers')
          .select('enterprise_agreement_status')
          .eq('id', employerId)
          .single()

        employerEbaStatus = (ebaData as any)?.enterprise_agreement_status === true
      } catch (error) {
        console.error('Failed to fetch employer EBA status:', error)
      }
    }

    setDecisions(prev => {
      const updated = {
        ...prev,
        builder_name: {
          action: 'replace' as FieldDecision,
          value: employerName,
          error: undefined,
        },
        // Store employer ID for import process
        builder_employer_id: {
          action: 'replace' as FieldDecision,
          value: employerId,
          error: undefined,
        },
        builder_is_new: {
          action: 'replace' as FieldDecision,
          value: isNewEmployer,
          error: undefined,
        },
        // Update EBA field with employer's actual EBA status
        matched_employer_eba_status: {
          action: 'keep' as FieldDecision,
          value: employerEbaStatus,
          error: undefined,
        }
      }
      return updated
    })

    setBuilderMatchOpen(false)
  }

  const handleEbaSearch = () => {
    // When user selects "use scanned value" for EBA = Yes, offer to search for EBA
    const builderEmployerId = decisions.builder_employer_id?.value
    const builderName = decisions.builder_name?.value || extractedData.builder
    
    if (builderEmployerId && builderName) {
      setEbaEmployerInfo({ employerId: builderEmployerId, employerName: builderName })
      setEbaSearchOpen(true)
    }
  }

  const handleEbaSearchComplete = () => {
    // Refresh data after EBA assignment
    setEbaSearchOpen(false)
    // TODO: Refresh employer data to reflect new EBA status
  }

  const renderProjectTypeSelector = () => {
    const decision = decisions.project_type
    const existingType = normalizeProjectType(existingData.project_type)
    const extractedType = normalizeProjectType(extractedData.project_type)
    const selectedValue = typeof decision?.value !== 'undefined' ? decision?.value : existingType ?? null

    const existingLabel = formatProjectTypeLabel(existingType)
    const extractedLabel = extractedType ? formatProjectTypeLabel(extractedType) : 'Not detected'
    const extractedDescription = extractedType ? getProjectTypeDescription(extractedType) : null

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Project Type</CardTitle>
            {extractedType && extractedType !== existingType && (
              <Badge variant="secondary">New suggestion</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">Existing Value</div>
              <div className="font-medium text-gray-900">{existingLabel}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Scanned Suggestion</div>
              <div className="font-medium text-blue-900">{extractedLabel}</div>
              {extractedDescription && (
                <div className="text-xs text-muted-foreground mt-1">{extractedDescription}</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Select project type</div>
            <RadioGroup
              value={selectedValue ?? 'none'}
              onValueChange={(value) =>
                handleProjectTypeChange(value === 'none' ? null : (value as ProjectTypeValue))
              }
            >
              {PROJECT_TYPE_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-start gap-3 rounded border p-3">
                  <RadioGroupItem value={option.value} id={`project-type-${option.value}`} />
                  <Label htmlFor={`project-type-${option.value}`} className="font-normal cursor-pointer">
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                  </Label>
                </div>
              ))}
              <div className="flex items-start gap-3 rounded border p-3">
                <RadioGroupItem value="none" id="project-type-none" />
                <Label htmlFor="project-type-none" className="font-normal cursor-pointer">
                  <div className="font-medium text-gray-900">No project type</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Clear the project type if this scan should not update it.
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderFieldComparison = (config: FieldConfig) => {
    let extracted = extractedData[config.extractedKey]
    let existing = existingData[config.existingKey]
    
    // Special handling for EBA field - use matched employer's EBA status if available
    if (config.existingKey === 'eba_with_cfmeu' && decisions.matched_employer_eba_status?.value !== undefined) {
      existing = decisions.matched_employer_eba_status.value
      console.log('Using matched employer EBA status for existing value:', existing)
    }
    
    const decision = decisions[config.existingKey]
    const fieldConfidence = confidence[config.extractedKey] || 0

    const hasExtracted = extracted !== null && extracted !== undefined && extracted !== ''
    const hasExisting = existing !== null && existing !== undefined && existing !== ''
    const hasDifference = hasExtracted && hasExisting && extracted !== existing

    // Format display values
    const formatDisplay = (value: any) => {
      if (value === null || value === undefined || value === '') return '—'
      if (config.type === 'boolean') return value ? 'Yes' : 'No'
      if (config.formatValue) return config.formatValue(value)
      return String(value)
    }

    return (
      <Card key={config.existingKey} className={decision?.error ? 'border-red-300' : ''}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
            {hasExtracted && <ConfidenceIndicator confidence={fieldConfidence} size="sm" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show values side by side */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-500 mb-1">
                Existing Value
                {config.existingKey === 'eba_with_cfmeu' && decisions.matched_employer_eba_status?.value !== undefined && (
                  <span className="text-blue-600 font-medium"> (from matched builder)</span>
                )}
              </div>
              <div className="font-medium text-gray-900">
                {formatDisplay(existing)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">
                Scanned Value
                {/* Show if employer match was made */}
                {config.existingKey === 'builder_name' && decision?.action === 'replace' && decision.value !== extracted && (
                  <span className="text-green-600 font-medium"> → Matched to Employer</span>
                )}
              </div>
              <div className="font-medium text-blue-900">
                {/* Show matched employer name if available, otherwise show extracted value */}
                {config.existingKey === 'builder_name' && decision?.action === 'replace' && decision.value !== extracted ? (
                  <div className="space-y-1">
                    <div className="text-gray-600 line-through text-sm">{formatDisplay(extracted)}</div>
                    <div className="text-green-800 font-semibold flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {decision.value}
                    </div>
                  </div>
                ) : (
                  formatDisplay(extracted)
                )}
              </div>
            </div>
          </div>

          {/* Show difference indicator */}
          {hasDifference && config.existingKey === 'value' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Value conflict detected. Please choose which value to use.
                {existing > extracted ? (
                  <span className="flex items-center gap-1 text-red-600 mt-1">
                    <TrendingDown className="h-3 w-3" />
                    Scanned value is ${((existing - extracted) / 1000000).toFixed(1)}M lower
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-green-600 mt-1">
                    <TrendingUp className="h-3 w-3" />
                    Scanned value is ${((extracted - existing) / 1000000).toFixed(1)}M higher
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Special handling for Organiser field */}
          {config.existingKey === 'organiser_names' && hasExtracted ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input type="radio" id="organiser-keep" name="organiser-action" defaultChecked />
                  <Label htmlFor="organiser-keep" className="font-normal cursor-pointer">
                    Keep existing organiser assignments
                  </Label>
                </div>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <strong>Scanned organiser:</strong> "{extracted}"
                    <br />
                    <strong>Note:</strong> To update project organiser assignments, use the main project management interface. 
                    This requires patch reallocation and cannot be done from the scan review.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          ) : config.existingKey === 'builder_name' && hasExtracted ? (
            <div className="space-y-3">
              <RadioGroup
                value={decision?.action || 'keep'}
                onValueChange={(value) => handleDecisionChange(config.existingKey, value as FieldDecision)}
              >
                <div className="space-y-3">
                  {hasExisting && (
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="keep" id={`${config.existingKey}-keep`} />
                      <Label htmlFor={`${config.existingKey}-keep`} className="font-normal cursor-pointer">
                        Keep existing builder
                      </Label>
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="replace" id={`${config.existingKey}-match`} />
                      <Label htmlFor={`${config.existingKey}-match`} className="font-normal cursor-pointer">
                        Match scanned builder to existing employer
                      </Label>
                    </div>
                    {decision?.action === 'replace' && (
                      <div className="ml-6 space-y-2">
                        {builderSuggestedMatch && (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                            <div className="text-sm font-medium text-blue-900">
                              Suggested match: {builderSuggestedMatch.name}
                            </div>
                            <div className="text-xs text-blue-600 mt-1">
                              Confidence: {builderSuggestedMatch.confidence}
                            </div>
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBuilderMatchOpen(true)}
                          className="gap-2"
                        >
                          <Search className="h-4 w-4" />
                          {builderSuggestedMatch ? 'Review/Change Match' : `Find Employer for "${extracted}"`}
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="custom" id={`${config.existingKey}-custom`} />
                    <Label htmlFor={`${config.existingKey}-custom`} className="font-normal cursor-pointer">
                      Enter custom value
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </div>
          ) : (
            /* Standard field handling */
            <RadioGroup
              value={decision?.action || 'keep'}
              onValueChange={(value) => handleDecisionChange(config.existingKey, value as FieldDecision)}
            >
              <div className="space-y-2">
                {hasExisting && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="keep" id={`${config.existingKey}-keep`} />
                    <Label htmlFor={`${config.existingKey}-keep`} className="font-normal cursor-pointer">
                      Keep existing value
                    </Label>
                  </div>
                )}
                {hasExtracted && (
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="replace" id={`${config.existingKey}-replace`} />
                    <Label htmlFor={`${config.existingKey}-replace`} className="font-normal cursor-pointer">
                      Use scanned value
                    </Label>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id={`${config.existingKey}-custom`} />
                  <Label htmlFor={`${config.existingKey}-custom`} className="font-normal cursor-pointer">
                    Enter custom value
                  </Label>
                </div>
              </div>
            </RadioGroup>
          )}

          {/* Custom input */}
          {decision?.action === 'custom' && (
            <div>
              {config.type === 'date' ? (
                <DateInput
                  value={decision.value || ''}
                  onChange={(value) => handleDecisionChange(config.existingKey, 'custom', value)}
                  className={decision.error ? 'border-red-500' : ''}
                />
              ) : config.type === 'boolean' ? (
                <RadioGroup
                  value={decision.value ? 'true' : 'false'}
                  onValueChange={(value) => handleDecisionChange(config.existingKey, 'custom', value === 'true')}
                >
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id={`${config.existingKey}-yes`} />
                      <Label htmlFor={`${config.existingKey}-yes`}>Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id={`${config.existingKey}-no`} />
                      <Label htmlFor={`${config.existingKey}-no`}>No</Label>
                    </div>
                  </div>
                </RadioGroup>
              ) : config.existingKey === 'address' ? (
                <GoogleAddressInput
                  value={decision.value || ''}
                  onChange={handleAddressChange}
                  placeholder="Start typing an address..."
                />
              ) : (
                <Input
                  type={config.type === 'number' ? 'number' : config.type === 'email' ? 'email' : 'text'}
                  value={decision.value || ''}
                  onChange={(e) => handleDecisionChange(config.existingKey, 'custom', e.target.value)}
                  className={decision.error ? 'border-red-500' : ''}
                />
              )}
              {decision.error && (
                <p className="text-sm text-red-600 mt-1">{decision.error}</p>
              )}
            </div>
          )}

          {/* EBA Search Button - Show when user chooses to change EBA status to Yes/Active */}
          {config.existingKey === 'eba_with_cfmeu' && 
           (decision?.action === 'replace' || decision?.action === 'custom') && 
           (decision?.value === true) &&  // User is setting EBA to Yes
           existing !== true && // But existing status is not Yes
           decisions.builder_employer_id?.value && (
            <Alert className="mt-3">
              <FileSearch className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Setting EBA with CFMEU to: Yes</strong>
                    <br />
                    <span className="text-sm">Search FWC database to find and link the EBA details for {decisions.builder_name?.value}.</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEbaSearch}
                    className="ml-4 gap-2"
                    disabled={!decisions.builder_employer_id?.value}
                  >
                    <FileSearch className="h-4 w-4" />
                    Search FWC for EBA
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertDescription>
          Review each field below. For conflicting values, choose which one to keep or enter a custom value.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {renderProjectTypeSelector()}
        {FIELD_CONFIGS.map(renderFieldComparison)}
      </div>

      {/* Builder Matching Dialog */}
      {builderMatchOpen && (
        <EmployerMatchDialog
          open={builderMatchOpen}
          onOpenChange={setBuilderMatchOpen}
          companyName={extractedData.builder || 'Unknown Builder'}
          suggestedMatch={builderSuggestedMatch}
          allEmployers={allEmployers}
          onConfirm={handleBuilderMatch}
          allowContractorTypeSelection={true}
        />
      )}

      {/* EBA Search Modal */}
      {ebaSearchOpen && ebaEmployerInfo && (
        <FwcEbaSearchModal
          isOpen={ebaSearchOpen}
          onClose={() => setEbaSearchOpen(false)}
          employerId={ebaEmployerInfo.employerId}
          employerName={ebaEmployerInfo.employerName}
          onLinkEba={handleEbaSearchComplete}
        />
      )}
    </div>
  )
}
