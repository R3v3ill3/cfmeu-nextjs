"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  BarChart3,
  Target
} from "lucide-react";
import { TrafficLightRatingDisplay } from "./TrafficLightRatingDisplay";
import { format } from "date-fns";

interface RatingHistoryEntry {
  date: string;
  project_rating: number;
  project_rating_label: 'red' | 'amber' | 'yellow' | 'green';
  expertise_rating: number;
  expertise_rating_label: 'red' | 'amber' | 'yellow' | 'green';
  final_rating: 'red' | 'amber' | 'yellow' | 'green';
  final_source: 'organiser_expertise' | 'project_average' | 'calculated';
}

interface RatingHistoryChartProps {
  history: RatingHistoryEntry[];
}

export function RatingHistoryChart({ history }: RatingHistoryChartProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No rating history available</p>
      </div>
    );
  }

  // Calculate trends
  const calculateTrend = (ratings: number[]) => {
    if (ratings.length < 2) return 'stable';
    const first = ratings[0];
    const last = ratings[ratings.length - 1];
    const change = last - first;

    if (Math.abs(change) < 0.1) return 'stable';
    return change > 0 ? 'improving' : 'declining';
  };

  const projectRatings = history.map(h => h.project_rating);
  const expertiseRatings = history.map(h => h.expertise_rating);
  const finalRatings = history.map(h => h.final_rating === 'green' ? 4 :
                                       h.final_rating === 'yellow' ? 3 :
                                       h.final_rating === 'amber' ? 2 : 1);

  const projectTrend = calculateTrend(projectRatings);
  const expertiseTrend = calculateTrend(expertiseRatings);
  const overallTrend = calculateTrend(finalRatings);

  // Get max and min for chart scaling
  const allRatings = [...projectRatings, ...expertiseRatings, ...finalRatings];
  const maxRating = Math.max(...allRatings);
  const minRating = Math.min(...allRatings);
  const ratingRange = maxRating - minRating || 1;

  const getRatingColor = (rating: 'red' | 'amber' | 'yellow' | 'green') => {
    switch (rating) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'amber': return 'bg-amber-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendText = (trend: string) => {
    switch (trend) {
      case 'improving': return 'Improving';
      case 'declining': return 'Declining';
      default: return 'Stable';
    }
  };

  return (
    <div className="space-y-6">
      {/* Trend Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {getTrendIcon(overallTrend)}
              <span className="font-medium">Overall Trend</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {getTrendText(overallTrend)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Based on final ratings
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {getTrendIcon(projectTrend)}
              <span className="font-medium">Project Data</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {getTrendText(projectTrend)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Based on compliance data
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              {getTrendIcon(expertiseTrend)}
              <span className="font-medium">Expertise</span>
            </div>
            <div className="text-sm text-muted-foreground">
              {getTrendText(expertiseTrend)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Based on organiser assessments
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visual Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Rating Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Chart Legend */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span>Project Data</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span>Organiser Expertise</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Final Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Poor (1)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Good (4)</span>
              </div>
            </div>

            <Separator />

            {/* Timeline Chart */}
            <div className="space-y-3">
              {history.map((entry, index) => (
                <div key={entry.date} className="flex items-center gap-4">
                  {/* Date Label */}
                  <div className="w-20 text-xs text-muted-foreground text-right">
                    {format(new Date(entry.date), 'MMM yyyy')}
                  </div>

                  {/* Rating Bars */}
                  <div className="flex-1 relative">
                    <div className="flex items-center gap-2 h-8">
                      {/* Project Rating Bar */}
                      {entry.project_rating > 0 && (
                        <div className="flex-1 relative">
                          <div
                            className="absolute top-0 left-0 h-2 rounded-full bg-purple-500 opacity-70"
                            style={{
                              width: `${((entry.project_rating - minRating) / ratingRange) * 100}%`,
                              minWidth: entry.project_rating > minRating ? '8px' : '0px'
                            }}
                          />
                          <div className="absolute -top-6 left-0 text-xs text-purple-600 font-medium">
                            {entry.project_rating.toFixed(1)}
                          </div>
                        </div>
                      )}

                      {/* Expertise Rating Bar */}
                      {entry.expertise_rating > 0 && (
                        <div className="flex-1 relative">
                          <div
                            className="absolute top-2 left-0 h-2 rounded-full bg-blue-500 opacity-70"
                            style={{
                              width: `${((entry.expertise_rating - minRating) / ratingRange) * 100}%`,
                              minWidth: entry.expertise_rating > minRating ? '8px' : '0px'
                            }}
                          />
                          <div className="absolute -top-6 left-0 text-xs text-blue-600 font-medium">
                            {entry.expertise_rating.toFixed(1)}
                          </div>
                        </div>
                      )}

                      {/* Final Rating Indicator */}
                      <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow-sm" />
                      <div className="text-xs text-green-600 font-medium">
                        {entry.final_rating === 'green' ? 4 :
                         entry.final_rating === 'yellow' ? 3 :
                         entry.final_rating === 'amber' ? 2 : 1}
                      </div>
                    </div>
                  </div>

                  {/* Rating Badges */}
                  <div className="flex items-center gap-2">
                    <TrafficLightRatingDisplay
                      rating={entry.final_rating}
                      size="sm"
                      showLabel={true}
                    />
                    {entry.final_source === 'organiser_expertise' && (
                      <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        Expertise
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Monthly Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Month</th>
                  <th className="text-center py-2">Project</th>
                  <th className="text-center py-2">Expertise</th>
                  <th className="text-center py-2">Final</th>
                  <th className="text-center py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry, index) => (
                  <tr key={entry.date} className="border-b hover:bg-muted/50">
                    <td className="py-2">
                      {format(new Date(entry.date), 'MMM yyyy')}
                    </td>
                    <td className="py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-mono">{entry.project_rating.toFixed(1)}</span>
                        <TrafficLightRatingDisplay
                          rating={entry.project_rating_label}
                          size="sm"
                        />
                      </div>
                    </td>
                    <td className="py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-mono">{entry.expertise_rating.toFixed(1)}</span>
                        <TrafficLightRatingDisplay
                          rating={entry.expertise_rating_label}
                          size="sm"
                        />
                      </div>
                    </td>
                    <td className="py-2 text-center">
                      <TrafficLightRatingDisplay
                        rating={entry.final_rating}
                        size="sm"
                        showLabel={true}
                      />
                    </td>
                    <td className="py-2 text-center">
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          entry.final_source === 'organiser_expertise'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : entry.final_source === 'project_average'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-gray-50 text-gray-700 border-gray-200'
                        }`}
                      >
                        {entry.final_source === 'organiser_expertise' ? 'Expertise' :
                         entry.final_source === 'project_average' ? 'Project' : 'Calculated'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
