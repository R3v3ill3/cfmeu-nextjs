'use client';

import {  useState  } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, MapPin, Users, Building2 } from 'lucide-react';
import { ParsedPatch, PatchMatch, clearPatchMatch, createManyToOneMapping, createOneToManyMapping } from '@/utils/patchMatchingUtils';
import { Label } from '@/components/ui/label';

interface PatchMatchingDialogProps {
  patches: ParsedPatch[];
  existingPatches: Array<{id: string, name: string, code?: string}>;
  onConfirm: (confirmedPatches: ParsedPatch[]) => void;
  onCancel: () => void;
}

export default function PatchMatchingDialog({ patches, existingPatches, onConfirm, onCancel }: PatchMatchingDialogProps) {
  const [confirmedPatches, setConfirmedPatches] = useState<ParsedPatch[]>(patches);
  const [selectedMatches, setSelectedMatches] = useState<Record<number, string[]>>({}); // Changed to string[] for multiple patches
  const [showConfirmationDialog, setShowConfirmationDialog] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    oneToMany: Array<{featureId: number, featureName: string, patchNames: string[]}>;
    manyToOne: Array<{patchName: string, featureNames: string[]}>;
  }>({ oneToMany: [], manyToOne: [] });

  const handlePatchSelection = (fid: number, patchId: string) => {
    setConfirmedPatches(prev => {
      const patchIndex = prev.findIndex(p => p.fid === fid);
      if (patchIndex === -1) return prev;

      const updatedPatches = [...prev];
      const patchToUpdate = { ...updatedPatches[patchIndex] };
      
      const currentPatchIds = patchToUpdate.existing_patch_ids || [];
      const newPatchIds = currentPatchIds.includes(patchId)
        ? currentPatchIds.filter(id => id !== patchId)
        : [...currentPatchIds, patchId];

      patchToUpdate.existing_patch_ids = newPatchIds;
      patchToUpdate.status = newPatchIds.length > 0 ? 'manual_match' : patchToUpdate.status;
      patchToUpdate.is_mapped = newPatchIds.length > 0;

      const selectedMatch = patchToUpdate.suggested_matches?.find(m => m.id === patchId);
      if (selectedMatch) {
        patchToUpdate.match_confidence = selectedMatch.confidence;
        patchToUpdate.match_similarity = selectedMatch.similarity;
      }
      
      updatedPatches[patchIndex] = patchToUpdate;
      return updatedPatches;
    });
  };

  const handleCreateNew = (fid: number) => {
    setSelectedMatches(prev => ({ ...prev, [fid]: [] }));
    
    setConfirmedPatches(prev => prev.map(patch => {
      if (patch.fid === fid) {
        return {
          ...patch,
          status: 'new' as const,
          existing_patch_ids: [],
          match_confidence: undefined,
          match_similarity: undefined,
          is_mapped: false,
          can_clear_match: false
        };
      }
      return patch;
    }));
  };

  const handleClearMatch = (fid: number) => {
    setConfirmedPatches(prev => prev.map(patch => {
      if (patch.fid === fid) {
        return clearPatchMatch(patch);
      }
      return patch;
    }));
    // Remove from selected matches
    setSelectedMatches(prev => {
      const newMatches = { ...prev };
      delete newMatches[fid];
      return newMatches;
    });
  };

  const handleManualPatchSelection = (fid: number, patchId: string) => {
    setConfirmedPatches(prev => {
      const patchIndex = prev.findIndex(p => p.fid === fid);
      if (patchIndex === -1) return prev;

      const updatedPatches = [...prev];
      const patchToUpdate = { ...updatedPatches[patchIndex] };
      
      const currentPatchIds = patchToUpdate.existing_patch_ids || [];
      const newPatchIds = currentPatchIds.includes(patchId)
        ? currentPatchIds.filter(id => id !== patchId)
        : [...currentPatchIds, patchId];

      patchToUpdate.existing_patch_ids = newPatchIds;
      patchToUpdate.status = newPatchIds.length > 0 ? 'manual_match' : patchToUpdate.status;
      patchToUpdate.is_mapped = newPatchIds.length > 0;
      
      updatedPatches[patchIndex] = patchToUpdate;
      return updatedPatches;
    });
  };

  const removePatchFromFeature = (fid: number, patchId: string) => {
    setSelectedMatches(prev => ({
      ...prev,
      [fid]: prev[fid] ? prev[fid].filter(id => id !== patchId) : []
    }));
    
    setConfirmedPatches(prev => prev.map(patch => {
      if (patch.fid === fid) {
        const newPatchIds = (patch.existing_patch_ids || []).filter(id => id !== patchId);
        return {
          ...patch,
          status: newPatchIds.length > 1 ? 'multiple_match' as const : 
                 newPatchIds.length === 1 ? 'manual_match' as const : 'new' as const,
          existing_patch_ids: newPatchIds,
          is_mapped: newPatchIds.length > 0,
          can_clear_match: newPatchIds.length > 0
        };
      }
      return patch;
    }));
  };

  const analyzeMappings = () => {
    const oneToMany: Array<{featureId: number, featureName: string, patchNames: string[]}> = [];
    const manyToOne: Array<{patchName: string, featureNames: string[]}> = [];
    
    // Find one-to-many mappings (one feature mapped to multiple patches)
    Object.entries(selectedMatches).forEach(([fidStr, patchIds]) => {
      if (patchIds.length > 1) {
        const fid = parseInt(fidStr);
        const feature = patches.find(p => p.fid === fid);
        if (feature) {
          const patchNames = patchIds.map(patchId => {
            const patch = existingPatches.find(p => p.id === patchId);
            return patch ? patch.name : patchId;
          });
          oneToMany.push({
            featureId: fid,
            featureName: feature.patch_name,
            patchNames
          });
        }
      }
    });
    
    // Find many-to-one mappings (multiple features mapped to same patch)
    const patchToFeatures: Record<string, number[]> = {};
    Object.entries(selectedMatches).forEach(([fidStr, patchIds]) => {
      patchIds.forEach(patchId => {
        if (!patchToFeatures[patchId]) {
          patchToFeatures[patchId] = [];
        }
        patchToFeatures[patchId].push(parseInt(fidStr));
      });
    });
    
    Object.entries(patchToFeatures).forEach(([patchId, featureIds]) => {
      if (featureIds.length > 1) {
        const patch = existingPatches.find(p => p.id === patchId);
        if (patch) {
          const featureNames = featureIds.map(fid => {
            const feature = patches.find(p => p.fid === fid);
            return feature ? feature.patch_name : `FID: ${fid}`;
          });
          manyToOne.push({
            patchName: patch.name,
            featureNames
          });
        }
      }
    });
    
    return { oneToMany, manyToOne };
  };

  const handleConfirmWithCheck = () => {
    const mappings = analyzeMappings();
    if (mappings.oneToMany.length > 0 || mappings.manyToOne.length > 0) {
      setConfirmationData(mappings);
      setShowConfirmationDialog(true);
    } else {
      onConfirm(confirmedPatches);
    }
  };

  const getStatusBadge = (patch: ParsedPatch) => {
    switch (patch.status) {
      case 'existing':
        return <Badge variant="default" className="bg-green-100 text-green-800">Exact Match</Badge>;
      case 'manual_match':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Manual Match</Badge>;
      case 'new':
        return <Badge variant="outline" className="bg-gray-100 text-gray-800">New Patch</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return 'text-green-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const summary = {
    exact: confirmedPatches.filter(p => p.status === 'existing').length,
    manual: confirmedPatches.filter(p => p.status === 'manual_match').length,
    new: confirmedPatches.filter(p => p.status === 'new').length,
    total: confirmedPatches.length
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Confirm Patch Matches</h2>
          <p className="text-gray-600 mt-1">
            Review and confirm the automatic patch matches, or manually select alternatives.
            Supports 1:1, 1:many, and many:1 mappings with the ability to clear matches.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">Features to process</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Exact Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.exact}</div>
            <p className="text-xs text-muted-foreground">Auto-confirmed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Manual Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.manual}</div>
            <p className="text-xs text-muted-foreground">Needs confirmation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">New Patches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{summary.new}</div>
            <p className="text-xs text-muted-foreground">Will be created</p>
          </CardContent>
        </Card>
      </div>

      {/* Mapping Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping Instructions</CardTitle>
          <CardDescription>
            Select multiple patches for one feature (one-to-many) or map multiple features to the same patch (many-to-one)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• <strong>One-to-Many:</strong> Click multiple patch buttons for a single feature</p>
            <p>• <strong>Many-to-One:</strong> Select the same patch for multiple features</p>
            <p>• <strong>Clear Match:</strong> Remove specific patch mappings</p>
            <p>• <strong>Create New:</strong> Create a new patch for unmapped features</p>
          </div>
        </CardContent>
      </Card>

      {/* Patch Review List */}
      <Card>
        <CardHeader>
          <CardTitle>Patch Review</CardTitle>
          <CardDescription>
            Review each feature and confirm the suggested matches or create new patches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {confirmedPatches.map((patch) => (
              <div 
                key={patch.fid} 
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusBadge(patch)}
                    <span className="font-mono text-sm text-gray-500">FID: {patch.fid}</span>
                    <span className="font-medium">{patch.patch_name}</span>
                  </div>
                  {patch.match_confidence && (
                    <span className={`text-sm font-medium ${getConfidenceColor(patch.match_confidence)}`}>
                      {Math.round((patch.match_similarity || 0) * 100)}% match
                    </span>
                  )}
                </div>

                {patch.status === 'manual_match' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Select a match:</Label>
                    <div className="flex flex-wrap gap-2">
                      {/* Show suggested matches if available */}
                      {patch.suggested_matches && patch.suggested_matches.length > 0 ? (
                        patch.suggested_matches.map((match) => (
                          <Button
                            key={match.id}
                            variant={(patch.existing_patch_ids || []).includes(match.id) ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePatchSelection(patch.fid, match.id)}
                            className="text-xs"
                          >
                            <MapPin className="h-3 w-3 mr-1" />
                            {match.name}
                            {match.code && ` (${match.code})`}
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {match.confidence}
                            </Badge>
                          </Button>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500 mb-2">
                          No automatic matches found. Select from existing patches:
                        </div>
                      )}
                      
                      {/* Always show manual selection from all existing patches */}
                      {existingPatches.map((existingPatch) => (
                        <Button
                          key={existingPatch.id}
                          variant={(patch.existing_patch_ids || []).includes(existingPatch.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleManualPatchSelection(patch.fid, existingPatch.id)}
                          className="text-xs"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {existingPatch.name}
                          {existingPatch.code && ` (${existingPatch.code})`}
                        </Button>
                      ))}
                      
                      <Button
                        variant={(patch.existing_patch_ids || []).length === 0 ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleCreateNew(patch.fid)}
                        className="text-xs"
                      >
                        <Building2 className="h-3 w-3 mr-1" />
                        Create New
                      </Button>
                      
                      {patch.can_clear_match && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleClearMatch(patch.fid)}
                          className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Clear Match
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {patch.status === 'existing' && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Exact match found: <strong>{patch.patch_name}</strong>
                    </AlertDescription>
                  </Alert>
                )}

                {patch.status === 'new' && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      New patch will be created: <strong>{patch.patch_name}</strong>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleConfirmWithCheck}>
          Confirm All Matches
        </Button>
      </div>

      {/* Confirmation Dialog for Complex Mappings */}
      {showConfirmationDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Confirm Complex Mappings</h3>
            
            {confirmationData.oneToMany.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-red-600 mb-2">⚠️ One-to-Many Mappings Detected:</h4>
                <div className="space-y-2">
                  {confirmationData.oneToMany.map((mapping, index) => (
                    <div key={index} className="bg-red-50 p-3 rounded border border-red-200">
                      <p className="text-sm">
                        <strong>Feature "{mapping.featureName}" (FID: {mapping.featureId})</strong> will be mapped to:
                      </p>
                      <div className="mt-1 space-x-2">
                        {mapping.patchNames.map((patchName, patchIndex) => (
                          <Badge key={patchIndex} variant="secondary" className="text-xs">
                            {patchName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {confirmationData.manyToOne.length > 0 && (
              <div className="mb-6">
                <h4 className="font-medium text-blue-600 mb-2">⚠️ Many-to-One Mappings Detected:</h4>
                <div className="space-y-2">
                  {confirmationData.manyToOne.map((mapping, index) => (
                    <div key={index} className="bg-blue-50 p-3 rounded border border-blue-200">
                      <p className="text-sm">
                        <strong>Patch "{mapping.patchName}"</strong> will receive multiple features:
                      </p>
                      <div className="mt-1 space-x-2">
                        {mapping.featureNames.map((featureName, featureIndex) => (
                          <Badge key={featureIndex} variant="secondary" className="text-xs">
                            {featureName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="text-sm text-gray-600 mb-6">
              <p>Please review these mappings carefully. This will create complex relationships in the database.</p>
            </div>
            
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowConfirmationDialog(false)}>
                Review Again
              </Button>
              <Button 
                onClick={() => {
                  setShowConfirmationDialog(false);
                  onConfirm(confirmedPatches);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Confirm Mappings
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

