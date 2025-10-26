'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Building, ChevronRight, Plus, Link2, Tag, UserCheck } from 'lucide-react';
import type { PendingEmployer, MatchSearchResult } from '@/types/pendingEmployerReview';
import { useAliasAwareEmployerSearch } from '@/hooks/useAliasAwareEmployerSearch';

interface PendingEmployerMatchSearchProps {
  isOpen: boolean;
  onClose: () => void;
  pendingEmployer: PendingEmployer;
  onSelectExisting: (employerId: string) => void;
  onCreateNew: () => void;
}

export function PendingEmployerMatchSearch({
  isOpen,
  onClose,
  pendingEmployer,
  onSelectExisting,
  onCreateNew,
}: PendingEmployerMatchSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const [{ results: rawResults, isSearching, hasSearched, error }, { search, clear }] =
    useAliasAwareEmployerSearch({ limit: 40, includeAliases: true, aliasMatchMode: 'any' });

  // Filter out the pending employer itself from results
  const results = rawResults.filter(result => result.id !== pendingEmployer.id);

  // Initialize search with pending employer name
  useEffect(() => {
    if (isOpen && pendingEmployer) {
      setSearchTerm(pendingEmployer.name);
      search(pendingEmployer.name);
    }
    if (!isOpen) {
      clear();
    }
  }, [clear, isOpen, pendingEmployer, search]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    search(value);
  };

  const renderMatchBadges = (result: MatchSearchResult) => {
    const badges: React.ReactElement[] = [];

    switch (result.matchType) {
      case 'canonical_name':
        badges.push(
          <Badge key="canonical" variant="default" className="bg-green-600">
            Name Match
          </Badge>
        );
        break;
      case 'alias':
        badges.push(
          <Badge key="alias" variant="secondary" className="flex items-center gap-1">
            <Tag className="h-3 w-3" /> Alias
          </Badge>
        );
        break;
      case 'external_id':
        badges.push(
          <Badge key="external" variant="outline" className="flex items-center gap-1">
            <Link2 className="h-3 w-3" /> External ID
          </Badge>
        );
        break;
      case 'abn':
        badges.push(
          <Badge key="abn" variant="outline">ABN Match</Badge>
        );
        break;
    }

    if (result.searchScore >= 90) {
      badges.push(
        <Badge key="score" variant="default" className="bg-emerald-500">
          Score {Math.round(result.searchScore)}
        </Badge>
      );
    } else if (result.searchScore >= 70) {
      badges.push(
        <Badge key="score" variant="secondary">
          Score {Math.round(result.searchScore)}
        </Badge>
      );
    } else {
      badges.push(
        <Badge key="score" variant="outline">
          Score {Math.round(result.searchScore)}
        </Badge>
      );
    }

    if (result.enterprise_agreement_status) {
      badges.push(
        <Badge key="eba" variant="outline" className="flex items-center gap-1 border-green-500 text-green-700">
          <UserCheck className="h-3 w-3" /> EBA
        </Badge>
      );
    }

    return badges;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Search for Existing Employer</DialogTitle>
          <DialogDescription>
            Searching for matches to: <strong>{pendingEmployer.name}</strong>
            <br />
            <span className="text-sm text-muted-foreground">
              Select an existing employer to merge, or create a new employer record.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employers by name..."
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
                <Building className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No matching employers found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try a different search term or create a new employer
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
                        {result.matchType === 'alias' && result.matchedAlias && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Matched alias: <span className="font-medium">{result.matchedAlias}</span>
                          </p>
                        )}
                        {result.externalIdMatch && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Matched via {result.externalIdMatch.toUpperCase()} ID
                          </p>
                        )}
                      </div>

                      <div className="space-y-1 text-sm text-muted-foreground">
                        {result.employer_type && (
                          <div>Type: {result.employer_type.replace(/_/g, ' ')}</div>
                        )}
                        {(result.address_line_1 || result.suburb || result.state || result.postcode) && (
                          <div>
                            {[result.address_line_1, result.suburb, result.state, result.postcode]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-4">
                          {result.phone && <span>📞 {result.phone}</span>}
                          {result.email && <span>✉️ {result.email}</span>}
                        </div>
                        {result.website && (
                          <div className="text-blue-600">🌐 {result.website}</div>
                        )}
                        {result.aliases && result.aliases.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Known aliases: {result.aliases.slice(0, 3).map((alias) => alias.alias).join(', ')}
                            {result.aliases.length > 3 && '…'}
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
              Create New Employer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


