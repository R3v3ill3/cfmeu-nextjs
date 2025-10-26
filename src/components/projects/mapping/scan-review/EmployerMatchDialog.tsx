"use client"

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Plus, Search, CheckCircle2, Tags, Sparkles } from 'lucide-react'
import { findBestEmployerMatch } from '@/utils/fuzzyMatching'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import { EmployerAliasManager } from './EmployerAliasManager'
import { useIsMobile } from '@/hooks/use-mobile'

interface EmployerMatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyName: string
  suggestedMatch: any
  allEmployers: any[]
  onConfirm: (employerId: string, employerName: string, isNewEmployer: boolean, extras?: { contractorType?: string }) => void
  allowContractorTypeSelection?: boolean
  tradeTypeCode?: string // The trade type for this subcontractor (e.g., 'cleaning', 'scaffolding')
}

export function EmployerMatchDialog({
  open,
  onOpenChange,
  companyName,
  suggestedMatch,
  allEmployers,
  onConfirm,
  allowContractorTypeSelection = false,
  tradeTypeCode,
}: EmployerMatchDialogProps) {
  const isMobile = useIsMobile()
  const [selectedOption, setSelectedOption] = useState<'suggested' | 'search' | 'new'>(
    suggestedMatch ? 'suggested' : 'search'
  )
  const [searchQuery, setSearchQuery] = useState(companyName) // Auto-populate with scanned company name
  const [selectedEmployerId, setSelectedEmployerId] = useState(suggestedMatch?.id || '')
  const [newEmployerName, setNewEmployerName] = useState(companyName)
  const [isCreating, setIsCreating] = useState(false)
  const [contractorType, setContractorType] = useState<string>('builder')
  const [employerType, setEmployerType] = useState<string>('small_contractor')
  const [showAliasManager, setShowAliasManager] = useState(false)
  const [selectedEmployerForAliases, setSelectedEmployerForAliases] = useState<any>(null)

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery) return []
    
    const query = searchQuery.toLowerCase()
    
    // Better search logic - includes partial word matching
    const matches = allEmployers
      .filter(emp => {
        const name = emp.name.toLowerCase()
        
        // Exact match has priority
        if (name === query) return true
        
        // Contains query
        if (name.includes(query)) return true
        
        // Query contains company name (handles "form" matching "formwork")
        if (query.includes(name)) return true
        
        // Word-based matching (handles "Superior Formwork" when searching "form")
        const nameWords = name.split(/\s+/)
        const queryWords = query.split(/\s+/)
        
        // Check if any name word starts with any query word
        for (const nameWord of nameWords) {
          for (const queryWord of queryWords) {
            if (nameWord.startsWith(queryWord) || queryWord.startsWith(nameWord)) {
              return true
            }
          }
        }
        
        return false
      })
      .sort((a, b) => {
        // Sort by relevance
        const aName = a.name.toLowerCase()
        const bName = b.name.toLowerCase()
        
        // Exact matches first
        if (aName === query && bName !== query) return -1
        if (bName === query && aName !== query) return 1
        
        // Then starts with query
        if (aName.startsWith(query) && !bName.startsWith(query)) return -1
        if (bName.startsWith(query) && !aName.startsWith(query)) return 1
        
        // Then alphabetical
        return aName.localeCompare(bName)
      })
      .slice(0, 200)
    
    return matches
  }, [searchQuery, allEmployers])

  const handleCreateNewEmployer = async () => {
    if (!newEmployerName.trim()) {
      toast.error('Please enter a company name')
      return
    }

    setIsCreating(true)

    try {
      // Create the employer with pending approval status
      const insertPayload: any = {
        name: newEmployerName.trim(),
        employer_type: employerType, // Required NOT NULL field
        enterprise_agreement_status: null, // null = unknown (boolean column can be true/false/null)
        approval_status: 'pending', // New employers need approval
      }

      const { data, error } = await supabase
        .from('employers')
        .insert(insertPayload)
        .select('id, name')
        .single()

      if (error) throw error

      // If we have a trade type, add it as a trade capability
      if (tradeTypeCode) {
        const { error: tradeError } = await supabase
          .from('contractor_trade_capabilities')
          .insert({
            employer_id: data.id,
            trade_type: tradeTypeCode,
            is_primary: true,
            notes: `Added from scanned mapping sheet`,
          })

        if (tradeError) {
          console.warn('Failed to add trade capability:', tradeError)
          // Don't fail the whole operation if trade capability insert fails
        }
      }

      toast.success('New employer created (pending approval)')
      onConfirm(data.id, data.name, true, {
        contractorType: allowContractorTypeSelection ? contractorType : undefined,
      })
    } catch (error) {
      console.error('Failed to create employer:', error)
      toast.error('Failed to create employer')
    } finally {
      setIsCreating(false)
    }
  }

  const handleConfirm = () => {
    if (selectedOption === 'suggested' && suggestedMatch) {
      onConfirm(suggestedMatch.id, suggestedMatch.name, false, {
        contractorType: allowContractorTypeSelection ? contractorType : undefined,
      })
    } else if (selectedOption === 'search' && selectedEmployerId) {
      const employer = allEmployers.find(e => e.id === selectedEmployerId)
      if (employer) {
        onConfirm(employer.id, employer.name, false, {
          contractorType: allowContractorTypeSelection ? contractorType : employer.contractor_type,
        })
      }
    } else if (selectedOption === 'new') {
      handleCreateNewEmployer()
    }
  }

  const handleManageAliases = (employer: any) => {
    setSelectedEmployerForAliases(employer)
    setShowAliasManager(true)
  }

  const handleAliasUpdate = () => {
    // Refresh search results to show any new aliases
    // This will trigger a re-evaluation of matches
    toast.success('Aliases updated', { description: 'Matching will use the new aliases' })
  }

  const handleSuggestAlias = () => {
    if (!selectedEmployerId) return

    const selectedEmployer = allEmployers.find(e => e.id === selectedEmployerId)
    if (!selectedEmployer) return

    setSelectedEmployerForAliases(selectedEmployer)
    setShowAliasManager(true)

    // Suggest creating an alias from the scanned company name
    setTimeout(() => {
      // This will be handled by the alias manager component
      toast.info('Suggesting alias', {
        description: `Consider adding "${companyName}" as an alias for ${selectedEmployer.name}`
      })
    }, 100)
  }

  const isValid = 
    (selectedOption === 'suggested' && suggestedMatch) ||
    (selectedOption === 'search' && selectedEmployerId) ||
    (selectedOption === 'new' && newEmployerName.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`
        ${isMobile
          ? 'w-[95vw] max-w-[95vw] max-h-[85vh] mx-4'
          : 'max-w-2xl max-h-[80vh]'
        } overflow-y-auto
      `}>
        <DialogHeader className={isMobile ? 'pb-4' : ''}>
          <DialogTitle className={`flex items-center gap-2 ${isMobile ? 'text-lg' : ''}`}>
            <Building2 className={`h-5 w-5 ${isMobile ? 'h-4 w-4' : ''}`} />
            <span className={isMobile ? 'text-lg' : ''}>
              {isMobile ? 'Match Employer' : `Match Employer for "${companyName}"`}
            </span>
          </DialogTitle>
          <DialogDescription className={isMobile ? 'text-sm' : ''}>
            {isMobile
              ? `Find or create an employer for "${companyName}"`
              : 'Search and match the scanned company to an existing employer, or create a new employer record'
            }
          </DialogDescription>
        </DialogHeader>

        <div className={`space-y-${isMobile ? '6' : '4'} py-${isMobile ? '6' : '4'}`}>
          <RadioGroup value={selectedOption} onValueChange={(val: any) => setSelectedOption(val)}>
            {/* Suggested Match */}
            {suggestedMatch && (
              <div className={`space-y-${isMobile ? '3' : '2'}`}>
                <div className={`flex items-center ${isMobile ? 'space-x-4' : 'space-x-2'}`}>
                  <RadioGroupItem
                    value="suggested"
                    id="suggested"
                    className={isMobile ? 'h-5 w-5' : ''}
                  />
                  <Label
                    htmlFor="suggested"
                    className={`font-medium cursor-pointer ${isMobile ? 'text-base' : ''}`}
                  >
                    {isMobile ? 'Suggested Match' : 'Use suggested match (recommended)'}
                  </Label>
                </div>
                {selectedOption === 'suggested' && (
                  <div className={`${isMobile ? 'ml-8 p-4' : 'ml-6 p-3'} bg-blue-50 border border-blue-200 rounded`}>
                    <div className={`flex ${isMobile ? 'flex-col space-y-3' : 'items-center justify-between'}`}>
                      <div className="flex-1">
                        <div className={`font-medium ${isMobile ? 'text-lg mb-2' : ''}`}>{suggestedMatch.name}</div>
                        <div className={`${isMobile ? 'text-base' : 'text-sm'} text-gray-600 mt-1`}>
                          Match confidence: {suggestedMatch.confidence}
                        </div>
                        {suggestedMatch.matchedAlias && (
                          <div className="flex items-center gap-1 mt-1">
                            <Sparkles className={`text-blue-600 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'}`} />
                            <span className={`${isMobile ? 'text-sm' : 'text-xs'} text-blue-600`}>
                              Matched via alias: "{suggestedMatch.matchedAlias}"
                            </span>
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 ${isMobile ? 'flex-col space-y-2 w-full' : ''}`}>
                        <Badge variant="default" className={isMobile ? 'text-sm py-1 px-3' : ''}>
                          {suggestedMatch.confidence === 'exact' ? 'Exact Match' :
                           suggestedMatch.confidence === 'high' ? 'High Confidence' :
                           'Possible Match'}
                        </Badge>
                        <Button
                          variant="outline"
                          size={isMobile ? "default" : "sm"}
                          onClick={() => handleManageAliases(suggestedMatch)}
                          className="gap-1"
                        >
                          <Tags className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />
                          {isMobile ? 'Manage Aliases' : 'Aliases'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search Existing */}
            <div className={`space-y-${isMobile ? '3' : '2'}`}>
              <div className={`flex items-center ${isMobile ? 'space-x-4' : 'space-x-2'}`}>
                <RadioGroupItem
                  value="search"
                  id="search"
                  className={isMobile ? 'h-5 w-5' : ''}
                />
                <Label
                  htmlFor="search"
                  className={`font-medium cursor-pointer ${isMobile ? 'text-base' : ''}`}
                >
                  {isMobile ? 'Search' : 'Search for different employer'}
                </Label>
              </div>
              {selectedOption === 'search' && (
                <div className={`${isMobile ? 'ml-8' : 'ml-6'} space-y-${isMobile ? '4' : '3'}`}>
                  <div className="relative">
                    <Search className={`absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 ${isMobile ? 'h-5 w-5 left-4' : 'h-4 w-4 left-3'}`} />
                    <Input
                      placeholder={isMobile ? "Search employers..." : "Search employer name..."}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`${isMobile ? 'pl-12 h-12 text-lg' : 'pl-10'}`}
                      inputMode="text"
                      autoComplete="off"
                      autoFocus={isMobile}
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className={`border rounded ${isMobile ? 'max-h-96' : 'max-h-64'} overflow-y-auto`}>
                      {searchResults.map((employer) => (
                        <label
                          key={employer.id}
                          className={`
                            flex items-center gap-3 cursor-pointer hover:bg-gray-50
                            ${isMobile ? 'p-4' : 'p-3'}
                            ${selectedEmployerId === employer.id ? 'bg-blue-50' : ''}
                          `}
                          onClick={() => setSelectedEmployerId(employer.id)}
                        >
                          <input
                            type="radio"
                            name="employer"
                            value={employer.id}
                            checked={selectedEmployerId === employer.id}
                            onChange={() => setSelectedEmployerId(employer.id)}
                            className={isMobile ? 'h-5 w-5' : 'h-4 w-4'}
                          />
                          <div className="flex-1">
                            <div className={`font-medium ${isMobile ? 'text-base' : ''}`}>{employer.name}</div>
                            {employer.matchedAlias && (
                              <div className="flex items-center gap-1 mt-1">
                                <Sparkles className={`text-blue-600 ${isMobile ? 'h-4 w-4' : 'h-3 w-3'}`} />
                                <span className={`${isMobile ? 'text-sm' : 'text-xs'} text-blue-600`}>
                                  Matched via alias: "{employer.matchedAlias}"
                                </span>
                              </div>
                            )}
                            {employer.enterprise_agreement_status !== 'unknown' && (
                              <div className={`${isMobile ? 'text-sm' : 'text-xs'} text-gray-500 mt-1`}>
                                EBA Status: {employer.enterprise_agreement_status}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size={isMobile ? "default" : "sm"}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleManageAliases(employer)
                            }}
                            className={`gap-1 ${isMobile ? 'h-11 px-3' : 'h-8 px-2'}`}
                          >
                            <Tags className={isMobile ? 'h-4 w-4' : 'h-3 w-3'} />
                            <span className={isMobile ? 'text-sm' : 'text-xs'}>
                              {isMobile ? 'Aliases' : 'Aliases'}
                            </span>
                          </Button>
                        </label>
                      ))}
                    </div>
                  )}
                  {searchQuery && searchResults.length === 0 && (
                    <Alert>
                      <AlertDescription className="text-sm">
                        No employers found matching "{searchQuery}"
                      </AlertDescription>
                    </Alert>
                  )}
                  {searchQuery && searchResults.length > 0 && selectedEmployerId && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-amber-800">
                          <Sparkles className="h-3 w-3 inline mr-1" />
                          The scanned name "{companyName}" doesn't exactly match "{allEmployers.find(e => e.id === selectedEmployerId)?.name}"
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSuggestAlias}
                          className="gap-1 h-7 text-xs"
                        >
                          <Plus className="h-3 w-3" />
                          Suggest Alias
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Create New */}
            <div className={`space-y-${isMobile ? '3' : '2'}`}>
              <div className={`flex items-center ${isMobile ? 'space-x-4' : 'space-x-2'}`}>
                <RadioGroupItem
                  value="new"
                  id="new"
                  className={isMobile ? 'h-5 w-5' : ''}
                />
                <Label
                  htmlFor="new"
                  className={`font-medium cursor-pointer ${isMobile ? 'text-base' : ''}`}
                >
                  Create new employer
                </Label>
              </div>
              {selectedOption === 'new' && (
                <div className={`${isMobile ? 'ml-8' : 'ml-6'} space-y-${isMobile ? '4' : '3'}`}>
                  <div>
                    <Label className={`${isMobile ? 'text-base' : 'text-sm'} mb-2 block`}>
                      Company Name
                    </Label>
                    <Input
                      placeholder="Company name"
                      value={newEmployerName}
                      onChange={(e) => setNewEmployerName(e.target.value)}
                      className={isMobile ? 'h-12 text-lg' : ''}
                      inputMode="text"
                      autoComplete="organization"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-sm mb-1.5 block">Employer Type</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'small_contractor', label: 'Small Contractor', description: '< 50 employees' },
                        { value: 'large_contractor', label: 'Large Contractor', description: '50+ employees' },
                        { value: 'principal_contractor', label: 'Principal Contractor', description: 'Head contractor' },
                        { value: 'builder', label: 'Builder', description: 'Building company' },
                        { value: 'individual', label: 'Individual', description: 'Sole trader' },
                      ].map(option => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={employerType === option.value ? 'default' : 'outline'}
                          size="sm"
                          className="justify-start h-auto py-2 px-3"
                          onClick={() => setEmployerType(option.value)}
                        >
                          <div className="text-left">
                            <div className="font-medium text-xs">{option.label}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{option.description}</div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div className={`space-y-${isMobile ? '2' : '1'}`}>
                    <p className={`${isMobile ? 'text-sm' : 'text-xs'} text-gray-500`}>
                      {isMobile
                        ? 'New employer requires approval before activation.'
                        : 'A new employer record will be created with pending approval status.'
                      }
                    </p>
                    {tradeTypeCode && (
                      <p className={`${isMobile ? 'text-sm' : 'text-xs'} text-blue-600`}>
                        ✓ Will be tagged with trade: <strong>{tradeTypeCode.replace(/_/g, ' ')}</strong>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </RadioGroup>
        </div>

          {allowContractorTypeSelection && (
            <div className="space-y-2">
              <Label className="font-medium">Role for this employer</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'builder', label: 'Builder / Head Contractor' },
                  { value: 'trade_contractor', label: 'Trade Contractor' },
                  { value: 'labour_hire', label: 'Labour Hire' },
                  { value: 'consultant', label: 'Consultant' },
                ].map(option => (
                  <Button
                    key={option.value}
                    type="button"
                    variant={contractorType === option.value ? 'default' : 'outline'}
                    size="sm"
                    className="justify-start"
                    onClick={() => setContractorType(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                This helps pre-fill the correct role when importing the employer.
              </p>
            </div>
          )}

        <DialogFooter className={`${isMobile ? 'flex-col space-y-3' : ''}`}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={isMobile ? 'h-12 text-lg w-full' : ''}
          >
            {isMobile ? 'Cancel' : 'Cancel'}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isCreating}
            className={isMobile ? 'h-12 text-lg w-full' : ''}
          >
            {isCreating ? (
              isMobile ? 'Creating...' : 'Creating...'
            ) : (
              <>
                <CheckCircle2 className={`${isMobile ? 'h-5 w-5' : 'h-4 w-4'} mr-2`} />
                {isMobile ? 'Confirm' : 'Confirm Match'}
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Alias Manager Dialog */}
        {showAliasManager && selectedEmployerForAliases && (
          <EmployerAliasManager
            employerId={selectedEmployerForAliases.id}
            employerName={selectedEmployerForAliases.name}
            isOpen={showAliasManager}
            onOpenChange={setShowAliasManager}
            onAliasUpdate={handleAliasUpdate}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
