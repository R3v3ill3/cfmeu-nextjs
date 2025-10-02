"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import DateInput from '@/components/ui/date-input'

interface ProjectFieldsReviewProps {
  extractedData: Record<string, any>
  existingData: Record<string, any>
  confidence: Record<string, number>
  onDecisionsChange: (decisions: Record<string, any>) => void
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
  { extractedKey: 'builder', existingKey: 'builder', label: 'Builder', type: 'text' },
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
}: ProjectFieldsReviewProps) {
  const [decisions, setDecisions] = useState<Record<string, {
    action: FieldDecision
    value: any
    error?: string
  }>>({})

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

  const renderFieldComparison = (config: FieldConfig) => {
    const extracted = extractedData[config.extractedKey]
    const existing = existingData[config.existingKey]
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
              <div className="text-xs text-gray-500 mb-1">Existing Value</div>
              <div className="font-medium text-gray-900">
                {formatDisplay(existing)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Scanned Value</div>
              <div className="font-medium text-blue-900">
                {formatDisplay(extracted)}
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

          {/* Decision radio group */}
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
        {FIELD_CONFIGS.map(renderFieldComparison)}
      </div>
    </div>
  )
}
