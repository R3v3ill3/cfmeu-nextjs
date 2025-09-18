"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { Search, ExternalLink, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface FwcSearchModalProps {
  isOpen: boolean
  onClose: () => void
  employerId: string
  employerName: string
}

interface FWCSearchResult {
  title: string
  registrationCode: string
  description: string
  url: string
  relevanceScore?: number
}

export function FwcSearchModal({ isOpen, onClose, employerId, employerName }: FwcSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState(employerName)
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<FWCSearchResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      toast({
        title: "Search Required",
        description: "Please enter a search term",
        variant: "destructive"
      })
      return
    }

    setIsSearching(true)
    setError(null)
    setResults([])

    try {
      const response = await fetch(`/api/fwc-search?q=${encodeURIComponent(searchTerm)}`)
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }

      const data = await response.json()
      setResults(data.results || [])
      
      toast({
        title: "Search Complete",
        description: `Found ${data.results?.length || 0} results`,
      })
    } catch (error) {
      console.error('FWC search error:', error)
      setError(error instanceof Error ? error.message : 'Search failed')
      toast({
        title: "Search Failed",
        description: "Failed to search FWC database",
        variant: "destructive"
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleAssignEba = async (result: FWCSearchResult) => {
    try {
      // This would typically call an API to create/assign the EBA record
      toast({
        title: "EBA Assignment",
        description: `Would assign "${result.title}" to ${employerName}`,
      })
      
      // For now, just close the modal
      onClose()
    } catch (error) {
      toast({
        title: "Assignment Failed", 
        description: "Failed to assign EBA to employer",
        variant: "destructive"
      })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-blue-500" />
            Search FWC Database
          </DialogTitle>
          <DialogDescription>
            Search for Enterprise Bargaining Agreements for <strong>{employerName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter company name or search term..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {results.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Search Results</h3>
                <Badge variant="outline">{results.length} results</Badge>
              </div>
              
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <h4 className="font-medium">{result.title}</h4>
                      <p className="text-sm text-gray-600">{result.description}</p>
                      {result.registrationCode && (
                        <Badge variant="secondary" className="text-xs">
                          {result.registrationCode}
                        </Badge>
                      )}
                      {result.relevanceScore && (
                        <Badge 
                          variant="outline" 
                          className="text-xs ml-2"
                        >
                          {Math.round(result.relevanceScore * 100)}% match
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a 
                          href={result.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleAssignEba(result)}
                      >
                        Assign to Employer
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isSearching && !error && results.length === 0 && searchTerm !== employerName && (
            <div className="text-center text-gray-500 py-8">
              No results found. Try different search terms.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
