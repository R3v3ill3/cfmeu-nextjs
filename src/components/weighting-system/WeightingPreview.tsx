// CFMEU Employer Rating System - Weighting Preview Component
// Real-time preview of weighting changes on employer ratings

'use client';

import {  useState, useEffect  } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useWeightingPreview } from '@/hooks/useWeightingPreview';
import {
  UserWeightingProfile,
  Track1Weightings,
  Track2Weightings,
  WeightingPreviewCalculation,
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
  Download,
  Users,
  Building
} from 'lucide-react';

interface WeightingPreviewProps {
  profile?: UserWeightingProfile | null;
  track1Weightings?: Track1Weightings | null;
  track2Weightings?: Track2Weightings | null;
  className?: string;
  autoGenerate?: boolean;
  sampleSize?: number;
}

export function WeightingPreview({
  profile,
  track1Weightings,
  track2Weightings,
  className = '',
  autoGenerate = false,
  sampleSize = 20
}: WeightingPreviewProps) {
  // State management
  const [activeView, setActiveView] = useState<'summary' | 'changes' | 'impact' | 'details'>('summary');
  const [proposedChanges, setProposedChanges] = useState<any>({});
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
    debounceMs: 800,
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
        proposed_changes: proposedChanges,
        sample_size: sampleSize
      });
    } catch (error) {
      console.error('Error generating preview:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle weighting changes
  const handleWeightingChange = (category: 'main' | 'track1' | 'track2', field: string, value: number) => {
    setProposedChanges(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [field]: value
      }
    }));
  };

  // Get rating change icon and color
  const getRatingChangeDisplay = (change: RatingChange) => {
    switch (change.rating_change_type) {
      case 'improvement':
        return {
          icon: TrendingUp,
          color: 'text-green-600',
          bgColor: 'bg-green-100'
        };
      case 'decline':
        return {
          icon: TrendingDown,
          color: 'text-red-600',
          bgColor: 'bg-red-100'
        };
      case 'no_change':
        return {
          icon: Minus,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
        };
      default:
        return {
          icon: Minus,
          color: 'text-gray-600',
          bgColor: 'bg-gray-100'
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
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Weighting Preview</h3>
          <p className="text-gray-600">See how your weightings affect employer ratings</p>
        </div>
        <div className="flex items-center space-x-3">
          {preview && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearPreview}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
          <Button
            onClick={handleGeneratePreview}
            disabled={loading || isGenerating}
          >
            {loading || isGenerating ? (
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
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Preview Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* No Preview Yet */}
      {!preview && !loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Ready to Preview</h3>
              <p className="text-gray-600 mb-6">
                Generate a preview to see how your current weightings affect employer ratings
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
        <Tabs value={activeView} onValueChange={setActiveView}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="changes">Changes</TabsTrigger>
            <TabsTrigger value="impact">Impact</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
          </TabsList>

          {/* Summary Tab */}
          <TabsContent value="summary" className="space-y-4">
            {/* Impact Level */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Overall Impact</span>
                  {getImpactLevelDisplay(impactLevel)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {preview.calculation_results?.summary_statistics?.ratings_improved || 0}
                    </div>
                    <div className="text-sm text-gray-600">Ratings Improved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {preview.calculation_results?.summary_statistics?.ratings_declined || 0}
                    </div>
                    <div className="text-sm text-gray-600">Ratings Declined</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-600">
                      {preview.calculation_results?.summary_statistics?.ratings_unchanged || 0}
                    </div>
                    <div className="text-sm text-gray-600">Unchanged</div>
                  </div>
                </div>

                {/* Average Score Change */}
                <div className="mt-6">
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
              </CardContent>
            </Card>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {recommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-sm">{recommendation}</span>
                      </li>
                    ))}
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
                <CardHeader>
                  <CardTitle>Significant Changes</CardTitle>
                  <CardDescription>
                    Employers with rating changes that may require attention
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {significantChanges.slice(0, 10).map((change, index) => {
                      const display = getRatingChangeDisplay(change);
                      const Icon = display.icon;
                      return (
                        <div
                          key={index}
                          className={`flex items-center justify-between p-3 rounded-lg ${display.bgColor}`}
                        >
                          <div className="flex items-center space-x-3">
                            <Icon className={`w-4 h-4 ${display.color}`} />
                            <div>
                              <div className="font-medium">{change.employer_name}</div>
                              <div className="text-sm text-gray-600">
                                {change.previous_score.toFixed(2)} → {change.new_score.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {getTrafficLightBadge(change.previous_rating)}
                            <span className="text-gray-400">→</span>
                            {getTrafficLightBadge(change.new_rating)}
                            <Badge className={display.color}>
                              {Math.abs(change.score_change * 100).toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {significantChanges.length > 10 && (
                    <div className="text-center mt-4">
                      <Button variant="outline" size="sm">
                        View All Changes ({significantChanges.length})
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* All Changes Summary */}
            <Card>
              <CardHeader>
                <CardTitle>All Rating Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {preview.calculation_results?.rating_changes?.slice(0, 20).map((change, index) => {
                    const display = getRatingChangeDisplay(change);
                    const Icon = display.icon;
                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 rounded border"
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={`w-3 h-3 ${display.color}`} />
                          <span className="text-sm font-medium">{change.employer_name}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getTrafficLightBadge(change.previous_rating)}
                          <span className="text-gray-400 text-xs">→</span>
                          {getTrafficLightBadge(change.new_rating)}
                          <span className={`text-xs font-medium ${display.color}`}>
                            {change.score_change > 0 ? '+' : ''}{(change.score_change * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Impact Tab */}
          <TabsContent value="impact" className="space-y-4">
            {/* Impact Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Impact Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Impact Distribution */}
                  <div>
                    <h4 className="font-medium mb-3">Impact Distribution</h4>
                    <div className="space-y-3">
                      {Object.entries(preview.impact_analysis?.impact_distribution || {}).map(([level, count]) => (
                        <div key={level} className="flex items-center space-x-3">
                          <div className="w-20 text-sm font-medium capitalize">{level}</div>
                          <div className="flex-1">
                            <Progress
                              value={(count / (preview.calculation_results?.sample_size || 1)) * 100}
                              className="w-full"
                            />
                          </div>
                          <div className="w-12 text-sm text-right">{count}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div>
                    <h4 className="font-medium mb-3">Risk Assessment</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-xl font-bold text-red-600">
                          {preview.impact_analysis?.risk_assessment?.high_risk_changes || 0}
                        </div>
                        <div className="text-sm text-gray-600">High Risk</div>
                      </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                        <div className="text-xl font-bold text-orange-600">
                          {preview.impact_analysis?.risk_assessment?.medium_risk_changes || 0}
                        </div>
                        <div className="text-sm text-gray-600">Medium Risk</div>
                      </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-xl font-bold text-blue-600">
                          {preview.impact_analysis?.risk_assessment?.low_risk_changes || 0}
                        </div>
                        <div className="text-sm text-gray-600">Low Risk</div>
                      </div>
                </div>
              </div>

              {/* Affected Categories */}
              <div>
                <h4 className="font-medium mb-3">Affected Categories</h4>
                <div className="flex flex-wrap gap-2">
                  {preview.impact_analysis?.affected_categories?.map((category, index) => (
                    <Badge key={index} variant="outline">
                      {category}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Details Tab */}
      <TabsContent value="details" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Preview Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Sample Size</h4>
                  <p className="text-sm text-gray-600">{preview.calculation_results?.sample_size} employers</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Preview Type</h4>
                  <p className="text-sm text-gray-600 capitalize">{preview.preview_type}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Generated</h4>
                  <p className="text-sm text-gray-600">
                    {new Date(preview.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Expires</h4>
                  <p className="text-sm text-gray-600">
                    {new Date(preview.expires_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Proposed Changes */}
              {Object.keys(preview.proposed_weightings || {}).length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Proposed Changes</h4>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <pre className="text-xs overflow-auto">
                      {JSON.stringify(preview.proposed_weightings, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle>Export Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export as CSV
              </Button>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export as JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )}
</div>
);
}