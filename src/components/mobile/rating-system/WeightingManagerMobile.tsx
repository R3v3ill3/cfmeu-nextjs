"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  Settings,
  Plus,
  Save,
  RotateCcw,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Edit,
  Check,
  X,
  Info,
  Zap,
  Target,
  Scale
} from "lucide-react"
import { WeightingConfig, RatingFactor, RatingTrack, RoleType } from "@/types/rating"
import { useHapticFeedback } from "../shared/HapticFeedback"
import { BottomSheet, BottomSheetContent, BottomSheetHeader, BottomSheetFooter } from "../shared/BottomSheet"

interface WeightingManagerMobileProps {
  track: RatingTrack
  roleContext: RoleType
  currentWeighting?: WeightingConfig
  availableTemplates?: WeightingConfig[]
  onSaveWeighting: (config: WeightingConfig) => Promise<void>
  onPreviewWeighting?: (config: WeightingConfig) => void
  onDuplicateTemplate?: (template: WeightingConfig) => void
  className?: string
}

// Preset weighting templates
const presetTemplates: Record<string, Partial<WeightingConfig>> = {
  // Project Data templates
  'project-balanced': {
    name: 'Balanced Assessment',
    description: 'Equal emphasis on all factors',
    factors: [
      { id: 'compliance', name: 'Compliance', weight: 25, min_value: 0, max_value: 100, required: true },
      { id: 'participation', name: 'Participation', weight: 25, min_value: 0, max_value: 100, required: true },
      { id: 'disputes', name: 'Dispute Management', weight: 25, min_value: 0, max_value: 10, required: true },
      { id: 'safety', name: 'Safety Record', weight: 25, min_value: 0, max_value: 10, required: true },
    ],
  },
  'project-compliance-focused': {
    name: 'Compliance Focused',
    description: 'Heavy emphasis on compliance and safety',
    factors: [
      { id: 'compliance', name: 'Compliance', weight: 40, min_value: 0, max_value: 100, required: true },
      { id: 'participation', name: 'Participation', weight: 15, min_value: 0, max_value: 100, required: true },
      { id: 'disputes', name: 'Dispute Management', weight: 20, min_value: 0, max_value: 10, required: true },
      { id: 'safety', name: 'Safety Record', weight: 25, min_value: 0, max_value: 10, required: true },
    ],
  },
  'project-relations-focused': {
    name: 'Relations Focused',
    description: 'Focus on worker relations and participation',
    factors: [
      { id: 'compliance', name: 'Compliance', weight: 20, min_value: 0, max_value: 100, required: true },
      { id: 'participation', name: 'Participation', weight: 40, min_value: 0, max_value: 100, required: true },
      { id: 'disputes', name: 'Dispute Management', weight: 30, min_value: 0, max_value: 10, required: true },
      { id: 'safety', name: 'Safety Record', weight: 10, min_value: 0, max_value: 10, required: true },
    ],
  },

  // Organiser Expertise templates
  'expertise-balanced': {
    name: 'Balanced Expertise',
    description: 'Balanced view of all expertise factors',
    factors: [
      { id: 'relationship', name: 'Relationship Quality', weight: 25, min_value: 0, max_value: 10, required: true },
      { id: 'communication', name: 'Communication', weight: 25, min_value: 0, max_value: 10, required: true },
      { id: 'cooperation', name: 'Cooperation', weight: 25, min_value: 0, max_value: 10, required: true },
      { id: 'problem_solving', name: 'Problem Solving', weight: 25, min_value: 0, max_value: 10, required: true },
    ],
  },
  'expertise-relations-focused': {
    name: 'Relations Priority',
    description: 'Emphasis on relationship and cooperation',
    factors: [
      { id: 'relationship', name: 'Relationship Quality', weight: 35, min_value: 0, max_value: 10, required: true },
      { id: 'communication', name: 'Communication', weight: 20, min_value: 0, max_value: 10, required: true },
      { id: 'cooperation', name: 'Cooperation', weight: 35, min_value: 0, max_value: 10, required: true },
      { id: 'problem_solving', name: 'Problem Solving', weight: 10, min_value: 0, max_value: 10, required: true },
    ],
  },
}

// Factor editor component
function FactorEditor({
  factor,
  onChange,
  onRemove,
  showValueRange = true,
}: {
  factor: RatingFactor
  onChange: (factor: RatingFactor) => void
  onRemove: () => void
  showValueRange?: boolean
}) {
  const { trigger } = useHapticFeedback()

  const handleWeightChange = React.useCallback((weights: number[]) => {
    onChange({ ...factor, weight: weights[0] })
    trigger()
  }, [factor, onChange, trigger])

  const handleNameChange = React.useCallback((name: string) => {
    onChange({ ...factor, name })
  }, [factor, onChange])

  const handleRequiredChange = React.useCallback((required: boolean) => {
    onChange({ ...factor, required })
    trigger()
  }, [factor, onChange, trigger])

  const handleValueRangeChange = React.useCallback((field: 'min_value' | 'max_value', value: number) => {
    onChange({ ...factor, [field]: value })
    trigger()
  }, [factor, onChange, trigger])

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Input
              value={factor.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="font-medium text-sm border-none bg-transparent p-0 h-auto focus-visible:ring-0"
              placeholder="Factor name"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-red-600"
              onClick={onRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Weight slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium">Weight</Label>
              <Badge variant="outline" className="text-xs">
                {factor.weight}%
              </Badge>
            </div>
            <Slider
              value={[factor.weight]}
              onValueChange={handleWeightChange}
              min={0}
              max={100}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Value range */}
          {showValueRange && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Min Value</Label>
                <Input
                  type="number"
                  value={factor.min_value}
                  onChange={(e) => handleValueRangeChange('min_value', Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max Value</Label>
                <Input
                  type="number"
                  value={factor.max_value}
                  onChange={(e) => handleValueRangeChange('max_value', Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* Required toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">Required Factor</Label>
              <p className="text-xs text-muted-foreground">
                This factor must be included in calculations
              </p>
            </div>
            <Switch
              checked={factor.required}
              onCheckedChange={handleRequiredChange}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Template card component
function TemplateCard({
  template,
  isSelected,
  onSelect,
  onDuplicate,
  onEdit,
}: {
  template: WeightingConfig
  isSelected?: boolean
  onSelect: () => void
  onDuplicate: () => void
  onEdit: () => void
}) {
  const { selection, onPress } = useHapticFeedback()

  const handleSelect = React.useCallback(() => {
    selection()
    onSelect()
  }, [selection, onSelect])

  const handleDuplicate = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onPress()
    onDuplicate()
  }, [onPress, onDuplicate])

  const handleEdit = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selection()
    onEdit()
  }, [selection, onEdit])

  const totalWeight = template.factors.reduce((sum, factor) => sum + factor.weight, 0)

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected && "ring-2 ring-primary ring-offset-2",
        template.is_default && "border-2 border-blue-200"
      )}
      onClick={handleSelect}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm truncate">{template.name}</h3>
              {template.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {template.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {template.is_default && (
                <Badge variant="secondary" className="text-xs">
                  Default
                </Badge>
              )}
            </div>
          </div>

          {/* Factor summary */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Factors</span>
              <span className="font-medium">{template.factors.length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total Weight</span>
              <span className={cn(
                "font-medium",
                totalWeight === 100 ? "text-green-600" : "text-amber-600"
              )}>
                {totalWeight}%
              </span>
            </div>
          </div>

          {/* Factor preview */}
          <div className="space-y-1">
            {template.factors.slice(0, 2).map((factor, index) => (
              <div key={index} className="flex justify-between text-xs">
                <span className="text-muted-foreground truncate flex-1 mr-2">
                  {factor.name}
                </span>
                <span className="font-medium">{factor.weight}%</span>
              </div>
            ))}
            {template.factors.length > 2 && (
              <p className="text-xs text-muted-foreground">
                +{template.factors.length - 2} more factors
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleEdit}
            >
              <Edit className="h-3 w-3 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={handleDuplicate}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function WeightingManagerMobile({
  track,
  roleContext,
  currentWeighting,
  availableTemplates = [],
  onSaveWeighting,
  onPreviewWeighting,
  onDuplicateTemplate,
  className,
}: WeightingManagerMobileProps) {
  const [activeTab, setActiveTab] = React.useState("templates")
  const [editingConfig, setEditingConfig] = React.useState<WeightingConfig | null>(null)
  const [selectedTemplate, setSelectedTemplate] = React.useState<WeightingConfig | null>(null)
  const [showPreview, setShowPreview] = React.useState(false)
  const [hasChanges, setHasChanges] = React.useState(false)

  const { trigger, success, error } = useHapticFeedback()

  // Initialize editing config from current weighting or template
  React.useEffect(() => {
    if (editingConfig) return

    if (currentWeighting) {
      setEditingConfig({ ...currentWeighting })
      setSelectedTemplate(currentWeighting)
    } else {
      // Use a default template
      const templateKey = track === 'project_data' ? 'project-balanced' : 'expertise-balanced'
      const template = presetTemplates[templateKey]
      if (template) {
        const newConfig: WeightingConfig = {
          id: `custom-${Date.now()}`,
          name: template.name || 'Custom Weighting',
          description: template.description,
          track,
          role_context: roleContext,
          factors: template.factors || [],
          is_default: false,
          created_by: 'current-user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setEditingConfig(newConfig)
      }
    }
  }, [track, roleContext, currentWeighting, editingConfig])

  const handleSelectTemplate = React.useCallback((template: WeightingConfig) => {
    setSelectedTemplate(template)
    setEditingConfig({ ...template })
    setHasChanges(false)
    success()
  }, [success])

  const handleAddFactor = React.useCallback(() => {
    if (!editingConfig) return

    const newFactor: RatingFactor = {
      id: `factor-${Date.now()}`,
      name: 'New Factor',
      weight: 10,
      min_value: 0,
      max_value: 10,
      required: false,
    }

    setEditingConfig({
      ...editingConfig,
      factors: [...editingConfig.factors, newFactor],
    })
    setHasChanges(true)
    trigger()
  }, [editingConfig, trigger])

  const handleUpdateFactor = React.useCallback((factorId: string, updatedFactor: RatingFactor) => {
    if (!editingConfig) return

    setEditingConfig({
      ...editingConfig,
      factors: editingConfig.factors.map(f => f.id === factorId ? updatedFactor : f),
    })
    setHasChanges(true)
  }, [editingConfig])

  const handleRemoveFactor = React.useCallback((factorId: string) => {
    if (!editingConfig) return

    setEditingConfig({
      ...editingConfig,
      factors: editingConfig.factors.filter(f => f.id !== factorId),
    })
    setHasChanges(true)
    trigger()
  }, [editingConfig, trigger])

  const handleSaveWeighting = React.useCallback(async () => {
    if (!editingConfig) return

    try {
      await onSaveWeighting(editingConfig)
      setHasChanges(false)
      success()
    } catch (err) {
      error()
      console.error('Failed to save weighting:', err)
    }
  }, [editingConfig, onSaveWeighting, success, error])

  const handleResetWeighting = React.useCallback(() => {
    if (selectedTemplate) {
      setEditingConfig({ ...selectedTemplate })
      setHasChanges(false)
      trigger()
    }
  }, [selectedTemplate, trigger])

  const totalWeight = editingConfig?.factors.reduce((sum, factor) => sum + factor.weight, 0) || 0
  const isWeightingValid = totalWeight === 100

  if (!editingConfig) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Weighting Configuration</CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">
                {track.replace('_', ' ')}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {roleContext}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure how different factors contribute to the overall rating calculation.
          </p>
        </CardHeader>
      </Card>

      {/* Weight validation alert */}
      {!isWeightingValid && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Weight Total: {totalWeight}% (should be 100%)
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  Adjust factor weights to total exactly 100% for accurate calculations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Custom
          </TabsTrigger>
        </TabsList>

        {/* Templates tab */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="space-y-3">
            {/* Preset templates */}
            <h3 className="font-medium text-sm">Preset Templates</h3>
            {Object.entries(presetTemplates).map(([key, template]) => {
              const fullTemplate: WeightingConfig = {
                id: key,
                name: template.name || 'Template',
                description: template.description,
                track,
                role_context: roleContext,
                factors: template.factors || [],
                is_default: false,
                created_by: 'system',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }

              return (
                <TemplateCard
                  key={key}
                  template={fullTemplate}
                  isSelected={selectedTemplate?.id === key}
                  onSelect={() => handleSelectTemplate(fullTemplate)}
                  onDuplicate={() => onDuplicateTemplate?.(fullTemplate)}
                  onEdit={() => {
                    setEditingConfig(fullTemplate)
                    setActiveTab("custom")
                  }}
                />
              )
            })}

            {/* Available custom templates */}
            {availableTemplates.length > 0 && (
              <>
                <Separator />
                <h3 className="font-medium text-sm">Custom Templates</h3>
                {availableTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    isSelected={selectedTemplate?.id === template.id}
                    onSelect={() => handleSelectTemplate(template)}
                    onDuplicate={() => onDuplicateTemplate?.(template)}
                    onEdit={() => {
                      setEditingConfig(template)
                      setActiveTab("custom")
                    }}
                  />
                ))}
              </>
            )}
          </div>
        </TabsContent>

        {/* Custom tab */}
        <TabsContent value="custom" className="space-y-4 mt-4">
          {/* Config header */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Configuration Name</Label>
                  <Input
                    value={editingConfig.name}
                    onChange={(e) => setEditingConfig({ ...editingConfig, name: e.target.value })}
                    placeholder="Enter a name for this weighting configuration"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-medium">Description</Label>
                  <Input
                    value={editingConfig.description || ''}
                    onChange={(e) => setEditingConfig({ ...editingConfig, description: e.target.value })}
                    placeholder="Describe how this weighting should be used"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Factors list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Factors ({editingConfig.factors.length})</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddFactor}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Factor
              </Button>
            </div>

            {editingConfig.factors.map((factor) => (
              <FactorEditor
                key={factor.id}
                factor={factor}
                onChange={(updatedFactor) => handleUpdateFactor(factor.id, updatedFactor)}
                onRemove={() => handleRemoveFactor(factor.id)}
                showValueRange={track === 'project_data'}
              />
            ))}

            {editingConfig.factors.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <Scale className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <h3 className="font-medium text-foreground mb-1">No Factors Added</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add factors to define how ratings are calculated.
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleAddFactor}
                    className="h-8 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add First Factor
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Weight summary */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-3">
                <h3 className="font-medium text-sm">Weight Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Weight</span>
                    <Badge
                      variant={isWeightingValid ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {totalWeight}%
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Required Factors</span>
                    <span className="text-sm font-medium">
                      {editingConfig.factors.filter(f => f.required).length} of {editingConfig.factors.length}
                    </span>
                  </div>
                </div>

                {!isWeightingValid && (
                  <div className="bg-amber-50 p-2 rounded text-xs text-amber-800">
                    Adjust weights to total 100% for accurate calculations.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action buttons */}
      <div className="flex gap-3 sticky bottom-0 bg-background/95 backdrop-blur-sm p-4 border-t">
        {hasChanges && (
          <Button
            variant="outline"
            onClick={handleResetWeighting}
            className="flex-1"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => onPreviewWeighting?.(editingConfig)}
          className="flex-1"
          disabled={!isWeightingValid}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
        </Button>
        <Button
          onClick={handleSaveWeighting}
          className="flex-1"
          disabled={!isWeightingValid || !hasChanges}
        >
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  )
}