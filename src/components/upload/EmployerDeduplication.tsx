'use client';

import {  useState, useCallback, useEffect  } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Check,
  Building2,
  ArrowRight,
  Loader2,
  Eye,
  Merge,
  X
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { searchForDuplicates, EmployerSimilarity, DuplicateSearchResult } from '@/utils/employerDuplication';

interface Employer {
  id: string;
  name: string;
  address_line_1?: string;
  suburb?: string;
  state?: string;
  employer_type?: string;
  abn?: string;
  estimated_worker_count?: number;
}

interface EmployerDeduplicationProps {
  /** Optional initial search term */
  initialSearchTerm?: string;
  /** Called when merge is completed */
  onMergeComplete?: (primaryEmployerId: string, mergedEmployerIds: string[]) => void;
}

export default function EmployerDeduplication({ 
  initialSearchTerm = '', 
  onMergeComplete 
}: EmployerDeduplicationProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [isSearching, setIsSearching] = useState(false);
  const [allEmployers, setAllEmployers] = useState<Employer[]>([]);
  const [searchResults, setSearchResults] = useState<DuplicateSearchResult | null>(null);
  const [selectedEmployers, setSelectedEmployers] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [expandedEmployer, setExpandedEmployer] = useState<string | null>(null);
  
  const { toast } = useToast();
  const supabase = getSupabaseBrowserClient();

  // Load all employers for comparison
  useEffect(() => {
    loadAllEmployers();
  }, []);

  const loadAllEmployers = async () => {
    try {
      const { data, error } = await supabase
        .from('employers')
        .select('id, name, address_line_1, suburb, state, employer_type, abn, estimated_worker_count')
        .order('name');

      if (error) throw error;
      setAllEmployers(data || []);
    } catch (error) {
      console.error('Error loading employers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employers for comparison',
        variant: 'destructive'
      });
    }
  };

  const performSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const results = searchForDuplicates(searchTerm, allEmployers, {
        exactMatchThreshold: 0.95,
        similarMatchThreshold: 0.7,
        maxResults: 20
      });

      setSearchResults(results);
      
      if (!results.hasExactMatch && !results.hasSimilarMatches) {
        toast({
          title: 'No duplicates found',
          description: `No similar employers found for "${searchTerm}"`,
        });
      }
    } catch (error) {
      console.error('Error searching for duplicates:', error);
      toast({
        title: 'Search failed',
        description: 'Failed to search for duplicate employers',
        variant: 'destructive'
      });
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, allEmployers, toast]);

  const handleSearch = () => {
    performSearch();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const toggleEmployerSelection = (employerId: string) => {
    setSelectedEmployers(prev => {
      const updated = new Set(prev);
      if (updated.has(employerId)) {
        updated.delete(employerId);
      } else {
        updated.add(employerId);
      }
      return updated;
    });
  };

  const selectAllExactMatches = () => {
    if (searchResults?.exactMatches) {
      const exactIds = searchResults.exactMatches.map(match => match.id);
      setSelectedEmployers(new Set(exactIds));
    }
  };

  const mergeAllExactMatches = async () => {
    if (!searchResults?.exactMatches || searchResults.exactMatches.length < 2) {
      toast({
        title: 'No exact matches to merge',
        description: 'Need at least 2 exact matches to perform automatic merge',
        variant: 'destructive'
      });
      return;
    }

    // Auto-select the first match as primary (usually the oldest/most complete record)
    const primaryEmployer = searchResults.exactMatches[0];
    const duplicateIds = searchResults.exactMatches.slice(1).map(match => match.id);

    setIsMerging(true);
    try {
      const { data, error } = await supabase.rpc('merge_employers', {
        p_primary_employer_id: primaryEmployer.id,
        p_duplicate_employer_ids: duplicateIds,
      });

      if (error) throw error;

      toast({
        title: 'Auto-merge successful',
        description: `Merged ${duplicateIds.length} exact duplicate employers into "${primaryEmployer.name}"`,
      });

      // Refresh employers list
      await loadAllEmployers();
      
      // Clear search results and selection
      setSearchResults(null);
      setSelectedEmployers(new Set());
      setSearchTerm('');

      // Notify parent component
      if (onMergeComplete) {
        onMergeComplete(primaryEmployer.id, duplicateIds);
      }

    } catch (error) {
      console.error('Error auto-merging exact matches:', error);
      toast({
        title: 'Auto-merge failed',
        description: error instanceof Error ? error.message : 'Failed to merge exact matches',
        variant: 'destructive'
      });
    } finally {
      setIsMerging(false);
    }
  };

  const clearSelection = () => {
    setSelectedEmployers(new Set());
  };

  const initiateMerge = () => {
    if (selectedEmployers.size < 2) {
      toast({
        title: 'Selection required',
        description: 'Please select at least 2 employers to merge',
        variant: 'destructive'
      });
      return;
    }
    setShowMergeDialog(true);
  };

  const performMerge = async (primaryEmployerId: string) => {
    const employerIds = Array.from(selectedEmployers);
    const duplicateIds = employerIds.filter(id => id !== primaryEmployerId);

    if (duplicateIds.length === 0) {
      toast({
        title: 'Invalid selection',
        description: 'No duplicate employers to merge',
        variant: 'destructive'
      });
      return;
    }

    setIsMerging(true);
    try {
      const { data, error } = await supabase.rpc('merge_employers', {
        p_primary_employer_id: primaryEmployerId,
        p_duplicate_employer_ids: duplicateIds,
      });

      if (error) throw error;

      toast({
        title: 'Merge successful',
        description: `Successfully merged ${duplicateIds.length} duplicate employers`,
      });

      // Refresh employers list
      await loadAllEmployers();
      
      // Clear search results and selection
      setSearchResults(null);
      setSelectedEmployers(new Set());
      setSearchTerm('');
      setShowMergeDialog(false);

      // Notify parent component
      if (onMergeComplete) {
        onMergeComplete(primaryEmployerId, duplicateIds);
      }

    } catch (error) {
      console.error('Error merging employers:', error);
      toast({
        title: 'Merge failed',
        description: error instanceof Error ? error.message : 'Failed to merge employers',
        variant: 'destructive'
      });
    } finally {
      setIsMerging(false);
    }
  };

  const getSelectedEmployers = (): Employer[] => {
    return allEmployers.filter(emp => selectedEmployers.has(emp.id));
  };

  const renderEmployerCard = (employer: EmployerSimilarity | Employer, similarity?: EmployerSimilarity) => {
    const isSelected = selectedEmployers.has(employer.id);
    const isExpanded = expandedEmployer === employer.id;
    
    // Get full employer details
    const fullEmployer = allEmployers.find(emp => emp.id === employer.id);
    
    return (
      <Card 
        key={employer.id} 
        className={`border transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Enhanced mobile selection container */}
              <div className="flex items-center justify-center min-h-[44px] min-w-[44px] touch-manipulation">
                <Checkbox
                  id={employer.id}
                  checked={isSelected}
                  onCheckedChange={() => toggleEmployerSelection(employer.id)}
                  className="h-5 w-5 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Label
                  htmlFor={employer.id}
                  className="cursor-pointer text-base font-medium text-gray-900 hover:text-blue-700 transition-colors"
                >
                  {employer.name}
                </Label>
                <CardDescription className="text-sm text-gray-600 mt-1">
                  {(() => {
                    const addrLike = (employer as any).address || (employer as any).address_line_1
                    return addrLike || 'No address on file'
                  })()}
                </CardDescription>
                {fullEmployer?.abn && (
                  <p className="text-sm text-gray-600 mt-1">ABN: {fullEmployer.abn}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {similarity && (
                <Badge 
                  variant={similarity.matchType === 'exact' ? 'default' : similarity.matchType === 'normalized' ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {Math.round(similarity.similarity * 100)}% match
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpandedEmployer(isExpanded ? null : employer.id)}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {similarity && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-1">
              {similarity.reasons.map((reason, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {reason}
                </Badge>
              ))}
            </div>
          </CardContent>
        )}
        
        {isExpanded && fullEmployer && (
          <CardContent className="pt-0 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Type:</strong> {fullEmployer.employer_type || 'Not specified'}
              </div>
              <div>
                <strong>Est. Workers:</strong> {fullEmployer.estimated_worker_count || 'Unknown'}
              </div>
              <div className="col-span-2">
                <strong>Full Address:</strong> {[
                  fullEmployer.address_line_1,
                  fullEmployer.suburb,
                  fullEmployer.state
                ].filter(Boolean).join(', ') || 'No address'}
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Employer De-duplication Tool
          </CardTitle>
          <CardDescription>
            Search for similar employer names to identify and merge duplicates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="search-term">Company Name</Label>
              <Input
                id="search-term"
                placeholder="Enter company name to search for duplicates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleSearch} 
                disabled={isSearching || !searchTerm.trim()}
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Search
              </Button>
            </div>
          </div>

          {searchResults && (
            <div className="space-y-4">
              {searchResults.hasExactMatch && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Found {searchResults.exactMatches.length} exact match(es). These are likely duplicates that should be merged.</span>
                    {searchResults.exactMatches.length >= 2 && (
                      <Button
                        size="sm"
                        onClick={mergeAllExactMatches}
                        disabled={isMerging}
                        className="ml-4"
                      >
                        {isMerging ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Merging...
                          </>
                        ) : (
                          <>
                            <Merge className="h-4 w-4 mr-2" />
                            Merge Exact Matches
                          </>
                        )}
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {selectedEmployers.size > 0 && (
                <div className="mobile-bulk-controls p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-h-[44px]">
                      <div className="w-5 h-5 rounded-sm border-2 border-blue-600 bg-blue-600 flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-sm font-medium text-blue-900">
                        {selectedEmployers.size} employer{selectedEmployers.size !== 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {searchResults.hasExactMatch && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={selectAllExactMatches}
                          className="min-h-[44px] min-w-[44px] touch-manipulation px-4"
                        >
                          Select All Exact Matches
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={clearSelection}
                        className="min-h-[44px] min-w-[44px] touch-manipulation px-4"
                      >
                        Clear Selection
                      </Button>
                      <Button
                        size="sm"
                        onClick={initiateMerge}
                        disabled={selectedEmployers.size < 2}
                        className="min-h-[44px] min-w-[44px] touch-manipulation px-4"
                      >
                        <Merge className="h-4 w-4 mr-2" />
                        Merge Selected
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {searchResults.hasExactMatch && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Exact Matches ({searchResults.exactMatches.length})
                    </h3>
                    <div className="space-y-3">
                      {searchResults.exactMatches.map((match) => 
                        renderEmployerCard(match, match)
                      )}
                    </div>
                  </div>
                )}

                {searchResults.hasSimilarMatches && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-yellow-500" />
                      Similar Matches ({searchResults.similarMatches.length})
                    </h3>
                    <div className="space-y-3">
                      {searchResults.similarMatches.map((match) => 
                        renderEmployerCard(match, match)
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merge Confirmation Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Employer Merge</DialogTitle>
            <DialogDescription>
              Select which employer should be kept as the primary record. All data from the other employers will be merged into this one.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This action cannot be undone. All workers, projects, and other relationships will be transferred to the primary employer.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <h4 className="font-medium">Select Primary Employer:</h4>
              {getSelectedEmployers().map((employer) => (
                <div key={employer.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{employer.name}</p>
                    <p className="text-sm text-gray-600">
                      {[employer.address_line_1, employer.suburb, employer.state].filter(Boolean).join(', ')}
                    </p>
                    {employer.abn && (
                      <p className="text-xs text-gray-500">ABN: {employer.abn}</p>
                    )}
                  </div>
                  <Button
                    onClick={() => performMerge(employer.id)}
                    disabled={isMerging}
                  >
                    {isMerging ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 mr-2" />
                    )}
                    Use as Primary
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowMergeDialog(false)}
                disabled={isMerging}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
