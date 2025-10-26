// CFMEU Employer Rating System - Weighting Preview Hook
// React hook for real-time preview of weighting changes

import { useState, useCallback, useRef } from 'react';
import { useSupabaseClient, useUser } from '@/lib/supabase/client';
import {
  PreviewWeightingsRequest,
  WeightingPreviewResponse,
  WeightingPreviewCalculation,
  WeightingPreviewResults,
  WeightingImpactAnalysis,
  WeightingImpactLevel,
  RatingChange
} from '@/lib/weighting-system/types/WeightingTypes';
import { WeightingValidator } from '@/lib/weighting-system/WeightingValidator';

interface UseWeightingPreviewOptions {
  autoDebounce?: boolean;
  debounceMs?: number;
  sampleSize?: number;
  enableRealTimePreview?: boolean;
}

interface PreviewState {
  preview: WeightingPreviewCalculation | null;
  loading: boolean;
  error: string | null;
  lastPreviewRequest: PreviewWeightingsRequest | null;
  previewHistory: WeightingPreviewCalculation[];
}

interface PreviewActions {
  generatePreview: (request: PreviewWeightingsRequest) => Promise<WeightingPreviewResponse>;
  quickValidate: (changes: any) => { isValid: boolean; errors: string[]; warnings: string[] };
  clearPreview: () => void;
  getSignificantChanges: () => RatingChange[];
  getImpactLevel: () => WeightingImpactLevel;
  getRecommendations: () => string[];
  resetState: () => void;
}

export function useWeightingPreview(
  options: UseWeightingPreviewOptions = {}
): PreviewState & PreviewActions {
  const {
    autoDebounce = true,
    debounceMs = 500,
    sampleSize = 10,
    enableRealTimePreview = true
  } = options;

  const supabase = useSupabaseClient();
  const user = useUser();

  // State management
  const [preview, setPreview] = useState<WeightingPreviewCalculation | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPreviewRequest, setLastPreviewRequest] = useState<PreviewWeightingsRequest | null>(null);
  const [previewHistory, setPreviewHistory] = useState<WeightingPreviewCalculation[]>([]);

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reset state function
  const resetState = useCallback(() => {
    setPreview(null);
    setLoading(false);
    setError(null);
    setLastPreviewRequest(null);
    setPreviewHistory([]);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Clear current preview
  const clearPreview = useCallback(() => {
    setPreview(null);
    setError(null);
    setLastPreviewRequest(null);
  }, []);

  // Quick validation for real-time preview
  const quickValidate = useCallback((changes: any) => {
    return WeightingValidator.validateForPreview(changes);
  }, []);

  // Generate preview
  const generatePreview = useCallback(async (
    request: PreviewWeightingsRequest
  ): Promise<WeightingPreviewResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Set default sample size if not provided
    const previewRequest: PreviewWeightingsRequest = {
      ...request,
      sample_size: request.sample_size || sampleSize
    };

    setLastPreviewRequest(previewRequest);
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/weightings/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(previewRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate preview');
      }

      const data: WeightingPreviewResponse = await response.json();

      if (data.success && data.data) {
        setPreview(data.data);

        // Add to history (keep last 10 previews)
        setPreviewHistory(prev => {
          const updated = [data.data!, ...prev].slice(0, 10);
          return updated;
        });

        return data;
      } else {
        throw new Error(data.error || 'Unknown error generating preview');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error generating weighting preview:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, sampleSize]);

  // Debounced preview generation
  const generatePreviewDebounced = useCallback((
    request: PreviewWeightingsRequest
  ): Promise<WeightingPreviewResponse> => {
    return new Promise((resolve, reject) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        try {
          const result = await generatePreview(request);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, debounceMs);
    });
  }, [generatePreview, debounceMs]);

  // Get significant changes from preview
  const getSignificantChanges = useCallback((): RatingChange[] => {
    if (!preview?.calculation_results?.rating_changes) {
      return [];
    }

    return preview.calculation_results.rating_changes.filter(
      change => change.impact_level === 'high' || change.impact_level === 'critical'
    );
  }, [preview]);

  // Get overall impact level
  const getImpactLevel = useCallback((): WeightingImpactLevel => {
    return preview?.impact_analysis?.overall_impact_level || 'low';
  }, [preview]);

  // Get recommendations from impact analysis
  const getRecommendations = useCallback((): string[] => {
    return preview?.impact_analysis?.recommendations || [];
  }, [preview]);

  // Real-time preview wrapper
  const generateRealTimePreview = useCallback((
    request: PreviewWeightingsRequest
  ): Promise<WeightingPreviewResponse> => {
    if (!enableRealTimePreview) {
      throw new Error('Real-time preview is disabled');
    }

    // Quick validation first
    const quickValidation = quickValidate(request.proposed_changes || {});
    if (!quickValidation.isValid) {
      throw new Error(`Validation failed: ${quickValidation.criticalErrors.join(', ')}`);
    }

    // Use debounced version for real-time updates
    if (autoDebounce) {
      return generatePreviewDebounced(request);
    } else {
      return generatePreview(request);
    }
  }, [enableRealTimePreview, quickValidate, autoDebounce, generatePreviewDebounced, generatePreview]);

  // Cleanup debounce timer on unmount
  const cleanup = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  // Auto-cleanup
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanup);
  }

  return {
    // State
    preview,
    loading,
    error,
    lastPreviewRequest,
    previewHistory,

    // Actions
    generatePreview: enableRealTimePreview ? generateRealTimePreview : generatePreview,
    quickValidate,
    clearPreview,
    getSignificantChanges,
    getImpactLevel,
    getRecommendations,
    resetState
  };
}

// Additional utility hook for preview comparisons
export function useWeightingComparison() {
  const [comparisonPreviews, setComparisonPreviews] = useState<{
    baseline?: WeightingPreviewCalculation;
    proposed?: WeightingPreviewCalculation;
    comparison?: WeightingPreviewCalculation;
  }>({});

  const setBaselinePreview = useCallback((preview: WeightingPreviewCalculation) => {
    setComparisonPreviews(prev => ({ ...prev, baseline: preview }));
  }, []);

  const setProposedPreview = useCallback((preview: WeightingPreviewCalculation) => {
    setComparisonPreviews(prev => ({ ...prev, proposed: preview }));
  }, []);

  const setComparisonPreview = useCallback((preview: WeightingPreviewCalculation) => {
    setComparisonPreviews(prev => ({ ...prev, comparison: preview }));
  }, []);

  const getComparativeAnalysis = useCallback(() => {
    const { baseline, proposed, comparison } = comparisonPreviews;

    if (!baseline || !proposed) {
      return null;
    }

    const baselineStats = baseline.calculation_results?.summary_statistics;
    const proposedStats = proposed.calculation_results?.summary_statistics;

    if (!baselineStats || !proposedStats) {
      return null;
    }

    return {
      scoreChange: proposedStats.average_score_change - (baselineStats.average_score_change || 0),
      ratingsImproved: proposedStats.ratings_improved - (baselineStats.ratings_improved || 0),
      ratingsDeclined: proposedStats.ratings_declined - (baselineStats.ratings_declined || 0),
      confidenceChange: proposedStats.confidence_change - (baselineStats.confidence_change || 0),
      impactComparison: {
        baseline: baseline.impact_analysis?.overall_impact_level || 'low',
        proposed: proposed.impact_analysis?.overall_impact_level || 'low'
      }
    };
  }, [comparisonPreviews]);

  const clearComparison = useCallback(() => {
    setComparisonPreviews({});
  }, []);

  return {
    comparisonPreviews,
    setBaselinePreview,
    setProposedPreview,
    setComparisonPreview,
    getComparativeAnalysis,
    clearComparison
  };
}