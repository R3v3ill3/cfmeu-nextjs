"use client"

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Building2, Plus, Search, CheckCircle2 } from 'lucide-react'
import { findBestEmployerMatch } from '@/utils/fuzzyMatching'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'

interface EmployerMatchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyName: string
  suggestedMatch: any
  allEmployers: any[]
  onConfirm: (employerId: string, employerName: string, isNewEmployer: boolean, extras?: { contractorType?: string }) => void
  allowContractorTypeSelection?: boolean
}

export function EmployerMatchDialog({
  open,
  onOpenChange,
  companyName,
  suggestedMatch,
  allEmployers,
  onConfirm,
  allowContractorTypeSelection = false,
}: EmployerMatchDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'suggested' | 'search' | 'new'>(
    suggestedMatch ? 'suggested' : 'search'
  )
  const [searchQuery, setSearchQuery] = useState(companyName) // Auto-populate with scanned company name
  const [selectedEmployerId, setSelectedEmployerId] = useState(suggestedMatch?.id || '')
  const [newEmployerName, setNewEmployerName] = useState(companyName)
  const [isCreating, setIsCreating] = useState(false)
  const [contractorType, setContractorType] = useState<string>('builder')

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
      // Note: contractor_type field doesn't exist in employers table yet
      // For now, just create the employer with basic info
      const insertPayload: any = {
        name: newEmployerName.trim(),
        enterprise_agreement_status: 'unknown',
      }

      // TODO: Add contractor_type field to employers table schema
      // if (allowContractorTypeSelection && contractorType) {
      //   insertPayload.contractor_type = contractorType
      // }

      const { data, error } = await supabase
        .from('employers')
        .insert(insertPayload)
        .select('id, name')
        .single()

      if (error) throw error

      toast.success('New employer created')
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

  const isValid = 
    (selectedOption === 'suggested' && suggestedMatch) ||
    (selectedOption === 'search' && selectedEmployerId) ||
    (selectedOption === 'new' && newEmployerName.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Match Employer for "{companyName}"
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={selectedOption} onValueChange={(val: any) => setSelectedOption(val)}>
            {/* Suggested Match */}
            {suggestedMatch && (
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="suggested" id="suggested" />
                  <Label htmlFor="suggested" className="font-medium cursor-pointer">
                    Use suggested match (recommended)
                  </Label>
                </div>
                {selectedOption === 'suggested' && (
                  <div className="ml-6 p-3 bg-blue-50 border border-blue-200 rounded">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{suggestedMatch.name}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          Match confidence: {suggestedMatch.confidence}
                        </div>
                      </div>
                      <Badge variant="default">
                        {suggestedMatch.confidence === 'exact' ? 'Exact Match' : 
                         suggestedMatch.confidence === 'high' ? 'High Confidence' : 
                         'Possible Match'}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search Existing */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="search" id="search" />
                <Label htmlFor="search" className="font-medium cursor-pointer">
                  Search for different employer
                </Label>
              </div>
              {selectedOption === 'search' && (
                <div className="ml-6 space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search employer name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {searchResults.length > 0 && (
                    <div className="border rounded max-h-64 overflow-y-auto">
                      {searchResults.map((employer) => (
                        <label
                          key={employer.id}
                          className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 ${
                            selectedEmployerId === employer.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => setSelectedEmployerId(employer.id)}
                        >
                          <input
                            type="radio"
                            name="employer"
                            value={employer.id}
                            checked={selectedEmployerId === employer.id}
                            onChange={() => setSelectedEmployerId(employer.id)}
                            className="h-4 w-4"
                          />
                          <div className="flex-1">
                            <div className="font-medium">{employer.name}</div>
                            {employer.enterprise_agreement_status !== 'unknown' && (
                              <div className="text-xs text-gray-500 mt-1">
                                EBA Status: {employer.enterprise_agreement_status}
                              </div>
                            )}
                          </div>
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
                </div>
              )}
            </div>

            {/* Create New */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new" className="font-medium cursor-pointer">
                  Create new employer
                </Label>
              </div>
              {selectedOption === 'new' && (
                <div className="ml-6 space-y-2">
                  <Input
                    placeholder="Company name"
                    value={newEmployerName}
                    onChange={(e) => setNewEmployerName(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    A new employer record will be created in the database.
                  </p>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || isCreating}>
            {isCreating ? (
              'Creating...'
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Confirm Match
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
