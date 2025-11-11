"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Building2,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Sparkles,
  Users,
  Filter,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface SubcontractorEntry {
  index: number
  trade: string
  stage: string
  company: string
  matchedEmployer?: any
  existingEmployers?: any[]
  additionalEmployers?: any[]
}

interface BulkAliasOperationsProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  subcontractors: SubcontractorEntry[]
  allEmployers: any[]
  onComplete?: () => void
}

interface BulkAliasSuggestion {
  subcontractorIndex: number
  employerId: string
  employerName: string
  suggestedAlias: string
  confidence: 'high' | 'medium' | 'low'
  reason: string
  conflicts?: Array<{
    employerId: string
    employerName: string
    alias: string
  }>
}

export function BulkAliasOperations({
  isOpen,
  onOpenChange,
  subcontractors,
  allEmployers,
  onComplete
}: BulkAliasOperationsProps) {
  const [suggestions, setSuggestions] = useState<BulkAliasSuggestion[]>([])
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<{
    success: number
    failed: number
    errors: string[]
  }>({ success: 0, failed: 0, errors: [] })
  const [showResults, setShowResults] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // Generate suggestions when dialog opens
  useEffect(() => {
    if (!isOpen || subcontractors.length === 0) return

    setLoading(true)
    generateSuggestions()
  }, [isOpen, subcontractors, allEmployers])

  const generateSuggestions = () => {
    const newSuggestions: BulkAliasSuggestion[] = []

    subcontractors.forEach((subcontractor, index) => {
      // Skip if no company name or already has exact match
      if (!subcontractor.company || subcontractor.matchedEmployer?.confidence === 'exact') {
        return
      }

      // For each employer matched to this subcontractor, suggest creating an alias
      const employersToSuggest = []

      // Include matched employer (if not exact)
      if (subcontractor.matchedEmployer && subcontractor.matchedEmployer.confidence !== 'exact') {
        employersToSuggest.push(subcontractor.matchedEmployer)
      }

      // Include existing employers
      if (subcontractor.existingEmployers) {
        employersToSuggest.push(...subcontractor.existingEmployers)
      }

      // Include additional employers
      if (subcontractor.additionalEmployers) {
        employersToSuggest.push(...subcontractor.additionalEmployers)
      }

      employersToSuggest.forEach(employer => {
        const suggestion = analyzeAliasSuggestion(
          subcontractor.company!,
          employer,
          index
        )

        if (suggestion) {
          newSuggestions.push(suggestion)
        }
      })
    })

    // Sort by confidence and group by employer
    newSuggestions.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 }
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
    })

    setSuggestions(newSuggestions)
    setLoading(false)
  }

  const analyzeAliasSuggestion = (
    companyName: string,
    employer: any,
    subcontractorIndex: number
  ): BulkAliasSuggestion | null => {
    const employerName = employer.name || employer.employerName
    const similarity = calculateSimilarity(companyName, employerName)

    // High confidence: very similar but not exact match
    if (similarity > 0.8 && similarity < 1.0) {
      return {
        subcontractorIndex,
        employerId: employer.id || employer.employerId,
        employerName,
        suggestedAlias: companyName.trim(),
        confidence: 'high',
        reason: `Company name is very similar to employer name (${Math.round(similarity * 100)}% match)`
      }
    }

    // Medium confidence: contains key words or common variations
    if (similarity > 0.5) {
      return {
        subcontractorIndex,
        employerId: employer.id || employer.employerId,
        employerName,
        suggestedAlias: companyName.trim(),
        confidence: 'medium',
        reason: `Company name shares key terms with employer name`
      }
    }

    // Low confidence: might be worth adding anyway for better matching
    if (similarity > 0.3) {
      return {
        subcontractorIndex,
        employerId: employer.id || employer.employerId,
        employerName,
        suggestedAlias: companyName.trim(),
        confidence: 'low',
        reason: `Potential variation that could improve future matching`
      }
    }

    return null
  }

  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()

    if (s1 === s2) return 1.0

    // Check if one contains the other
    if (s1.includes(s2) || s2.includes(s1)) {
      return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length)
    }

    // Simple word-based similarity
    const words1 = s1.split(/\s+/)
    const words2 = s2.split(/\s+/)

    let commonWords = 0
    words1.forEach(word1 => {
      if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
        commonWords++
      }
    })

    return commonWords / Math.max(words1.length, words2.length)
  }

  const checkForConflicts = async (suggestion: BulkAliasSuggestion): Promise<Array<{
    employerId: string
    employerName: string
    alias: string
  }>> => {
    try {
      const { data, error } = await supabase
        .from('employer_aliases')
        .select(`
          employer_id,
          alias,
          employers!employer_aliases_employer_id_fkey (name)
        `)
        .ilike('alias_normalized', suggestion.suggestedAlias.toLowerCase())

      if (error) throw error

      return (data || [])
        .filter(alias => alias.employer_id !== suggestion.employerId)
        .map(alias => ({
          employerId: alias.employer_id,
          employerName: alias.employers?.name || 'Unknown',
          alias: alias.alias
        }))
    } catch (error) {
      console.error('Failed to check for conflicts:', error)
      return []
    }
  }

  const handleSelectSuggestion = (suggestionId: string, selected: boolean) => {
    const newSelected = new Set(selectedSuggestions)
    if (selected) {
      newSelected.add(suggestionId)
    } else {
      newSelected.delete(suggestionId)
    }
    setSelectedSuggestions(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedSuggestions.size === suggestions.length) {
      setSelectedSuggestions(new Set())
    } else {
      setSelectedSuggestions(new Set(suggestions.map(s => getSuggestionId(s))))
    }
  }

  const getSuggestionId = (suggestion: BulkAliasSuggestion): string => {
    return `${suggestion.subcontractorIndex}-${suggestion.employerId}`
  }

  const handleCreateAliases = async () => {
    if (selectedSuggestions.size === 0) return

    setProcessing(true)
    setProgress(0)
    setResults({ success: 0, failed: 0, errors: [] })

    const selectedAliases = suggestions.filter(s =>
      selectedSuggestions.has(getSuggestionId(s))
    )

    let successCount = 0
    let failedCount = 0
    const errors: string[] = []

    for (let i = 0; i < selectedAliases.length; i++) {
      const suggestion = selectedAliases[i]

      try {
        // Check for conflicts first
        const conflicts = await checkForConflicts(suggestion)

        if (conflicts.length > 0) {
          errors.push(`Skipped "${suggestion.suggestedAlias}" for ${suggestion.employerName} - conflicts with existing aliases`)
          failedCount++
          continue
        }

        // Create the alias
        const { error } = await supabase
          .from('employer_aliases')
          .insert({
            employer_id: suggestion.employerId,
            alias: suggestion.suggestedAlias,
            alias_normalized: suggestion.suggestedAlias.toLowerCase(),
            is_authoritative: true,
            source_system: 'bulk_import',
            source_identifier: `scan-review-${suggestion.subcontractorIndex}`,
            notes: `Bulk created from scan review. Reason: ${suggestion.reason}`,
            created_at: new Date().toISOString()
          })

        if (error) {
          errors.push(`Failed to create alias "${suggestion.suggestedAlias}": ${error.message}`)
          failedCount++
        } else {
          successCount++
        }
      } catch (error) {
        errors.push(`Unexpected error creating alias "${suggestion.suggestedAlias}": ${error}`)
        failedCount++
      }

      setProgress((i + 1) / selectedAliases.length * 100)
    }

    setResults({ success: successCount, failed: failedCount, errors })
    setProcessing(false)
    setShowResults(true)
  }

  const handleReset = () => {
    setSuggestions([])
    setSelectedSuggestions(new Set())
    setResults({ success: 0, failed: 0, errors: [] })
    setShowResults(false)
    setProgress(0)
    generateSuggestions()
  }

  const handleClose = () => {
    if (showResults && results.success > 0) {
      onComplete?.()
    }
    onOpenChange(false)
  }

  // Group suggestions by employer
  const groupedSuggestions = suggestions.reduce((groups, suggestion) => {
    const key = `${suggestion.employerId}-${suggestion.employerName}`
    if (!groups[key]) {
      groups[key] = {
        employerId: suggestion.employerId,
        employerName: suggestion.employerName,
        suggestions: []
      }
    }
    groups[key].suggestions.push(suggestion)
    return groups
  }, {} as Record<string, any>)

  const toggleGroupExpansion = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey)
    } else {
      newExpanded.add(groupKey)
    }
    setExpandedGroups(newExpanded)
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Bulk Alias Operations
          </DialogTitle>
          <DialogDescription>
            Review and create aliases in bulk from scanned company names to improve future matching accuracy
          </DialogDescription>
        </DialogHeader>

        {!showResults ? (
          <div className="flex flex-col h-[65vh]">
            {/* Summary */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Suggestions Generated:</span>
                    <span className="ml-2 font-medium">{suggestions.length}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Selected:</span>
                    <span className="ml-2 font-medium">{selectedSuggestions.size}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={processing}
                  >
                    <Filter className="h-4 w-4 mr-1" />
                    Regenerate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    disabled={suggestions.length === 0}
                  >
                    {selectedSuggestions.size === suggestions.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-sm text-gray-500">Analyzing subcontractor data...</div>
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions found</h3>
                  <p className="text-gray-500">
                    No potential aliases were identified from the subcontractor data
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedSuggestions).map(([groupKey, group]: [string, any]) => {
                    const isExpanded = expandedGroups.has(groupKey)
                    const groupSelectedCount = group.suggestions.filter((s: BulkAliasSuggestion) =>
                      selectedSuggestions.has(getSuggestionId(s))
                    ).length

                    return (
                      <Card key={groupKey}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleGroupExpansion(groupKey)}
                                className="h-6 w-6 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <Building2 className="h-4 w-4" />
                              <span className="font-medium">{group.employerName}</span>
                              <Badge variant="secondary" className="text-xs">
                                {group.suggestions.length} suggestion{group.suggestions.length > 1 ? 's' : ''}
                              </Badge>
                              {groupSelectedCount > 0 && (
                                <Badge variant="default" className="text-xs">
                                  {groupSelectedCount} selected
                                </Badge>
                              )}
                            </div>
                            <Checkbox
                              checked={groupSelectedCount === group.suggestions.length}
                              onCheckedChange={(checked) => {
                                group.suggestions.forEach((s: BulkAliasSuggestion) => {
                                  handleSelectSuggestion(getSuggestionId(s), checked as boolean)
                                })
                              }}
                            />
                          </div>
                        </CardHeader>

                        {isExpanded && (
                          <CardContent className="pt-0">
                            <div className="space-y-3">
                              {group.suggestions.map((suggestion: BulkAliasSuggestion) => {
                                const isSelected = selectedSuggestions.has(getSuggestionId(suggestion))
                                const confidenceColors = {
                                  high: 'bg-green-100 text-green-800 border-green-200',
                                  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                                  low: 'bg-gray-100 text-gray-800 border-gray-200'
                                }

                                return (
                                  <div
                                    key={getSuggestionId(suggestion)}
                                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                      isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                                    }`}
                                    onClick={() => handleSelectSuggestion(getSuggestionId(suggestion), !isSelected)}
                                  >
                                    <div className="flex items-start justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                          <div className="flex items-center justify-center p-2 rounded-lg border-2 border-transparent hover:border-gray-300 focus-within:border-blue-500 min-h-[44px] min-w-[44px] touch-manipulation transition-colors">
                                            <input
                                              type="checkbox"
                                              id={`suggestion-${suggestion.id}`}
                                              checked={isSelected}
                                              onChange={() => handleSelectSuggestion(getSuggestionId(suggestion), !isSelected)}
                                              className="h-5 w-5 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                          </div>
                                          <Label htmlFor={`suggestion-${suggestion.id}`} className="font-medium cursor-pointer">
                                            "{suggestion.suggestedAlias}"
                                          </Label>
                                          <Badge
                                            variant="outline"
                                            className={`text-xs ${confidenceColors[suggestion.confidence]}`}
                                          >
                                            {suggestion.confidence} confidence
                                          </Badge>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">{suggestion.reason}</p>
                                        <div className="text-xs text-gray-500">
                                          From: Subcontractor #{suggestion.subcontractorIndex + 1} ({subcontractors[suggestion.subcontractorIndex].trade})
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t">
              <div className="flex items-center justify-between">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Creating aliases will improve future matching accuracy for scanned documents.
                    High confidence suggestions are recommended.
                  </AlertDescription>
                </Alert>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleClose} disabled={processing}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateAliases}
                    disabled={selectedSuggestions.size === 0 || processing}
                    className="gap-2"
                  >
                    {processing ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Creating Aliases...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Create {selectedSuggestions.size} Alias{selectedSuggestions.size !== 1 ? 'es' : ''}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {processing && (
                <div className="mt-4">
                  <Progress value={progress} className="w-full" />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Results View */
          <div className="p-6">
            <div className="text-center mb-6">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Bulk Alias Creation Complete</h3>
              <div className="flex items-center justify-center gap-6 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{results.success}</div>
                  <div className="text-sm text-gray-500">Successful</div>
                </div>
                {results.failed > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{results.failed}</div>
                    <div className="text-sm text-gray-500">Failed</div>
                  </div>
                )}
              </div>
            </div>

            {results.errors.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  Errors & Warnings
                </h4>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {results.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 p-2 bg-red-50 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose} className="w-full">
                {results.success > 0 ? 'Done' : 'Close'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}