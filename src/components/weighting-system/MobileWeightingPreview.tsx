// CFMEU Employer Rating System - Mobile Weighting Preview
// Mobile-optimized preview of weighting changes with accessibility features

'use client';

import {  useState, useEffect  } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useWeightingPreview } from '@/hooks/useWeightingPreview';
import {
  UserWeightingProfile,
  Track1Weightings,
  Track2Weightings,
  RatingChange,
  WeightingImpactLevel,
  TrafficLightRating
} from '@/lib/weighting-system/types/WeightingTypes';
import {
  Eye,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  RefreshCw,
  Smartphone,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface MobileWeightingPreviewProps {
  profile?: UserWeightingProfile | null;
  track1Weightings?: Track1Weightings | null;
  track2Weightings?: Track2Weightings | null;
  className?: string;
  autoGenerate?: boolean;
  sampleSize?: number;
}

export function MobileWeightingPreview({
  profile,
  track1Weightings,
  track2Weightings,
  className = '',
  autoGenerate = true,
  sampleSize = 15
}: MobileWeightingPreviewProps) {
  // State management
  const [activeView, setActiveView] = useState<'summary' | 'changes' | 'impact'>('summary');
  const [expandedChanges, setExpandedChanges] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Preview hook
  const {
    preview,
    loading,
    error,
    generatePreview,
    clearPreview,
    getSignificantChanges,
    getImpactLevel,
    getRecommendations
  } = useWeightingPreview({
    autoDebounce: true,
    debounceMs: 600,
    sampleSize,
    enableRealTimePreview: true
  });

  // Auto-generate preview on mount or when profile changes
  useEffect(() => {
    if (autoGenerate && profile && track1Weightings && track2Weightings && !preview) {
      handleGeneratePreview();
    }
  }, [autoGenerate, profile, track1Weightings, track2Weightings]);

  // Generate preview
  const handleGeneratePreview = async () => {
    if (!profile || !track1Weightings || !track2Weightings) {
      return;
    }

    setIsGenerating(true);
    try {
      await generatePreview({
        profile_id: profile.id,
        sample_size: sampleSize
      });

      // Haptic feedback for completion
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (error) {
      console.error('Error generating preview:', error);

      // Haptic feedback for error
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 100, 100]);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Get rating change icon and color
  const getRatingChangeDisplay = (change: RatingChange) => {
    switch (change.rating_change_type) {
      case 'improvement':
        return {
          icon: TrendingUp,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'decline':
        return {
          icon: TrendingDown,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      case 'no_change':
        return {
          icon: Minus,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
      default:
        return {
          icon: Minus,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  // Get traffic light badge
  const getTrafficLightBadge = (rating: TrafficLightRating) => {
    const variants = {
      green: 'bg-green-100 text-green-800',
      amber: 'bg-yellow-100 text-yellow-800',
      red: 'bg-red-100 text-red-800',
      unknown: 'bg-gray-100 text-gray-800'
    };

    return (
      <Badge className={variants[rating]}>
        {rating.toUpperCase()}
      </Badge>
    );
  };

  // Get impact level display
  const getImpactLevelDisplay = (level: WeightingImpactLevel) => {
    const variants = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };

    const icons = {
      low: CheckCircle,
      medium: AlertTriangle,
      high: AlertTriangle,
      critical: AlertTriangle
    };

    const Icon = icons[level];

    return (
      <Badge className={variants[level]}>
        <Icon className="w-3 h-3 mr-1" />
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  };

  const significantChanges = getSignificantChanges();
  const impactLevel = getImpactLevel();
  const recommendations = getRecommendations();

  if (!profile || !track1Weightings || !track2Weightings) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Eye className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Profile Selected</h3>
            <p className="text-gray-600">Select a weighting profile to preview its impact</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Weighting Preview</h3>
          <p className="text-sm text-gray-600">See how your weightings affect ratings</p>
        </div>
        <div className="flex items-center space-x-2">
          {preview && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearPreview}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
          <Button
            onClick={handleGeneratePreview}
            disabled={loading || isGenerating}
            size="sm"
          >
            {loading || isGenerating ? (
              <LoadingSpinner className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">Preview Error</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}

      {/* No Preview Yet */}
      {!preview && !loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Preview</h3>
              <p className="text-gray-600 mb-4 text-sm">
                Generate a preview to see how your weightings affect employer ratings
              </p>
              <Button onClick={handleGeneratePreview} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-2" />
                    Generate Preview
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Results */}
      {preview && (
        <Tabs value={activeView} onValueChange={setActiveValue}>
          <TabsList className="grid w-full grid-cols-3 h-auto py-2">
            <TabsTrigger value="summary" className="flex-col space-y-1 text-xs">
              <BarChart3 className="w-4 h-4" />
              <span>Summary</span>
            </TabsTrigger>
            <TabsTrigger value="changes" className="flex-col space-y-1 text-xs">
              <TrendingUp className="w-4 h-4" />
              <span>Changes</span>
            </TabsTrigger>
            <TabsTrigger value="impact" className="flex-col space-y-1 text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>Impact</span>
            </TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            {/* Impact Level */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Overall Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="text-center">
                    {getImpactLevelDisplay(impactLevel)}
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-xl font-bold text-green-600">
                        {preview.calculation_results?.summary_statistics?.ratings_improved || 0}
                      </div>
                      <div className="text-xs text-gray-600">Improved</div>
                    </div>
                    <div className="bg-red-50 p-3 rounded-lg">
                      <div className="text-xl font-bold text-red-600">
                        {preview.calculation_results?.summary_statistics?.ratings_declined || 0}
                      </div>
                      <div className="text-xs text-gray-600">Declined</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xl font-bold text-gray-600">
                        {preview.calculation_results?.summary_statistics?.ratings_unchanged || 0}
                      </div>
                      <div className="text-xs text-gray-600">Unchanged</div>
                    </div>
                  </div>

                  {/* Average Score Change */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Average Score Change</span>
                      <span className={`text-sm font-bold ${
                        (preview.calculation_results?.summary_statistics?.average_score_change || 0) > 0
                          ? 'text-green-600'
                          : (preview.calculation_results?.summary_statistics?.average_score_change || 0) < 0
                          ? 'text-red-600'
                          : 'text-gray-600'
                      }`}>
                        {((preview.calculation_results?.summary_statistics?.average_score_change || 0) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={50 + ((preview.calculation_results?.summary_statistics?.average_score_change || 0) * 50)}
                      className="w-full"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {recommendations.slice(0, 3).map((recommendation, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{recommendation}</span>
                      </li>
                    ))}
                    {recommendations.length > 3 && (
                      <li className="text-sm text-gray-500">
                        ... and {recommendations.length - 3} more recommendations
                      </li>
                    )}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Changes Tab */}
          <TabsContent value="changes" className="space-y-4">
            {/* Significant Changes */}
            {significantChanges.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Significant Changes</CardTitle>
                  <CardDescription className="text-xs">
                    Changes that may require attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {significantChanges.slice(0, expandedChanges ? significantChanges.length : 3).map((change, index) => {
                      const display = getRatingChangeDisplay(change);
                      const Icon = display.icon;
                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${display.borderColor} ${display.bgColor}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              <Icon className={`w-4 h-4 ${display.color} flex-shrink-0`} />
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm truncate">{change.employer_name}</div>
                                <div className="text-xs text-gray-600">
                                  {change.previous_score.toFixed(2)} → {change.new_score.toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              {getTrafficLightBadge(change.previous_rating)}
                              <span className="text-gray-400 text-xs">→</span>
                              {getTrafficLightBadge(change.new_rating)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {significantChanges.length > 3 && (
                    <div className="text-center mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpandedChanges(!expandedChanges)}
                      >
                        {expandedChanges ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            Show All ({significantChanges.length})
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* All Changes Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">All Changes Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {preview.calculation_results?.rating_changes?.slice(0, 10).map((change, index) => {
                    const display = getRatingChangeDisplay(change);
                    const Icon = display.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded border"
                      >
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <Icon className={`w-3 h-3 ${display.color} flex-shrink-0`} />
                          <span className="text-sm font-medium truncate">{change.employer_name}</span>
                        </div>
                        <div className="flex items-center space-x-1 flex-shrink-0">
                          <span className={`text-xs font-medium ${display.color}`}>
                            {change.score_change > 0 ? '+' : ''}{(change.score_change * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {preview.calculation_results?.rating_changes && preview.calculation_results.rating_changes.length > 10 && (
                  <div className="text-center mt-3 text-sm text-gray-500">
                    ... and {preview.calculation_results.rating_changes.length - 10} more changes
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Impact Tab */}
          <TabsContent value="impact" className="space-y-4">
            {/* Impact Analysis */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Impact Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Impact Distribution */}
                  <div>
                    <h4 className="font-medium text-sm mb-3">Impact Distribution</h4>
                    <div className="space-y-2">
                      {Object.entries(preview.impact_analysis?.impact_distribution || {}).map(([level, count]) => (
                        <div key={level} className="flex items-center space-x-3">
                          <div className="w-16 text-sm font-medium capitalize">{level}</div>
                          <div className="flex-1">
                            <Progress
                              value={(count / (preview.calculation_results?.sample_size || 1)) * 100}
                              className="w-full h-2"
                            />
                          </div>
                          <div className="w-8 text-sm text-right">{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div>
                    <h4 className="font-medium text-sm mb-3">Risk Assessment</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <div className="text-lg font-bold text-red-600">
                          {preview.impact_analysis?.risk_assessment?.high_risk_changes || 0}
                        </div>
                        <div className="text-xs text-gray-600">High</div>
                      </div>
                      <div className="text-center p-3 bg-orange-50 rounded-lg">
                        <div className="text-lg font-bold text-orange-600">
                          {preview.impact_analysis?.risk_assessment?.medium_risk_changes || 0}
                        </div>
                        <div className="text-xs text-gray-600">Medium</div>
                      </div>
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-lg font-bold text-blue-600">
                          {preview.impact_analysis?.risk_assessment?.low_risk_changes || 0}
                        </div>
                        <div className="text-xs text-gray-600">Low</div>
                      </div>
                    </div>
                  </div>

                  {/* Affected Categories */}
                  <div>
                    <h4 className="font-medium text-sm mb-3">Affected Categories</h4>
                    <div className="flex flex-wrap gap-1">
                      {preview.impact_analysis?.affected_categories?.map((category, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}