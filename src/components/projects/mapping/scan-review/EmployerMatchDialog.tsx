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
  onConfirm: (employerId: string, employerName: string, isNewEmployer: boolean) => void
}

export function EmployerMatchDialog({
  open,
  onOpenChange,
  companyName,
  suggestedMatch,
  allEmployers,
  onConfirm,
}: EmployerMatchDialogProps) {
  const [selectedOption, setSelectedOption] = useState<'suggested' | 'search' | 'new'>(
    suggestedMatch ? 'suggested' : 'search'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedEmployerId, setSelectedEmployerId] = useState(suggestedMatch?.id || '')
  const [newEmployerName, setNewEmployerName] = useState(companyName)
  const [isCreating, setIsCreating] = useState(false)

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery) return []
    
    const match = findBestEmployerMatch(searchQuery, allEmployers)
    if (match) {
      // Return top matches with similar names
      return allEmployers
        .filter(emp => {
          const query = searchQuery.toLowerCase()
          const name = emp.name.toLowerCase()
          return name.includes(query) || query.includes(name)
        })
        .slice(0, 10)
    }
    return []
  }, [searchQuery, allEmployers])

  const handleCreateNewEmployer = async () => {
    if (!newEmployerName.trim()) {
      toast.error('Please enter a company name')
      return
    }

    setIsCreating(true)

    try {
      const { data, error } = await supabase
        .from('employers')
        .insert({
          name: newEmployerName.trim(),
          enterprise_agreement_status: 'unknown',
        })
        .select('id, name')
        .single()

      if (error) throw error

      toast.success('New employer created')
      onConfirm(data.id, data.name, true)
    } catch (error) {
      console.error('Failed to create employer:', error)
      toast.error('Failed to create employer')
    } finally {
      setIsCreating(false)
    }
  }

  const handleConfirm = () => {
    if (selectedOption === 'suggested' && suggestedMatch) {
      onConfirm(suggestedMatch.id, suggestedMatch.name, false)
    } else if (selectedOption === 'search' && selectedEmployerId) {
      const employer = allEmployers.find(e => e.id === selectedEmployerId)
      if (employer) {
        onConfirm(employer.id, employer.name, false)
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
