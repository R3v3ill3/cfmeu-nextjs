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
  key: string
  label: string
  type: 'text' | 'number' | 'date' | 'email' | 'boolean'
  formatValue?: (value: any) => string
  validate?: (value: any) => string | null // Returns error message or null
}

const FIELD_CONFIGS: FieldConfig[] = [
  { key: 'organiser', label: 'Organiser', type: 'text' },
  { key: 'project_name', label: 'Project Name', type: 'text' },
  { 
    key: 'project_value', 
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
  { key: 'address', label: 'Address', type: 'text' },
  { key: 'builder', label: 'Builder', type: 'text' },
  { 
    key: 'proposed_start_date', 
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
    key: 'proposed_finish_date', 
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
  { key: 'eba_with_cfmeu', label: 'EBA with CFMEU', type: 'boolean' },
  { 
    key: 'roe_email', 
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
    key: 'state_funding', 
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
    key: 'federal_funding', 
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
      const extracted = extractedData[config.key]
      const existing = existingData[config.key]
      
      // Auto-select action
      let action: FieldDecision = 'keep'
      if (extracted !== null && extracted !== undefined && extracted !== '') {
        if (existing === null || existing === undefined || existing === '') {
          action = 'replace' // Fill empty field
        } else if (config.key === 'project_value' && extracted !== existing) {
          action = 'keep' // Require user decision for value conflicts
        }
      }
      
      initial[config.key] = {
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

  const handleDecisionChange = (key: string, action: FieldDecision, customValue?: any) => {
    const config = FIELD_CONFIGS.find(f => f.key === key)
    let value: any
    
    if (action === 'keep') {
      value = existingData[key]
    } else if (action === 'replace') {
      value = extractedData[key]
    } else {
      value = customValue
    }

    // Validate
    const error = config?.validate ? config.validate(value) : null

    setDecisions(prev => ({
      ...prev,
      [key]: { action, value, error: error || undefined },
    }))
  }

  const renderFieldComparison = (config: FieldConfig) => {
    const extracted = extractedData[config.key]
    const existing = existingData[config.key]
    const decision = decisions[config.key]
    const fieldConfidence = confidence[config.key] || 0

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
      <Card key={config.key} className={decision?.error ? 'border-red-300' : ''}>
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
          {hasDifference && config.key === 'project_value' && (
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
            onValueChange={(value) => handleDecisionChange(config.key, value as FieldDecision)}
          >
            <div className="space-y-2">
              {hasExisting && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="keep" id={`${config.key}-keep`} />
                  <Label htmlFor={`${config.key}-keep`} className="font-normal cursor-pointer">
                    Keep existing value
                  </Label>
                </div>
              )}
              {hasExtracted && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="replace" id={`${config.key}-replace`} />
                  <Label htmlFor={`${config.key}-replace`} className="font-normal cursor-pointer">
                    Use scanned value
                  </Label>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id={`${config.key}-custom`} />
                <Label htmlFor={`${config.key}-custom`} className="font-normal cursor-pointer">
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
                  onChange={(value) => handleDecisionChange(config.key, 'custom', value)}
                  className={decision.error ? 'border-red-500' : ''}
                />
              ) : config.type === 'boolean' ? (
                <RadioGroup
                  value={decision.value ? 'true' : 'false'}
                  onValueChange={(value) => handleDecisionChange(config.key, 'custom', value === 'true')}
                >
                  <div className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id={`${config.key}-yes`} />
                      <Label htmlFor={`${config.key}-yes`}>Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id={`${config.key}-no`} />
                      <Label htmlFor={`${config.key}-no`}>No</Label>
                    </div>
                  </div>
                </RadioGroup>
              ) : (
                <Input
                  type={config.type === 'number' ? 'number' : config.type === 'email' ? 'email' : 'text'}
                  value={decision.value || ''}
                  onChange={(e) => handleDecisionChange(config.key, 'custom', e.target.value)}
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
