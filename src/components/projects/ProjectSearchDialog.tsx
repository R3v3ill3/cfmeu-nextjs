'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, Building2, MapPin, Hash, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/integrations/supabase/client'
import { useDebounce } from '@/hooks/useDebounce'
import { GoogleAddressInput, GoogleAddress } from '@/components/projects/GoogleAddressInput'
import { useAddressSearch, NearbyProject, formatDistance } from '@/hooks/useAddressSearch'

interface ProjectFromRPC {
  id: string
  name: string
  full_address: string | null
  builder_name: string | null
}

interface Project {
  id: string
  project_name: string
  project_address: string
  project_number: string | null
  builder: string | null
}

interface ProjectSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectProject: (project: Project) => void
  suggestedName?: string
}

export function ProjectSearchDialog({
  open,
  onOpenChange,
  onSelectProject,
  suggestedName = '',
}: ProjectSearchDialogProps) {
  // Search mode state
  const [searchMode, setSearchMode] = useState<'name' | 'address'>('name')

  // Name search state (existing)
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState<ProjectFromRPC[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Address search state (new)
  const [selectedAddress, setSelectedAddress] = useState<GoogleAddress | null>(null)

  // Address search hook
  const addressSearchQuery = useAddressSearch({
    lat: selectedAddress?.lat ?? null,
    lng: selectedAddress?.lng ?? null,
    address: selectedAddress?.formatted ?? null,
    enabled: searchMode === 'address' && !!selectedAddress?.lat && !!selectedAddress?.lng,
    maxResults: 20,
    maxDistanceKm: 100
  })

  // Reset when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSearchTerm('')
      setResults([])
      setHasSearched(false)
      setSelectedAddress(null)
      setSearchMode('name')
      return
    }
    // Set suggested name when dialog opens
    if (suggestedName) {
      setSearchTerm(suggestedName)
    }
  }, [open, suggestedName])

  // Search function
  const searchProjects = useCallback(async (query: string) => {
    setIsLoading(true)
    setHasSearched(true)

    const { data, error } = await supabase
      .rpc('search_projects_basic', {
        p_query: query.trim(),
      })

    if (error) {
      console.error('Project search error:', error)
      setResults([])
    } else {
      setResults((data as ProjectFromRPC[]) || [])
    }

    setIsLoading(false)
  }, [])

  // Run search when debounced search term changes
  useEffect(() => {
    if (!open) return

    if (!debouncedSearch || debouncedSearch.trim().length < 2) {
      setResults([])
      setHasSearched(false)
      return
    }

    searchProjects(debouncedSearch)
  }, [debouncedSearch, open, searchProjects])

  const handleSelect = (project: ProjectFromRPC) => {
    // Transform to expected format for parent component
    const transformedProject: Project = {
      id: project.id,
      project_name: project.name,
      project_address: project.full_address || '',
      project_number: null, // Not available from RPC
      builder: project.builder_name,
    }
    onSelectProject(transformedProject)
    onOpenChange(false)
  }

  const handleSelectNearbyProject = (nearbyProject: NearbyProject) => {
    // Transform nearby project to expected format
    const transformedProject: Project = {
      id: nearbyProject.project_id,
      project_name: nearbyProject.project_name,
      project_address: nearbyProject.job_site_address,
      project_number: null,
      builder: nearbyProject.builder_name,
    }
    onSelectProject(transformedProject)
    onOpenChange(false)
  }

  const handleCreateNew = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search for Existing Project</DialogTitle>
          <DialogDescription>
            Search by project name or find nearby projects by address
          </DialogDescription>
        </DialogHeader>

        <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as 'name' | 'address')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="name">
              <Search className="h-4 w-4 mr-2" />
              Search by Name
            </TabsTrigger>
            <TabsTrigger value="address">
              <Navigation className="h-4 w-4 mr-2" />
              Search by Address
            </TabsTrigger>
          </TabsList>

          {/* Name Search Tab */}
          <TabsContent value="name" className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="flex items-center gap-2 px-3 pb-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Type to search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                autoFocus={searchMode === 'name'}
              />
            </div>

            <Command className="border-t flex-1 overflow-hidden">
              <CommandList className="max-h-[400px]">
                {isLoading && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                )}

                {!isLoading && !hasSearched && (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </div>
                )}

                {!isLoading && hasSearched && results.length === 0 && (
                  <CommandEmpty>
                    <div className="py-6 text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        No matching projects found
                      </p>
                      <Button variant="outline" onClick={handleCreateNew}>
                        Create as New Project
                      </Button>
                    </div>
                  </CommandEmpty>
                )}

                {!isLoading && results.length > 0 && (
                  <CommandGroup heading={`${results.length} project${results.length !== 1 ? 's' : ''} found`}>
                    {results.map((project) => (
                      <CommandItem
                        key={project.id}
                        onSelect={() => handleSelect(project)}
                        className="cursor-pointer"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{project.name}</span>
                          </div>
                          {project.full_address && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground ml-6">
                              <MapPin className="h-3 w-3" />
                              <span>{project.full_address}</span>
                            </div>
                          )}
                          {project.builder_name && (
                            <div className="text-sm text-muted-foreground ml-6 mt-1">
                              Builder: {project.builder_name}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </TabsContent>

          {/* Address Search Tab */}
          <TabsContent value="address" className="flex-1 flex flex-col min-h-0 mt-4">
            <div className="px-3 pb-2">
              <GoogleAddressInput
                value={selectedAddress?.formatted || ''}
                onChange={setSelectedAddress}
                placeholder="Enter an address to find nearby projects..."
                showLabel={false}
              />
            </div>

            <div className="border-t flex-1 overflow-auto max-h-[400px]">
              {addressSearchQuery.isLoading && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Searching for nearby projects...
                </div>
              )}

              {!addressSearchQuery.isLoading && !selectedAddress?.lat && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Enter an address to find nearby projects
                </div>
              )}

              {!addressSearchQuery.isLoading && selectedAddress?.lat && addressSearchQuery.data && addressSearchQuery.data.length === 0 && (
                <div className="py-6 text-center">
                  <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No projects found within 100km of this address
                  </p>
                  <Button variant="outline" onClick={handleCreateNew}>
                    Create as New Project
                  </Button>
                </div>
              )}

              {!addressSearchQuery.isLoading && addressSearchQuery.data && addressSearchQuery.data.length > 0 && (
                <div className="divide-y">
                  <div className="px-4 py-2 bg-muted/50 font-medium text-sm">
                    {addressSearchQuery.data.length} project{addressSearchQuery.data.length !== 1 ? 's' : ''} found within 100km
                  </div>
                  {addressSearchQuery.data.map((project) => (
                    <button
                      key={project.project_id}
                      type="button"
                      className="w-full text-left px-4 py-3 hover:bg-accent transition-colors"
                      onClick={() => handleSelectNearbyProject(project)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{project.project_name}</span>
                        </div>
                        <Badge variant={project.is_exact_match ? "default" : "secondary"} className="flex-shrink-0">
                          {project.is_exact_match ? "EXACT MATCH" : formatDistance(project.distance_km)}
                        </Badge>
                      </div>
                      {project.job_site_address && (
                        <div className="flex items-start gap-1 text-sm text-muted-foreground ml-6 mb-1">
                          <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{project.job_site_address}</span>
                        </div>
                      )}
                      {project.builder_name && (
                        <div className="text-sm text-muted-foreground ml-6">
                          Builder: {project.builder_name}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {addressSearchQuery.error && (
                <div className="py-6 px-4 text-center">
                  <p className="text-sm text-destructive mb-2">
                    Error searching for nearby projects
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Please try again or use name search
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-4 border-t mt-auto">
          <Button variant="ghost" onClick={handleCreateNew}>
            Create as New Project
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
