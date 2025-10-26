// CFMEU Employer Rating System - Weighting Comparison Component
// Compare different weighting configurations side by side

'use client';

import {  useState, useEffect  } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useWeightingComparison } from '@/hooks/useWeightingComparison';
import {
  UserWeightingProfile,
  WeightingPreviewCalculation,
  TrafficLightRating
} from '@/lib/weighting-system/types/WeightingTypes';
import {
  BarChart3,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Download,
  RefreshCw,
  GitCompare,
  Settings
} from 'lucide-react';

interface WeightingComparisonProps {
  profiles: UserWeightingProfile[];
  currentProfile?: UserWeightingProfile | null;
  className?: string;
  allowProfileSelection?: boolean;
}

export function WeightingComparison({
  profiles,
  currentProfile,
  className = '',
  allowProfileSelection = true
}: WeightingComparisonProps) {
  // State management
  const [selectedProfile1, setSelectedProfile1] = useState<string | null>(currentProfile?.id || null);
  const [selectedProfile2, setSelectedProfile2] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'detailed' | 'impact'>('overview');
  const [isGeneratingComparison, setIsGeneratingComparison] = useState(false);

  // Comparison hook
  const {
    comparisonPreviews,
    setBaselinePreview,
    setProposedPreview,
    getComparativeAnalysis,
    clearComparison
  } = useWeightingComparison();

  // Get profile by ID
  const getProfileById = (id: string | null) => {
    return profiles.find(p => p.id === id);
  };

  // Handle comparison generation
  const handleGenerateComparison = async () => {
    if (!selectedProfile1 || !selectedProfile2) return;

    setIsGeneratingComparison(true);
    try {
      // Generate preview for both profiles
      // In a real implementation, this would call the preview API
      // For now, we'll simulate the comparison

      const mockPreview1: WeightingPreviewCalculation = {
        id: 'preview-1',
        user_id: 'user',
        profile_id: selectedProfile1,
        sample_employers: [],
        proposed_weightings: {},
        calculation_results: {
          sample_size: 10,
          current_ratings: [],
          proposed_ratings: [],
          rating_changes: [],
          summary_statistics: {
            ratings_improved: 5,
            ratings_declined: 2,
            ratings_unchanged: 3,
            average_score_change: 0.15,
            confidence_change: 0.05
          }
        },
        impact_analysis: {
          overall_impact_level: 'medium',
          impact_distribution: {
            low: 6,
            medium: 3,
            high: 1,
            critical: 0
          },
          affected_categories: ['compliance', 'expertise'],
          significant_changes: [],
          recommendations: ['Consider balancing weights more evenly'],
          risk_assessment: {
            high_risk_changes: 0,
            medium_risk_changes: 2,
            low_risk_changes: 8
          }
        },
        preview_type: 'comparison',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 3600000)
      };

      const mockPreview2: WeightingPreviewCalculation = {
        ...mockPreview1,
        id: 'preview-2',
        profile_id: selectedProfile2,
        calculation_results: {
          ...mockPreview1.calculation_results,
          summary_statistics: {
            ratings_improved: 3,
            ratings_declined: 4,
            ratings_unchanged: 3,
            average_score_change: -0.05,
            confidence_change: -0.02
          }
        }
      };

      setBaselinePreview(mockPreview1);
      setProposedPreview(mockPreview2);
    } catch (error) {
      console.error('Error generating comparison:', error);
    } finally {
      setIsGeneratingComparison(false);
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

  // Get profile type display
  const getProfileTypeDisplay = (type: string) => {
    const variants = {
      personal: 'bg-blue-100 text-blue-800',
      role_template: 'bg-purple-100 text-purple-800',
      project_specific: 'bg-green-100 text-green-800',
      experimental: 'bg-orange-100 text-orange-800'
    };

    return (
      <Badge className={variants[type as keyof typeof variants] || 'bg-gray-100 text-gray-800'}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  const profile1 = getProfileById(selectedProfile1);
  const profile2 = getProfileById(selectedProfile2);
  const comparativeAnalysis = getComparativeAnalysis();

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Weighting Comparison</h3>
          <p className="text-gray-600">Compare different weighting configurations side by side</p>
        </div>
        <div className="flex items-center space-x-3">
          {comparisonPreviews.baseline && (
            <Button
              variant="outline"
              size="sm"
              onClick={clearComparison}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
          <Button
            onClick={handleGenerateComparison}
            disabled={!selectedProfile1 || !selectedProfile2 || isGeneratingComparison}
          >
            {isGeneratingComparison ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Comparing...
              </>
            ) : (
              <>
                <GitCompare className="w-4 h-4 mr-2" />
                Compare
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Profile Selection */}
      {allowProfileSelection && (
        <Card>
          <CardHeader>
            <CardTitle>Select Profiles to Compare</CardTitle>
            <CardDescription>
              Choose two weighting profiles to compare their impact on employer ratings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile 1 Selection */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Profile 1 (Baseline)</Label>
                <Select value={selectedProfile1 || ''} onValueChange={setSelectedProfile1}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select first profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center space-x-2">
                          <span>{profile.profile_name}</span>
                          {profile.is_default && <Badge variant="secondary">Default</Badge>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {profile1 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium">{profile1.profile_name}</h4>
                      {getProfileTypeDisplay(profile1.profile_type)}
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Role: {profile1.user_role.replace('_', ' ')}</div>
                      <div>Focus: {profile1.employer_category_focus}</div>
                      <div>Balance: {profile1.project_data_weight.toFixed(2)} / {profile1.organiser_expertise_weight.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Profile 2 Selection */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Profile 2 (Comparison)</Label>
                <Select value={selectedProfile2 || ''} onValueChange={setSelectedProfile2}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select second profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles
                      .filter(p => p.id !== selectedProfile1)
                      .map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          <div className="flex items-center space-x-2">
                            <span>{profile.profile_name}</span>
                            {profile.is_default && <Badge variant="secondary">Default</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {profile2 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="font-medium">{profile2.profile_name}</h4>
                      {getProfileTypeDisplay(profile2.profile_type)}
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Role: {profile2.user_role.replace('_', ' ')}</div>
                      <div>Focus: {profile2.employer_category_focus}</div>
                      <div>Balance: {profile2.project_data_weight.toFixed(2)} / {profile2.organiser_expertise_weight.toFixed(2)}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Results */}
      {comparisonPreviews.baseline && comparisonPreviews.proposed && (
        <Tabs value={activeView} onValueChange={setActiveView}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="detailed">Detailed</TabsTrigger>
            <TabsTrigger value="impact">Impact Analysis</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Key Metrics Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Key Metrics Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Profile Headers */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center font-medium">Metric</div>
                    <div className="text-center">
                      <div className="font-medium">{profile1?.profile_name}</div>
                      <div className="text-sm text-gray-600">Baseline</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{profile2?.profile_name}</div>
                      <div className="text-sm text-gray-600">Comparison</div>
                    </div>
                  </div>

                  {/* Main Balance */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="text-sm font-medium">Project Data Weight</div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        {profile1 ? `${(profile1.project_data_weight * 100).toFixed(0)}%` : '-'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold">
                        {profile2 ? `${(profile2.project_data_weight * 100).toFixed(0)}%` : '-'}
                      </div>
                      {profile1 && profile2 && (
                        <div className="text-xs text-gray-500">
                          {profile2.project_data_weight > profile1.project_data_weight ? (
                            <span className="text-blue-600">+{((profile2.project_data_weight - profile1.project_data_weight) * 100).toFixed(1)}%</span>
                          ) : (
                            <span className="text-red-600">
                              {((profile2.project_data_weight - profile1.project_data_weight) * 100).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rating Improvements */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="text-sm font-medium">Ratings Improved</div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">
                        {comparisonPreviews.baseline?.calculation_results?.summary_statistics?.ratings_improved || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-green-600">
                        {comparisonPreviews.proposed?.calculation_results?.summary_statistics?.ratings_improved || 0}
                      </div>
                      {comparativeAnalysis && (
                        <div className="text-xs text-gray-500">
                          {comparativeAnalysis.ratingsImproved > 0 ? (
                            <span className="text-green-600">+{comparativeAnalysis.ratingsImproved}</span>
                          ) : comparativeAnalysis.ratingsImproved < 0 ? (
                            <span className="text-red-600">{comparativeAnalysis.ratingsImproved}</span>
                          ) : (
                            <span className="text-gray-600">0</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rating Declines */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="text-sm font-medium">Ratings Declined</div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">
                        {comparisonPreviews.baseline?.calculation_results?.summary_statistics?.ratings_declined || 0}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-red-600">
                        {comparisonPreviews.proposed?.calculation_results?.summary_statistics?.ratings_declined || 0}
                      </div>
                      {comparativeAnalysis && (
                        <div className="text-xs text-gray-500">
                          {comparativeAnalysis.ratingsDeclined > 0 ? (
                            <span className="text-red-600">+{comparativeAnalysis.ratingsDeclined}</span>
                          ) : comparativeAnalysis.ratingsDeclined < 0 ? (
                            <span className="text-green-600">{comparativeAnalysis.ratingsDeclined}</span>
                          ) : (
                            <span className="text-gray-600">0</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Average Score Change */}
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div className="text-sm font-medium">Avg Score Change</div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">
                        {((comparisonPreviews.baseline?.calculation_results?.summary_statistics?.average_score_change || 0) * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-semibold text-blue-600">
                        {((comparisonPreviews.proposed?.calculation_results?.summary_statistics?.average_score_change || 0) * 100).toFixed(1)}%
                      </div>
                      {comparativeAnalysis && (
                        <div className="text-xs text-gray-500">
                          {comparativeAnalysis.scoreChange > 0 ? (
                            <span className="text-green-600">+{(comparativeAnalysis.scoreChange * 100).toFixed(1)}%</span>
                          ) : comparativeAnalysis.scoreChange < 0 ? (
                            <span className="text-red-600">{(comparativeAnalysis.scoreChange * 100).toFixed(1)}%</span>
                          ) : (
                            <span className="text-gray-600">0%</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparative Summary */}
            {comparativeAnalysis && (
              <Card>
                <CardHeader>
                  <CardTitle>Comparative Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {(comparativeAnalysis.scoreChange * 100).toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-600">Score Difference</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {comparativeAnalysis.ratingsImproved - comparativeAnalysis.ratingsDeclined}
                      </div>
                      <div className="text-sm text-gray-600">Net Rating Change</div>
                    </div>
                  </div>

                  {/* Impact Comparison */}
                  <div className="mt-6">
                    <h4 className="font-medium mb-3">Impact Level Comparison</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium mb-2">Baseline Impact</div>
                        {getImpactLevelDisplay(comparisonPreviews.baseline?.impact_analysis?.overall_impact_level || 'low')}
                      </div>
                      <div>
                        <div className="text-sm font-medium mb-2">Comparison Impact</div>
                        {getImpactLevelDisplay(comparisonPreviews.proposed?.impact_analysis?.overall_impact_level || 'low')}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Detailed Tab */}
          <TabsContent value="detailed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Detailed Weight Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Profile Configuration Comparison */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="font-medium">Configuration</div>
                    <div className="text-center">
                      <div className="font-medium">{profile1?.profile_name}</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium">{profile2?.profile_name}</div>
                    </div>
                  </div>

                  {/* Main Weights */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm">Project Data Weight</div>
                    <div className="text-center">{profile1 ? `${(profile1.project_data_weight * 100).toFixed(1)}%` : '-'}</div>
                    <div className="text-center">{profile2 ? `${(profile2.project_data_weight * 100).toFixed(1)}%` : '-'}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm">Expertise Weight</div>
                    <div className="text-center">{profile1 ? `${(profile1.organiser_expertise_weight * 100).toFixed(1)}%` : '-'}</div>
                    <div className="text-center">{profile2 ? `${(profile2.organiser_expertise_weight * 100).toFixed(1)}%` : '-'}</div>
                  </div>

                  {/* Role and Focus */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm">User Role</div>
                    <div className="text-center capitalize">{profile1?.user_role.replace('_', ' ')}</div>
                    <div className="text-center capitalize">{profile2?.user_role.replace('_', ' ')}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm">Employer Focus</div>
                    <div className="text-center capitalize">{profile1?.employer_category_focus}</div>
                    <div className="text-center capitalize">{profile2?.employer_category_focus}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-sm">Profile Type</div>
                    <div className="text-center">{profile1 ? getProfileTypeDisplay(profile1.profile_type) : '-'}</div>
                    <div className="text-center">{profile2 ? getProfileTypeDisplay(profile2.profile_type) : '-'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Impact Analysis Tab */}
          <TabsContent value="impact" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Impact Analysis Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Risk Assessment Comparison */}
                  <div>
                    <h4 className="font-medium mb-3">Risk Assessment</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-sm font-medium mb-2">Baseline Risk</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">High Risk:</span>
                            <span className="text-sm font-medium">
                              {comparisonPreviews.baseline?.impact_analysis?.risk_assessment?.high_risk_changes || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Medium Risk:</span>
                            <span className="text-sm font-medium">
                              {comparisonPreviews.baseline?.impact_analysis?.risk_assessment?.medium_risk_changes || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Low Risk:</span>
                            <span className="text-sm font-medium">
                              {comparisonPreviews.baseline?.impact_analysis?.risk_assessment?.low_risk_changes || 0}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium mb-2">Comparison Risk</h5>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm">High Risk:</span>
                            <span className="text-sm font-medium">
                              {comparisonPreviews.proposed?.impact_analysis?.risk_assessment?.high_risk_changes || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Medium Risk:</span>
                            <span className="text-sm font-medium">
                              {comparisonPreviews.proposed?.impact_analysis?.risk_assessment?.medium_risk_changes || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm">Low Risk:</span>
                            <span className="text-sm font-medium">
                              {comparisonPreviews.proposed?.impact_analysis?.risk_assessment?.low_risk_changes || 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations Comparison */}
                  <div>
                    <h4 className="font-medium mb-3">Recommendations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="text-sm font-medium mb-2">Baseline Recommendations</h5>
                        <ul className="space-y-1">
                          {(comparisonPreviews.baseline?.impact_analysis?.recommendations || []).map((rec, index) => (
                            <li key={index} className="text-sm flex items-start space-x-2">
                              <span className="text-blue-600">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h5 className="text-sm font-medium mb-2">Comparison Recommendations</h5>
                        <ul className="space-y-1">
                          {(comparisonPreviews.proposed?.impact_analysis?.recommendations || []).map((rec, index) => (
                            <li key={index} className="text-sm flex items-start space-x-2">
                              <span className="text-green-600">•</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* No Comparison State */}
      {!comparisonPreviews.baseline && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <GitCompare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-medium text-gray-900 mb-2">Ready to Compare</h3>
              <p className="text-gray-600 mb-6">
                Select two profiles to compare their weighting configurations and impact
              </p>
              {selectedProfile1 && selectedProfile2 ? (
                <Button onClick={handleGenerateComparison} disabled={isGeneratingComparison}>
                  {isGeneratingComparison ? (
                    <>
                      <LoadingSpinner className="w-4 h-4 mr-2" />
                      Comparing...
                    </>
                  ) : (
                    <>
                      <GitCompare className="w-4 h-4 mr-2" />
                      Generate Comparison
                    </>
                  )}
                </Button>
              ) : (
                <p className="text-sm text-gray-500">
                  Please select two profiles to compare
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // Helper function for impact level display
  function getImpactLevelDisplay(level: string) {
    const variants = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      critical: 'bg-red-100 text-red-800'
    };

    return (
      <Badge className={variants[level as keyof typeof variants] || 'bg-gray-100 text-gray-800'}>
        {level.charAt(0).toUpperCase() + level.slice(1)}
      </Badge>
    );
  }
}