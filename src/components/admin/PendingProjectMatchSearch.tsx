'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Building2, ChevronRight, Plus, MapPin, DollarSign } from 'lucide-react';
import type { PendingProject, ProjectMatchSearchResult } from '@/types/pendingProjectReview';

interface PendingProjectMatchSearchProps {
  isOpen: boolean;
  onClose: () => void;
  pendingProject: PendingProject;
  onSelectExisting: (projectId: string) => void;
  onCreateNew: () => void;
}

export function PendingProjectMatchSearch({
  isOpen,
  onClose,
  pendingProject,
  onSelectExisting,
  onCreateNew,
}: PendingProjectMatchSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<ProjectMatchSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize search with pending project name
  useEffect(() => {
    if (isOpen && pendingProject) {
      setSearchTerm(pendingProject.name);
      performSearch(pendingProject.name);
    }
    if (!isOpen) {
      setResults([]);
      setHasSearched(false);
      setError(null);
    }
  }, [isOpen, pendingProject]);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/pending-projects/search?q=${encodeURIComponent(query)}&limit=40`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setResults(data.results || []);
      setHasSearched(true);
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResults([]);
      setHasSearched(true);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    performSearch(value);
  };

  const renderMatchBadges = (result: ProjectMatchSearchResult) => {
    const badges: JSX.Element[] = [];

    switch (result.matchType) {
      case 'name':
        badges.push(
          <Badge key="name" variant="default" className="bg-green-600">
            Name Match
          </Badge>
        );
        break;
      case 'address':
        badges.push(
          <Badge key="address" variant="secondary" className="flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Address
          </Badge>
        );
        break;
      case 'value':
        badges.push(
          <Badge key="value" variant="outline" className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Value
          </Badge>
        );
        break;
    }

    if (result.searchScore >= 90) {
      badges.push(
        <Badge key="score" variant="default" className="bg-emerald-500">
          {Math.round(result.searchScore)}% match
        </Badge>
      );
    } else if (result.searchScore >= 70) {
      badges.push(
        <Badge key="score" variant="secondary">
          {Math.round(result.searchScore)}% match
        </Badge>
      );
    } else {
      badges.push(
        <Badge key="score" variant="outline">
          {Math.round(result.searchScore)}% match
        </Badge>
      );
    }

    return badges;
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'Not specified';
    return `$${value.toLocaleString()}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search for Existing Project</DialogTitle>
          <DialogDescription>
            Searching for matches to: <strong>{pendingProject.name}</strong>
            <br />
            <span className="text-sm text-muted-foreground">
              Select an existing project to merge, or create a new project record.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects by name, address, or value..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Search Results */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {isSearching && (
              <div className="text-center py-8 text-muted-foreground">
                Searching...
              </div>
            )}

            {!isSearching && hasSearched && results.length === 0 && (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No matching projects found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different search term or create a new project
                </p>
              </div>
            )}

            {!isSearching && error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!isSearching && results.map((result) => (
              <Card
                key={result.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onSelectExisting(result.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-base">{result.name}</h4>
                          {renderMatchBadges(result)}
                        </div>
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        {result.value !== null && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(result.value)}
                          </div>
                        )}

                        {result.main_job_site?.full_address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {result.main_job_site.full_address}
                          </div>
                        )}

                        {(result.main_job_site?.suburb || result.main_job_site?.state || result.main_job_site?.postcode) && (
                          <div className="ml-4 text-xs">
                            {[
                              result.main_job_site?.suburb,
                              result.main_job_site?.state,
                              result.main_job_site?.postcode
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}

                        {result.builder && (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            Builder: {result.builder.name}
                          </div>
                        )}

                        {result.proposed_start_date && (
                          <div>
                            Start Date: {formatDate(result.proposed_start_date)}
                          </div>
                        )}

                        {result.matchDetails && (
                          <div className="text-xs text-muted-foreground pt-1 border-t mt-2">
                            Match details:
                            {result.matchDetails.nameSimilarity >= 70 && (
                              <span className="ml-1">
                                Name {Math.round(result.matchDetails.nameSimilarity)}%
                              </span>
                            )}
                            {result.matchDetails.addressSimilarity >= 70 && (
                              <span className="ml-1">
                                • Address {Math.round(result.matchDetails.addressSimilarity)}%
                              </span>
                            )}
                            {result.matchDetails.valueSimilarity >= 70 && (
                              <span className="ml-1">
                                • Value {Math.round(result.matchDetails.valueSimilarity)}%
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onCreateNew} className="gap-2">
              <Plus className="h-4 w-4" />
              Create New Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
