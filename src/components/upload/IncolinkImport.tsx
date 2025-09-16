"use client"

import { useState, useCallback, useMemo } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'
import { AlertCircle, CheckCircle, XCircle, Search, ChevronDown, ChevronUp, Loader2, ArrowLeft, Link } from 'lucide-react'
import { matchEmployerAdvanced, batchMatchEmployers, getMatchingStatistics, EmployerMatchResult, EmployerMatch } from '@/utils/employerMatching'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

interface IncolinkImportProps {
  csvData: Record<string, any>[]
  onImportComplete: (results: ImportResults) => void
  onBack: () => void
}

interface ProcessedIncolinkData {
  employer_name: string
  incolink_id: string
  row_index: number
  original_data: Record<string, any>
}

interface ProcessedIncolinkDataWithMatch extends ProcessedIncolinkData {
  matchResult?: EmployerMatchResult
  selectedEmployerId?: string
  selectedEmployerName?: string
  decision?: 'use_existing' | 'create_new' | 'skip'
}

interface ImportResults {
  imported: number
  updated: number
  skipped: number
  errors: string[]
  mergedEmployers: number
}

interface ImportProgress {
  status: 'idle' | 'matching' | 'importing' | 'completed' | 'error'
  processed: number
  total: number
  errors: string[]
  currentEmployer?: string
}

interface ImportSettings {
  allowCreateNew: boolean
  updateExistingRecords: boolean
  requireManualConfirmation: boolean
}

export function IncolinkImport({ csvData, onImportComplete, onBack }: IncolinkImportProps) {
  const { toast } = useToast()
  const [importSettings, setImportSettings] = useState<ImportSettings>({
    allowCreateNew: true,
    updateExistingRecords: true,
    requireManualConfirmation: true
  })
  const [progress, setProgress] = useState<ImportProgress>({
    status: 'idle',
    processed: 0,
    total: 0,
    errors: []
  })
  const [matchingResults, setMatchingResults] = useState<Record<string, EmployerMatchResult>>({})
  const [processedData, setProcessedData] = useState<ProcessedIncolinkDataWithMatch[]>([])
  const [showMatchingDetails, setShowMatchingDetails] = useState(false)
  const [showManualSearch, setShowManualSearch] = useState(false)
  const [manualSearchEmployer, setManualSearchEmployer] = useState<ProcessedIncolinkDataWithMatch | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{id: string, name: string, abn: string | null, suburb: string | null, state: string | null}>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())

  // Process CSV data into structured format
  const processedIncolinkData = useMemo((): ProcessedIncolinkData[] => {
    return csvData.map((row, index) => ({
      employer_name: row.employer_name || row['company name'] || row.name || '',
      incolink_id: row.incolink_id || row['incolink_id'] || row.incolink_employer_id || '',
      row_index: index,
      original_data: row
    })).filter(data => data.employer_name && data.incolink_id)
  }, [csvData])

  // Helper function to create a new employer
  const createNewEmployer = async (record: ProcessedIncolinkDataWithMatch): Promise<string> => {
    const { data: newEmployer, error: employerError } = await supabase
      .from('employers')
      .insert({
        name: record.employer_name,
        employer_type: 'small_contractor',
        incolink_id: record.incolink_id,
        incolink_last_matched: new Date().toISOString().split('T')[0]
      })
      .select('id')
      .single()

    if (employerError) {
      throw new Error(`Failed to create employer: ${employerError.message}`)
    }
    
    return newEmployer.id
  }

  // Helper function to handle duplicate merging
  const handleDuplicateMerging = async (primaryId: string, duplicateIds: string[]) => {
    if (duplicateIds.length === 0) return
    
    try {
      const { data, error } = await supabase.rpc('merge_employers', {
        p_primary_employer_id: primaryId,
        p_duplicate_employer_ids: duplicateIds,
      })
      
      if (error) {
        console.error('Merge failed:', error)
        throw error
      }
      
      console.log('Merge successful:', data)
    } catch (error) {
      console.warn('Duplicate merging failed:', error)
      // Don't throw - continue with import even if merge fails
    }
  }

  // Step 1: Run matching algorithm
  const runMatching = async () => {
    setProgress({
      status: 'matching',
      processed: 0,
      total: processedIncolinkData.length,
      errors: []
    })

    try {
      const companyNames = processedIncolinkData.map(data => data.employer_name)
      const matchResults = await batchMatchEmployers(companyNames, {
        confidenceThreshold: 0.70,
        allowFuzzyMatching: true,
        requireUserConfirmation: importSettings.requireManualConfirmation
      })

      setMatchingResults(matchResults)
      
      // Process results and add to processed data
      const dataWithMatches = processedIncolinkData.map(data => ({
        ...data,
        matchResult: matchResults[data.employer_name],
        decision: matchResults[data.employer_name]?.match?.confidence === 'exact' 
          ? 'use_existing' 
          : undefined
      }))
      
      setProcessedData(dataWithMatches)
      setShowMatchingDetails(true)
      
      // Show statistics
      const stats = getMatchingStatistics(matchResults)
      toast({
        title: "Matching Complete",
        description: `Found ${stats.exactMatches} exact matches, ${stats.highConfidence + stats.mediumConfidence} fuzzy matches, and ${stats.noMatches} with no matches.`
      })
      
      setProgress(prev => ({ ...prev, status: 'idle' }))
    } catch (error) {
      console.error('Matching failed:', error)
      setProgress(prev => ({
        ...prev,
        status: 'error',
        errors: [...prev.errors, 'Matching failed: ' + (error as Error).message]
      }))
    }
  }

  // Manual search handler
  const handleManualSearch = async () => {
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const { data: employers, error } = await supabase
        .from('employers')
        .select('id, name, abn, suburb, state')
        .or(`name.ilike.*${searchQuery}*,abn.ilike.*${searchQuery}*`)
        .limit(20)

      if (error) throw error

      setSearchResults(employers || [])
    } catch (error) {
      console.error('Search failed:', error)
      toast({
        title: "Search Error",
        description: "Failed to search for employers",
        variant: "destructive"
      })
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }

  // Select employer from manual search
  const selectEmployerFromSearch = (employer: {id: string, name: string}) => {
    if (!manualSearchEmployer) return

    const newData = [...processedData]
    const index = newData.findIndex(d => d.row_index === manualSearchEmployer.row_index)
    if (index >= 0) {
      newData[index] = {
        ...newData[index],
        decision: 'use_existing',
        selectedEmployerId: employer.id,
        selectedEmployerName: employer.name
      }
      setProcessedData(newData)
    }

    // Close dialog and clear state
    setShowManualSearch(false)
    setManualSearchEmployer(null)
    setSearchQuery('')
    setSearchResults([])
  }

  // Step 2: Import with user decisions
  const runImport = async () => {
    const toProcess = processedData.filter(data => data.decision !== 'skip')
    
    if (toProcess.length === 0) {
      toast({
        title: "No Data to Import",
        description: "All records have been skipped.",
        variant: "destructive"
      })
      return
    }

    setProgress({
      status: 'importing',
      processed: 0,
      total: toProcess.length,
      errors: []
    })

    const results: ImportResults = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      mergedEmployers: 0
    }

    // Group by employer to handle duplicates
    const employerGroups = new Map<string, ProcessedIncolinkDataWithMatch[]>()
    
    for (const record of toProcess) {
      if (record.decision === 'use_existing' && record.selectedEmployerId) {
        const existing = employerGroups.get(record.selectedEmployerId) || []
        existing.push(record)
        employerGroups.set(record.selectedEmployerId, existing)
      } else if (record.decision === 'create_new') {
        // Each new employer gets its own group
        employerGroups.set(`new_${record.row_index}`, [record])
      }
    }

    // Process each employer group
    let processedCount = 0
    
    for (const [key, records] of employerGroups) {
      try {
        let employerId: string
        
        if (key.startsWith('new_')) {
          // Create new employer
          const record = records[0]
          setProgress(prev => ({ ...prev, currentEmployer: record.employer_name }))
          
          employerId = await createNewEmployer(record)
          results.imported++
        } else {
          // Update existing employer
          employerId = key
          const record = records[0]
          setProgress(prev => ({ ...prev, currentEmployer: record.employer_name }))
          
          // Check if this employer already has an Incolink ID
          const { data: existing, error: checkError } = await supabase
            .from('employers')
            .select('incolink_id')
            .eq('id', employerId)
            .single()
          
          if (checkError) throw checkError
          
          if (existing?.incolink_id && existing.incolink_id !== record.incolink_id) {
            results.errors.push(`Employer "${record.employer_name}" already has a different Incolink ID`)
            results.skipped++
          } else {
            // Update with Incolink ID
            const { error: updateError } = await supabase
              .from('employers')
              .update({ 
                incolink_id: record.incolink_id,
                incolink_last_matched: new Date().toISOString().split('T')[0]
              })
              .eq('id', employerId)
            
            if (updateError) throw updateError
            results.updated++
          }
        }
        
        processedCount++
        setProgress(prev => ({
          ...prev,
          processed: processedCount
        }))
        
      } catch (error) {
        console.error('Import error:', error)
        results.errors.push(`Failed to process: ${(error as Error).message}`)
      }
    }

    // Handle selected duplicates merging
    if (selectedDuplicates.size > 0) {
      try {
        const duplicateGroups = new Map<string, string[]>()
        
        // Group duplicates by their selected primary employer
        for (const recordIndex of selectedDuplicates) {
          const record = processedData.find(d => d.row_index === Number(recordIndex))
          if (record?.selectedEmployerId && record.matchResult?.candidates.length > 0) {
            const candidates = record.matchResult.candidates.map(c => c.id)
            duplicateGroups.set(record.selectedEmployerId, candidates)
          }
        }
        
        // Merge each group
        for (const [primaryId, duplicateIds] of duplicateGroups) {
          await handleDuplicateMerging(primaryId, duplicateIds)
          results.mergedEmployers++
        }
      } catch (error) {
        console.error('Duplicate merging failed:', error)
        results.errors.push('Some duplicate merges failed')
      }
    }

    setProgress(prev => ({ ...prev, status: 'completed' }))
    onImportComplete(results)
  }

  // Toggle row expansion
  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRows(newExpanded)
  }

  // Render matching results table
  const renderMatchingTable = () => {
    const stats = getMatchingStatistics(matchingResults)
    
    return (
      <div className="space-y-4">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Exact Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.exactMatches}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Fuzzy Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.highConfidence + stats.mediumConfidence}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">No Matches</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.noMatches}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Match Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.matchRate.toFixed(1)}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Matching Results Table */}
        <Card>
          <CardHeader>
            <CardTitle>Review Matches</CardTitle>
            <CardDescription>
              Confirm or adjust the employer matches before importing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employer Name</TableHead>
                    <TableHead>Incolink ID</TableHead>
                    <TableHead>Match Status</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedData.map((record, index) => {
                    const isExpanded = expandedRows.has(index)
                    const match = record.matchResult?.match
                    const candidates = record.matchResult?.candidates || []
                    
                    return (
                      <>
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div className="font-medium">{record.employer_name}</div>
                              {match && (
                                <div className="text-sm text-muted-foreground">
                                  → Matched: <span className="font-medium text-blue-600">{match.name}</span>
                                </div>
                              )}
                              {record.decision === 'use_existing' && record.selectedEmployerId && !match && (
                                <div className="text-sm text-muted-foreground">
                                  → Selected: <span className="font-medium text-green-600">{record.selectedEmployerName || 'Manual Selection'}</span>
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">
                              {record.incolink_id}
                            </code>
                          </TableCell>
                          <TableCell>
                            {match ? (
                              <Badge 
                                variant={
                                  match.confidence === 'exact' ? 'default' : 
                                  match.confidence === 'high' ? 'secondary' : 
                                  'outline'
                                }
                              >
                                {match.confidence} ({Math.round(match.score * 100)}%)
                              </Badge>
                            ) : (
                              <Badge variant="destructive">No Match</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <select
                                className="text-sm border rounded px-2 py-1"
                                value={record.decision || ''}
                                onChange={(e) => {
                                  const newData = [...processedData]
                                  const value = e.target.value as 'use_existing' | 'create_new' | 'skip' | ''
                                  newData[index] = {
                                    ...newData[index],
                                    decision: value === '' ? undefined : value,
                                    selectedEmployerId: value === 'use_existing' ? match?.id : undefined,
                                    selectedEmployerName: value === 'use_existing' ? match?.name : undefined
                                  }
                                  setProcessedData(newData)
                                }}
                              >
                                <option value="">Select action...</option>
                                {match && <option value="use_existing">Use existing</option>}
                                <option value="create_new">Create new</option>
                                <option value="skip">Skip</option>
                              </select>
                              
                              {/* Always show manual search button */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setManualSearchEmployer(record)
                                  setSearchQuery(record.employer_name) // Pre-populate with company name
                                  setShowManualSearch(true)
                                }}
                                title="Search for employer manually"
                              >
                                <Search className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {(candidates.length > 0 || (match && candidates.length > 0)) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleRowExpansion(index)}
                              >
                                {isExpanded ? <ChevronUp /> : <ChevronDown />}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        
                        {isExpanded && candidates.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-gray-50">
                              <div className="p-4 space-y-2">
                                <p className="text-sm font-medium mb-2">Alternative Matches:</p>
                                {candidates.map((candidate, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border">
                                    <div>
                                      <span className="font-medium">{candidate.name}</span>
                                      <Badge variant="outline" className="ml-2">
                                        {Math.round(candidate.score * 100)}% match
                                      </Badge>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        const newData = [...processedData]
                                        newData[index] = {
                                          ...newData[index],
                                          decision: 'use_existing',
                                          selectedEmployerId: candidate.id
                                        }
                                        setProcessedData(newData)
                                      }}
                                    >
                                      Use this
                                    </Button>
                                  </div>
                                ))}
                                
                                {/* Duplicate merge option */}
                                {candidates.length > 1 && (
                                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                    <label className="flex items-center gap-2">
                                      <Checkbox
                                        checked={selectedDuplicates.has(String(index))}
                                        onCheckedChange={(checked) => {
                                          const newSelected = new Set(selectedDuplicates)
                                          if (checked) {
                                            newSelected.add(String(index))
                                          } else {
                                            newSelected.delete(String(index))
                                          }
                                          setSelectedDuplicates(newSelected)
                                        }}
                                      />
                                      <span className="text-sm">
                                        These appear to be duplicates - merge after import
                                      </span>
                                    </label>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                // Auto-accept all exact matches
                const newData = processedData.map(record => {
                  if (record.matchResult?.match?.confidence === 'exact') {
                    return {
                      ...record,
                      decision: 'use_existing' as const,
                      selectedEmployerId: record.matchResult.match.id
                    }
                  }
                  return record
                })
                setProcessedData(newData)
                toast({
                  title: "Auto-accepted exact matches",
                  description: `Updated ${newData.filter(d => d.decision === 'use_existing').length} records`
                })
              }}
            >
              Auto-accept Exact Matches
            </Button>
            <Button
              onClick={runImport}
              disabled={!processedData.some(d => d.decision && d.decision !== 'skip')}
            >
              Import Selected ({processedData.filter(d => d.decision && d.decision !== 'skip').length})
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Import Incolink Data</h3>
        <p className="text-sm text-muted-foreground">
          Match Incolink employer IDs to existing employers using fuzzy name matching
        </p>
      </div>

      {/* Import Settings */}
      {progress.status === 'idle' && !showMatchingDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Import Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={importSettings.allowCreateNew}
                  onCheckedChange={(checked) => 
                    setImportSettings(prev => ({ ...prev, allowCreateNew: !!checked }))
                  }
                />
                Allow creating new employers for unmatched records
              </Label>
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={importSettings.updateExistingRecords}
                  onCheckedChange={(checked) => 
                    setImportSettings(prev => ({ ...prev, updateExistingRecords: !!checked }))
                  }
                />
                Update existing employer records with Incolink ID
              </Label>
              <Label className="flex items-center gap-2">
                <Checkbox
                  checked={importSettings.requireManualConfirmation}
                  onCheckedChange={(checked) => 
                    setImportSettings(prev => ({ ...prev, requireManualConfirmation: !!checked }))
                  }
                />
                Require manual confirmation for fuzzy matches
              </Label>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Found {processedIncolinkData.length} valid records to import.
                {csvData.length - processedIncolinkData.length > 0 && 
                  ` (${csvData.length - processedIncolinkData.length} rows skipped due to missing data)`
                }
              </AlertDescription>
            </Alert>

            <div className="flex justify-between">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button onClick={runMatching}>
                Start Matching
                <Link className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Indicator */}
      {progress.status === 'matching' && (
        <Card>
          <CardHeader>
            <CardTitle>Matching Employers...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={(progress.processed / progress.total) * 100} />
            <p className="text-sm text-muted-foreground">
              Processing {progress.processed} of {progress.total} records...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Matching Results */}
      {showMatchingDetails && progress.status !== 'importing' && renderMatchingTable()}

      {/* Import Progress */}
      {progress.status === 'importing' && (
        <Card>
          <CardHeader>
            <CardTitle>Importing Data...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={(progress.processed / progress.total) * 100} />
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Processing {progress.processed} of {progress.total} records...
              </p>
              {progress.currentEmployer && (
                <p className="text-sm">
                  Current: <span className="font-medium">{progress.currentEmployer}</span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Errors */}
      {progress.errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Import errors:</p>
              {progress.errors.map((error, idx) => (
                <p key={idx} className="text-sm">{error}</p>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Manual Search Dialog */}
      <Dialog open={showManualSearch} onOpenChange={setShowManualSearch}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Manual Employer Search</DialogTitle>
            <DialogDescription>
              Searching for: <strong>{manualSearchEmployer?.employer_name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name or ABN..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleManualSearch()}
              />
              <Button 
                onClick={handleManualSearch}
                disabled={isSearching || !searchQuery.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="p-3 bg-gray-50 border-b">
                  <h4 className="font-medium">Search Results ({searchResults.length})</h4>
                </div>
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-1">
                    {searchResults.map((employer) => (
                      <div
                        key={employer.id}
                        className="p-3 border-b last:border-b-0 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                        onClick={() => selectEmployerFromSearch(employer)}
                      >
                        <div className="flex-1">
                          <div className="font-medium">{employer.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {employer.abn && <span>ABN: {employer.abn}</span>}
                            {employer.abn && (employer.suburb || employer.state) && <span> • </span>}
                            {employer.suburb && <span>{employer.suburb}</span>}
                            {employer.suburb && employer.state && <span>, </span>}
                            {employer.state && <span>{employer.state}</span>}
                          </div>
                        </div>
                        <Button size="sm">
                          Select
                        </Button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            {/* No results message */}
            {!isSearching && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No employers found matching "{searchQuery}"</p>
                <p className="text-sm">Try different search terms or create a new employer</p>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowManualSearch(false)
                setSearchQuery('')
                setSearchResults([])
                setManualSearchEmployer(null)
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
