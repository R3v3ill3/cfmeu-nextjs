"use client"

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Building2, AlertCircle, Plus, Search, X, FileSearch } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { ConfidenceIndicator } from './ConfidenceIndicator'
import { EmployerMatchDialog } from './EmployerMatchDialog'
import { FwcEbaSearchModal } from '@/components/employers/FwcEbaSearchModal'
import { BatchEbaSearchModal } from './BatchEbaSearchModal'
import { findBestEmployerMatch } from '@/utils/fuzzyMatching'
import { useMappingSheetData } from '@/hooks/useMappingSheetData'
import { toast } from 'sonner'
import { StatusSelectSimple } from '@/components/ui/StatusSelect'
import { TradeStatus } from '@/components/ui/StatusBadge'

interface SubcontractorsReviewProps {
  extractedSubcontractors: Array<{
    stage: string
    trade: string
    company?: string
    eba?: boolean
  }>
  projectId?: string
  confidence: number[]
  onDecisionsChange: (decisions: any[]) => void
  allowProjectCreation?: boolean
}

const STAGE_LABELS: Record<string, string> = {
  early_works: 'Early Works',
  structure: 'Structure',
  finishing: 'Finishing',
  other: 'Other',
}

// Helper function to map trade names to codes (same as import route)
function mapTradeNameToCode(tradeName: string): string {
  const mapping: Record<string, string> = {
    'demo': 'demolition',
    'demolition': 'demolition',
    'piling': 'piling',
    'excavations': 'earthworks',
    'scaffold': 'scaffolding',
    'scaffolding': 'scaffolding',
    'cleaners': 'cleaning',
    'traffic control': 'traffic_control',
    'labour hire': 'labour_hire',
    'steel fixer': 'steel_fixing',
    'steel fixers': 'steel_fixing',
    'tower crane': 'tower_crane',
    'mobile crane': 'mobile_crane',
    'concreters': 'concreting',
    'concrete': 'concreting',
    'stressor': 'post_tensioning',
    'formwork': 'form_work',
    'bricklayer': 'bricklaying',
    'bricklaying': 'bricklaying',
    'structural steel': 'structural_steel',
    'facade': 'facade',
    'carpenter': 'carpentry',
    'carpentry': 'carpentry',
    'plasterer': 'plastering',
    'plastering': 'plastering',
    'painters': 'painting',
    'painting': 'painting',
    'tiling': 'tiling',
    'kitchens': 'kitchens',
    'flooring': 'flooring',
    'landscaping': 'landscaping',
    'final clean': 'cleaning',
  }

  const normalized = tradeName.toLowerCase().trim()
  return mapping[normalized] || normalized.replace(/\s+/g, '_')
}

export function SubcontractorsReview({
  extractedSubcontractors,
  projectId,
  confidence,
  onDecisionsChange,
  allowProjectCreation = false,
}: SubcontractorsReviewProps) {
  const [decisions, setDecisions] = useState<any[]>([])
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)
  const [selectedSubcontractor, setSelectedSubcontractor] = useState<any>(null)
  
  // EBA search state
  const [ebaSearchOpen, setEbaSearchOpen] = useState(false)
  const [batchEbaSearchOpen, setBatchEbaSearchOpen] = useState(false)
  const [selectedEbaEmployer, setSelectedEbaEmployer] = useState<{employerId: string, employerName: string} | null>(null)
  
  // Inline editing state for "other" trades with missing company names
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingCompanyName, setEditingCompanyName] = useState('')
  const [editingTradeName, setEditingTradeName] = useState('')

  // Fetch all employers for matching
  // NOTE: Removed the Supabase default row limit to ensure we get ALL employers
  // This is necessary for search functionality to work across the entire employer database
  const { data: allEmployers = [] } = useQuery({
    queryKey: ['employers-all'],
    queryFn: async () => {
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

        if (error) throw error
        
        if (!data || data.length === 0) break
        
        allData = allData.concat(data)
        
        // If we got less than a full page, we've reached the end
        if (data.length < pageSize) break
        
        from += pageSize
      }

      return allData
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes to avoid repeated pagination
  })

  // Get existing trade assignments for the project
  const { data: mappingData } = useMappingSheetData(projectId)

  // Initialize decisions with fuzzy matching and existing assignments
  useEffect(() => {
    // Only initialize if we have the required data and haven't initialized yet
    if (!allEmployers.length || !extractedSubcontractors.length) return
    if (decisions.length > 0) return // Already initialized
    
    const initial = extractedSubcontractors.map((sub, index) => {
      // Find ALL existing assignments for this trade (there can be multiple)
      const mappedTradeCode = mapTradeNameToCode(sub.trade)
      const existingAssignments = mappingData?.tradeContractors.filter(
        tc => tc.tradeType === mappedTradeCode
      ) || []

      if (!sub.company) {
        return {
          ...sub,
          action: 'skip',
          matchedEmployer: null,
          matchConfidence: 0,
          confidence: confidence[index] || 0,
          status: 'unknown' as TradeStatus, // Default for empty companies
          existingEmployers: existingAssignments.map(ea => ({
            id: ea.employerId,
            name: ea.employerName,
            assignmentId: ea.id
          })),
        }
      }

      // Attempt fuzzy match
      const match = findBestEmployerMatch(sub.company, allEmployers)

      return {
        ...sub,
        action: match && match.confidence === 'exact' ? 'import' : 'skip', // Default to skip to prevent accidental imports
        matchedEmployer: match || null,
        matchConfidence: match ? (match.confidence === 'exact' ? 1.0 : match.confidence === 'high' ? 0.8 : 0.6) : 0,
        confidence: confidence[index] || 0,
        needsReview: !match || match.confidence !== 'exact',
        status: 'active' as TradeStatus, // Default for companies with names
        existingEmployers: existingAssignments.map(ea => ({
          id: ea.employerId,
          name: ea.employerName,
          assignmentId: ea.id,
          keepDecision: true // Default to keeping existing assignments
        })),
        trade_type_code: mappedTradeCode,
        // Track EBA status changes
        shouldUpdateEbaStatus: sub.eba === true && match, // If scanned EBA = Yes and we have a match
      }
    })
    setDecisions(initial)
  }, [extractedSubcontractors, allEmployers, mappingData]) // Removed confidence and decisions from deps

  // Notify parent (only when decisions actually change, not on every render)
  useEffect(() => {
    const processedDecisions = decisions.map(decision => ({
      ...decision,
      // Include information about existing employers to keep/remove
      existingEmployersToKeep: decision.existingEmployers?.filter((e: any) => e.keepDecision) || [],
      existingEmployersToRemove: decision.existingEmployers?.filter((e: any) => !e.keepDecision) || [],
      // Only include scanned company if action is import or replace_one
      importScannedCompany: ['import', 'replace_one'].includes(decision.action) && decision.matchedEmployer,
    }))
    
    onDecisionsChange(processedDecisions)
  }, [decisions]) // Removed onDecisionsChange from deps to prevent infinite loop

  // Handle action change for subcontractor
  const handleActionChange = (index: number, action: 'import' | 'skip' | 'keep_existing' | 'replace_one') => {
    setDecisions(prev => {
      const updated = [...prev]
      updated[index].action = action
      return updated
    })
  }

  // Handle status change for subcontractor
  const handleStatusChange = (index: number, status: TradeStatus) => {
    setDecisions(prev => {
      const updated = [...prev]
      updated[index].status = status
      return updated
    })
  }

  const handleOpenMatchDialog = (index: number) => {
    setSelectedSubcontractor({ ...decisions[index], index })
    setMatchDialogOpen(true)
  }

  const handleMatchConfirm = async (employerId: string, employerName: string, isNewEmployer: boolean) => {
    if (selectedSubcontractor === null) return

    // Fetch current EBA status of matched employer
    let currentEbaStatus = false
    if (!isNewEmployer) {
      try {
        const { data: ebaData } = await supabase
          .from('employers')
          .select('enterprise_agreement_status')
          .eq('id', employerId)
          .single()
        
        currentEbaStatus = ebaData?.enterprise_agreement_status === true
      } catch (error) {
        console.error('Failed to fetch employer EBA status:', error)
      }
    }

    setDecisions(prev => {
      const updated = [...prev]
      updated[selectedSubcontractor.index] = {
        ...updated[selectedSubcontractor.index],
        action: 'import',
        matchedEmployer: {
          id: employerId,
          name: employerName,
          confidence: 'exact',
        },
        matchConfidence: 1.0,
        isNewEmployer,
        needsReview: false,
        currentEmployerEbaStatus: currentEbaStatus,
        shouldUpdateEbaStatus: updated[selectedSubcontractor.index].eba === true && !currentEbaStatus, // Need EBA update if scanned=Yes but employer=No
      }
      return updated
    })

    setMatchDialogOpen(false)
    setSelectedSubcontractor(null)
  }

  // Handle individual EBA search for a specific employer
  const handleIndividualEbaSearch = (employerId: string, employerName: string) => {
    setSelectedEbaEmployer({ employerId, employerName })
    setEbaSearchOpen(true)
  }

  // Handle batch EBA search for all employers needing EBA updates
  const handleBatchEbaSearch = () => {
    setBatchEbaSearchOpen(true)
  }

  // Handle inline editing for "other" trades with data entry errors
  const handleStartEdit = (index: number) => {
    const decision = decisions[index]
    setEditingIndex(index)
    // Pre-populate with current values - if company is missing, suggest using trade name
    setEditingCompanyName(decision.company || decision.trade)
    setEditingTradeName(decision.company ? decision.trade : '') // Clear trade if it's the company name
  }

  const handleSaveEdit = async (index: number) => {
    if (!editingCompanyName.trim()) {
      toast.error('Please enter a company name')
      return
    }

    // Try to find match for the edited company name
    const match = findBestEmployerMatch(editingCompanyName.trim(), allEmployers)

    setDecisions(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        company: editingCompanyName.trim(),
        trade: editingTradeName.trim() || updated[index].trade, // Keep original if not changed
        matchedEmployer: match || null,
        matchConfidence: match ? (match.confidence === 'exact' ? 1.0 : match.confidence === 'high' ? 0.8 : 0.6) : 0,
        action: match && match.confidence === 'exact' ? 'import' : 'skip',
        needsReview: !match || match.confidence !== 'exact',
        trade_type_code: mapTradeNameToCode(editingTradeName.trim() || updated[index].trade),
      }
      return updated
    })

    setEditingIndex(null)
    setEditingCompanyName('')
    setEditingTradeName('')

    if (match) {
      toast.success('Match found', { description: `Matched to: ${match.name}` })
    } else {
      toast.info('No match found', { description: 'You can manually search for the employer' })
    }
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditingCompanyName('')
    setEditingTradeName('')
  }

  // Get list of employers that need EBA status updated to Active
  const employersNeedingEbaUpdate = decisions
    .filter(d => d.action === 'import' && d.shouldUpdateEbaStatus && d.matchedEmployer)
    .map(d => ({
      id: d.matchedEmployer.id,
      name: d.matchedEmployer.name,
      trade: d.trade
    }))

  const needsReviewCount = decisions.filter(d => d.needsReview).length
  const needsEbaUpdateCount = employersNeedingEbaUpdate.length
  const needsEditingCount = decisions.filter(d => !d.company && d.stage === 'other').length

  return (
    <div className="space-y-4">
      {needsEditingCount > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {needsEditingCount} "Other" trade{needsEditingCount > 1 ? 's have' : ' has'} missing company names.
            This usually means the company name was entered in the wrong column.
            Click "Fix Entry" to correct the data.
          </AlertDescription>
        </Alert>
      )}
      
      {needsReviewCount > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {needsReviewCount} subcontractor{needsReviewCount > 1 ? 's' : ''} need manual employer matching review.
            Click "Review Match" to confirm or change the suggested employer.
          </AlertDescription>
        </Alert>
      )}

      {needsEbaUpdateCount > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <FileSearch className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between">
              <div>
                <strong>{needsEbaUpdateCount} employer{needsEbaUpdateCount > 1 ? 's' : ''} will have EBA status set to Active</strong>
                <br />
                <span className="text-sm">Search FWC database to find and link EBA details for these employers.</span>
              </div>
              {needsEbaUpdateCount > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchEbaSearch}
                  className="ml-4 gap-2"
                >
                  <FileSearch className="h-4 w-4" />
                  Batch Search All ({needsEbaUpdateCount})
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Subcontractors</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-w-full relative">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[6rem]">Stage</TableHead>
                  <TableHead className="min-w-[8rem]">Trade</TableHead>
                  <TableHead className="min-w-[12rem]">Current Employer</TableHead>
                  <TableHead className="min-w-[10rem]">Scanned Company</TableHead>
                  <TableHead className="min-w-[12rem]">Matched Employer</TableHead>
                  <TableHead className="min-w-[10rem]">Action</TableHead>
                  <TableHead className="min-w-[8rem]">Status</TableHead>
                  <TableHead className="min-w-[4rem]">EBA</TableHead>
                  <TableHead className="min-w-[6rem]">Confidence</TableHead>
                  <TableHead className="sticky right-0 bg-white min-w-[13rem] border-l border-gray-200 z-10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decisions.map((decision, index) => (
                  <TableRow key={index} className={decision.needsReview ? 'bg-yellow-50' : ''}>
                    <TableCell>
                      <Badge variant="outline">
                        {STAGE_LABELS[decision.stage] || decision.stage}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {editingIndex === index ? (
                        <Input
                          value={editingTradeName}
                          onChange={(e) => setEditingTradeName(e.target.value)}
                          placeholder="Enter correct trade type"
                          className="h-8 text-sm"
                        />
                      ) : (
                        decision.trade
                      )}
                    </TableCell>
                    
                    {/* Current Employers */}
                    <TableCell>
                      {decision.existingEmployers && decision.existingEmployers.length > 0 ? (
                        <div className="space-y-1">
                          {decision.existingEmployers.map((emp: any, empIndex: number) => (
                            <div key={emp.id} className="flex items-center gap-2 p-2 bg-green-50 rounded border">
                              <Building2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                              <span className="text-green-800 font-medium flex-1">{emp.name}</span>
                              <div className="flex items-center space-x-1">
                                <input
                                  type="checkbox"
                                  id={`keep-${index}-${empIndex}`}
                                  checked={emp.keepDecision}
                                  onChange={(e) => {
                                    setDecisions(prev => {
                                      const updated = [...prev]
                                      updated[index].existingEmployers[empIndex].keepDecision = e.target.checked
                                      return updated
                                    })
                                  }}
                                  className="h-3 w-3"
                                />
                                <Label htmlFor={`keep-${index}-${empIndex}`} className="text-xs cursor-pointer">
                                  Keep
                                </Label>
                              </div>
                            </div>
                          ))}
                          <div className="text-xs text-gray-500 mt-1">
                            {decision.existingEmployers.filter((e: any) => e.keepDecision).length} of {decision.existingEmployers.length} will be kept
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">None assigned</span>
                      )}
                    </TableCell>
                    
                    {/* Scanned Company */}
                    <TableCell>
                      {editingIndex === index ? (
                        <Input
                          value={editingCompanyName}
                          onChange={(e) => setEditingCompanyName(e.target.value)}
                          placeholder="Enter company name"
                          className="h-8 text-sm"
                        />
                      ) : (
                        decision.company || <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    
                    {/* Matched Employer */}
                    <TableCell>
                      {decision.matchedEmployer ? (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-blue-600" />
                          <span className="text-blue-800">{decision.matchedEmployer.name}</span>
                          {decision.isNewEmployer && (
                            <Badge variant="secondary" className="text-xs">New</Badge>
                          )}
                        </div>
                      ) : decision.company ? (
                        <span className="text-orange-600 text-sm">No match found</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    
                    {/* Action Selection */}
                    <TableCell>
                      <div className="space-y-2">
                        {/* Action for scanned company */}
                        <div className="text-xs font-medium text-gray-700 mb-2">Scanned Company Action:</div>
                        <RadioGroup 
                          value={decision.action} 
                          onValueChange={(value) => handleActionChange(index, value as any)}
                          className="space-y-1"
                        >
                          {decision.matchedEmployer && (
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="import" id={`${index}-import`} />
                              <Label htmlFor={`${index}-import`} className="text-xs cursor-pointer">
                                Add as new assignment
                              </Label>
                            </div>
                          )}
                          {decision.existingEmployers && decision.existingEmployers.length > 0 && decision.matchedEmployer && (
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="replace_one" id={`${index}-replace`} />
                              <Label htmlFor={`${index}-replace`} className="text-xs cursor-pointer">
                                Replace existing employer
                              </Label>
                            </div>
                          )}
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="skip" id={`${index}-skip`} />
                            <Label htmlFor={`${index}-skip`} className="text-xs cursor-pointer">
                              Skip scanned company
                            </Label>
                          </div>
                        </RadioGroup>
                        
                        {decision.action === 'replace_one' && decision.existingEmployers && decision.existingEmployers.length > 1 && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <div className="text-xs text-yellow-800 mb-1">Which employer should be replaced?</div>
                            <RadioGroup
                              value={decision.replaceEmployerId || ''}
                              onValueChange={(empId) => {
                                setDecisions(prev => {
                                  const updated = [...prev]
                                  updated[index].replaceEmployerId = empId
                                  return updated
                                })
                              }}
                            >
                              {decision.existingEmployers.map((emp: any) => (
                                <div key={emp.id} className="flex items-center space-x-2">
                                  <RadioGroupItem value={emp.id} id={`replace-${index}-${emp.id}`} />
                                  <Label htmlFor={`replace-${index}-${emp.id}`} className="text-xs cursor-pointer">
                                    {emp.name}
                                  </Label>
                                </div>
                              ))}
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    
                    {/* Status */}
                    <TableCell>
                      <StatusSelectSimple
                        value={decision.status || 'active'}
                        onChange={(status) => handleStatusChange(index, status)}
                        size="sm"
                      />
                    </TableCell>
                    
                    {/* EBA Status */}
                    <TableCell>
                      {decision.eba !== null && decision.eba !== undefined ? (
                        <Badge variant={decision.eba ? 'default' : 'secondary'}>
                          {decision.eba ? 'Yes' : 'No'}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </TableCell>
                    
                    {/* Confidence */}
                    <TableCell>
                      <ConfidenceIndicator confidence={decision.confidence} size="sm" />
                    </TableCell>
                    
                    {/* Actions */}
                    <TableCell className={`sticky right-0 min-w-[13rem] border-l border-gray-200 z-10 ${decision.needsReview ? 'bg-yellow-50' : 'bg-white'}`}>
                      <div className="space-y-1">
                        {editingIndex === index ? (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleSaveEdit(index)}
                              className="w-full"
                            >
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancelEdit}
                              className="w-full"
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            {!decision.company && decision.stage === 'other' && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleStartEdit(index)}
                                className="w-full"
                              >
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Fix Entry
                              </Button>
                            )}
                            {decision.company && (
                              <Button
                                variant={decision.needsReview ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleOpenMatchDialog(index)}
                                className="w-full"
                              >
                                {decision.needsReview ? (
                                  <>
                                    <AlertCircle className="h-3 w-3 mr-1" />
                                    Review
                                  </>
                                ) : (
                                  <>
                                    <Search className="h-3 w-3 mr-1" />
                                    Change
                                  </>
                                )}
                              </Button>
                            )}
                            
                            {/* Individual EBA Search - Show when employer matched and EBA status needs update */}
                            {decision.shouldUpdateEbaStatus && decision.matchedEmployer && decision.action === 'import' && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleIndividualEbaSearch(decision.matchedEmployer.id, decision.matchedEmployer.name)}
                                className="gap-1 w-full text-xs"
                                title={`Search Fair Work Commission EBA database for ${decision.matchedEmployer.name}`}
                              >
                                <FileSearch className="h-3 w-3" />
                                <span className="truncate">Search EBA</span>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Employer Match Dialog */}
      {matchDialogOpen && selectedSubcontractor && (
        <EmployerMatchDialog
          open={matchDialogOpen}
          onOpenChange={setMatchDialogOpen}
          companyName={selectedSubcontractor.company}
          suggestedMatch={selectedSubcontractor.matchedEmployer}
          allEmployers={allEmployers}
          onConfirm={handleMatchConfirm}
          tradeTypeCode={selectedSubcontractor.trade_type_code}
        />
      )}

      {/* Individual EBA Search Modal */}
      {ebaSearchOpen && selectedEbaEmployer && (
        <FwcEbaSearchModal
          isOpen={ebaSearchOpen}
          onClose={() => setEbaSearchOpen(false)}
          employerId={selectedEbaEmployer.employerId}
          employerName={selectedEbaEmployer.employerName}
          onLinkEba={() => {
            setEbaSearchOpen(false)
            // TODO: Refresh employer data to reflect new EBA status
          }}
        />
      )}

      {/* Batch EBA Search Modal */}
      {batchEbaSearchOpen && employersNeedingEbaUpdate.length > 0 && (
        <BatchEbaSearchModal
          open={batchEbaSearchOpen}
          onClose={() => setBatchEbaSearchOpen(false)}
          employers={employersNeedingEbaUpdate}
          onComplete={() => {
            setBatchEbaSearchOpen(false)
            // TODO: Refresh all employer data
          }}
        />
      )}
    </div>
  )
}
