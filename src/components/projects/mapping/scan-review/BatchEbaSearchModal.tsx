"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FileSearch, Building2, CheckCircle2 } from 'lucide-react'
import { FwcEbaSearchModal } from '@/components/employers/FwcEbaSearchModal'

interface BatchEbaSearchModalProps {
  open: boolean
  onClose: () => void
  employers: Array<{
    id: string
    name: string
    trade: string
  }>
  onComplete: () => void
}

export function BatchEbaSearchModal({
  open,
  onClose,
  employers,
  onComplete
}: BatchEbaSearchModalProps) {
  const [currentEmployerIndex, setCurrentEmployerIndex] = useState(0)
  const [completedEmployers, setCompletedEmployers] = useState<Set<string>>(new Set())
  const [individualSearchOpen, setIndividualSearchOpen] = useState(false)

  const currentEmployer = employers[currentEmployerIndex]
  const isLastEmployer = currentEmployerIndex >= employers.length - 1
  const allCompleted = completedEmployers.size === employers.length

  const handleNext = () => {
    if (currentEmployer) {
      setCompletedEmployers(prev => new Set(prev).add(currentEmployer.id))
    }
    
    if (isLastEmployer) {
      onComplete()
    } else {
      setCurrentEmployerIndex(prev => prev + 1)
    }
  }

  const handleSkip = () => {
    if (isLastEmployer) {
      onComplete()
    } else {
      setCurrentEmployerIndex(prev => prev + 1)
    }
  }

  const handleSearchComplete = () => {
    setIndividualSearchOpen(false)
    handleNext()
  }

  if (!currentEmployer) {
    return null
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5" />
              Batch EBA Search ({currentEmployerIndex + 1} of {employers.length})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Alert>
              <AlertDescription>
                The following employers will have their EBA status set to <strong>Active</strong> based on the scanned mapping sheet. 
                Search FWC database to find and link their EBA details.
              </AlertDescription>
            </Alert>

            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-4">
              {employers.map((emp, index) => (
                <div key={emp.id} className="flex items-center">
                  <Badge 
                    variant={
                      index < currentEmployerIndex ? 'default' :
                      index === currentEmployerIndex ? 'secondary' : 
                      'outline'
                    }
                    className="text-xs"
                  >
                    {completedEmployers.has(emp.id) ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : null}
                    {index + 1}
                  </Badge>
                  {index < employers.length - 1 && <div className="w-4 h-px bg-gray-300 mx-1" />}
                </div>
              ))}
            </div>

            {/* Current employer details */}
            <div className="border rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-semibold text-blue-900">{currentEmployer.name}</div>
                  <div className="text-sm text-blue-700">Trade: {currentEmployer.trade}</div>
                </div>
              </div>
              <div className="text-sm text-blue-800">
                EBA status will be updated to: <strong>Active</strong>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleSkip}>
              Skip This Employer
            </Button>
            <Button onClick={() => setIndividualSearchOpen(true)}>
              <FileSearch className="h-4 w-4 mr-2" />
              Search FWC for EBA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual search for current employer */}
      {individualSearchOpen && currentEmployer && (
        <FwcEbaSearchModal
          isOpen={individualSearchOpen}
          onClose={() => setIndividualSearchOpen(false)}
          employerId={currentEmployer.id}
          employerName={currentEmployer.name}
          onLinkEba={handleSearchComplete}
        />
      )}
    </>
  )
}
