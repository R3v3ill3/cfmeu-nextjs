"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Building2 } from 'lucide-react'
import { StatusSelectSimple } from '@/components/ui/StatusSelect'
import { TradeStatus } from '@/components/ui/StatusBadge'

interface AddAdditionalEmployerModalProps {
  open: boolean
  onClose: () => void
  trade: string
  tradeCode: string
  allEmployers: any[]
  currentEmployers: Array<{ id: string; name: string }>
  additionalEmployers: Array<{ id: string; name: string }>
  scannedEmployerId?: string | null
  onConfirm: (employerId: string, employerName: string, status: TradeStatus) => void
}

export function AddAdditionalEmployerModal({
  open,
  onClose,
  trade,
  tradeCode,
  allEmployers,
  currentEmployers,
  additionalEmployers,
  scannedEmployerId,
  onConfirm
}: AddAdditionalEmployerModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEmployer, setSelectedEmployer] = useState<any>(null)
  const [status, setStatus] = useState<TradeStatus>('active')

  // Build list of employer IDs to exclude (already assigned)
  const excludedEmployerIds = new Set([
    ...currentEmployers.map(e => e.id),
    ...additionalEmployers.map(e => e.id),
    ...(scannedEmployerId ? [scannedEmployerId] : [])
  ])

  // Filter employers:
  // 1. Match search term
  // 2. Exclude already assigned employers
  const filteredEmployers = allEmployers.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !excludedEmployerIds.has(emp.id)
  )

  const handleConfirm = () => {
    if (selectedEmployer) {
      onConfirm(selectedEmployer.id, selectedEmployer.name, status)
      // Reset modal state
      setSearchTerm('')
      setSelectedEmployer(null)
      setStatus('active')
    }
  }

  const handleClose = () => {
    // Reset state on close
    setSearchTerm('')
    setSelectedEmployer(null)
    setStatus('active')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 max-lg:text-base max-lg:leading-tight">
            <Building2 className="h-5 w-5 max-lg:h-4 max-lg:w-4" />
            <span className="max-lg:break-words max-lg:hyphens-auto">
              Add Additional Subcontractor for {trade}
            </span>
          </DialogTitle>
          <DialogDescription className="max-lg:text-sm">
            Search and select an employer to add to this trade. This will create an additional assignment (tender stage may have multiple employers).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-lg:space-y-3">
          {/* Search Input */}
          <div>
            <Label htmlFor="employer-search">Search Employers</Label>
            <Input
              id="employer-search"
              placeholder="Search by company name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>

          {/* Employer List (max height with scroll) */}
          <div className="border rounded-lg max-h-[300px] overflow-y-auto">
            {filteredEmployers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchTerm ? 'No employers found. Try different search terms.' : 'Start typing to search employers.'}
              </div>
            ) : (
              <div className="divide-y">
                {filteredEmployers.map(emp => (
                  <div
                    key={emp.id}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedEmployer?.id === emp.id
                        ? 'bg-blue-50 border-l-4 border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedEmployer(emp)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{emp.name}</div>
                      {emp.enterprise_agreement_status && (
                        <Badge variant="secondary" className="text-xs">Has EBA</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Selector - Only show when employer is selected */}
          {selectedEmployer && (
            <div>
              <Label htmlFor="assignment-status">Status for this Assignment</Label>
              <StatusSelectSimple
                value={status}
                onChange={setStatus}
                size="md"
              />
            </div>
          )}

          {/* Current Assignments Display */}
          {(currentEmployers.length > 0 || additionalEmployers.length > 0 || scannedEmployerId) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Currently assigned to {trade}:</strong>
                <ul className="mt-2 space-y-1">
                  {currentEmployers.map((emp, i) => (
                    <li key={`current-${i}`} className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Existing</Badge>
                      {emp.name}
                    </li>
                  ))}
                  {scannedEmployerId && (
                    <li className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">Scanned</Badge>
                      {allEmployers.find(e => e.id === scannedEmployerId)?.name || 'Scanned employer'}
                    </li>
                  )}
                  {additionalEmployers.map((emp, i) => (
                    <li key={`additional-${i}`} className="flex items-center gap-2">
                      <Badge className="text-xs bg-green-600">To Add</Badge>
                      {emp.name}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Selected Employer Confirmation */}
          {selectedEmployer && (
            <Alert className="border-blue-200 bg-blue-50">
              <Building2 className="h-4 w-4 text-blue-600" />
              <AlertDescription>
                <strong className="text-blue-900">Selected:</strong>
                <div className="mt-1 text-blue-900">{selectedEmployer.name}</div>
                <div className="mt-1 text-xs text-blue-700">
                  Will be added with status: <strong>{status}</strong>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="max-lg:flex-col max-lg:gap-2 max-lg:sticky max-lg:bottom-0 max-lg:bg-background max-lg:p-2 max-lg:-mx-6 max-lg:px-6 max-lg:border-t-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="max-lg:w-full max-lg:h-12 max-lg:text-base"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedEmployer}
            className="max-lg:w-full max-lg:h-12 max-lg:text-base"
          >
            Add Subcontractor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
