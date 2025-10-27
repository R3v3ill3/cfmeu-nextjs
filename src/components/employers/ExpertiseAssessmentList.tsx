"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  Calendar,
  Users,
  User,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
  Plus
} from "lucide-react";
import { TrafficLightRatingDisplay } from "./TrafficLightRatingDisplay";
import { format } from "date-fns";

interface ExpertiseAssessment {
  id: string;
  assessment_date: string;
  overall_rating: number;
  overall_rating_label: 'red' | 'amber' | 'yellow' | 'green';
  confidence_level: 'very_high' | 'high' | 'medium' | 'low';
  organiser_name: string;
  assessment_basis: string;
  notes?: string;
}

interface ExpertiseSummary {
  average_rating: number;
  average_rating_label: 'red' | 'amber' | 'yellow' | 'green';
  total_assessments: number;
  unique_organisers: number;
  latest_assessment_date: string | null;
  has_conflicts: boolean;
}

interface ExpertiseAssessmentListProps {
  assessments: ExpertiseAssessment[];
  summary: ExpertiseSummary;
  onViewAssessment: (assessmentId: string) => void;
  onLaunchWizard: () => void;
}

export function ExpertiseAssessmentList({
  assessments,
  summary,
  onViewAssessment,
  onLaunchWizard
}: ExpertiseAssessmentListProps) {
  const [sortBy, setSortBy] = useState<string>("date");

  // Group assessments by organiser
  const organiserGroups = assessments.reduce((groups, assessment) => {
    if (!groups[assessment.organiser_name]) {
      groups[assessment.organiser_name] = [];
    }
    groups[assessment.organiser_name].push(assessment);
    return groups;
  }, {} as Record<string, ExpertiseAssessment[]>);

  // Get unique organisers for display
  const organisers = Object.keys(organiserGroups).map(organiserName => {
    const organiserAssessments = organiserGroups[organiserName];
    return {
      name: organiserName,
      assessmentCount: organiserAssessments.length,
      latestDate: organiserAssessments[0].assessment_date,
      averageRating: organiserAssessments.reduce((sum, a) => sum + a.overall_rating, 0) / organiserAssessments.length
    };
  }).sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());

  // Sort assessments
  const sortedAssessments = [...assessments].sort((a, b) => {
    switch (sortBy) {
      case "date":
        return new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime();
      case "rating":
        return b.overall_rating - a.overall_rating;
      case "organiser":
        return a.organiser_name.localeCompare(b.organiser_name);
      case "confidence":
        const confidenceOrder = { very_high: 4, high: 3, medium: 2, low: 1 };
        return confidenceOrder[b.confidence_level] - confidenceOrder[a.confidence_level];
      default:
        return 0;
    }
  });

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Organiser Expertise Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold">{summary.total_assessments}</div>
              <div className="text-xs text-muted-foreground">Total Assessments</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.unique_organisers}</div>
              <div className="text-xs text-muted-foreground">Organisers</div>
            </div>
            <div>
              <TrafficLightRatingDisplay
                rating={summary.average_rating_label}
                confidence={summary.total_assessments >= 3 ? 'high' : 'medium'}
                size="md"
                showLabel={true}
              />
              <div className="text-xs text-muted-foreground">Average Rating</div>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                {summary.has_conflicts ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <div className="text-2xl font-bold text-amber-600">Conflict</div>
                  </>
                ) : (
                  <>
                    <div className="w-5 h-5 rounded-full bg-green-500"></div>
                    <div className="text-2xl font-bold">Aligned</div>
                  </>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {summary.has_conflicts ? 'Rating Conflict' : 'No Conflicts'}
              </div>
            </div>
          </div>

          {/* Conflict Warning */}
          {summary.has_conflicts && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-amber-800">Rating Conflict Detected</div>
                  <div className="text-amber-700 mt-1">
                    Project data and organiser expertise ratings differ significantly.
                    The organiser expertise assessment takes priority in the overall rating.
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Assessment Button */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          Add a new organiser assessment to improve rating confidence
        </div>
        <Button onClick={onLaunchWizard} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Assessment
        </Button>
      </div>

      {/* Sort Filter */}
      <div className="flex justify-end">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="rating">Sort by Rating</SelectItem>
            <SelectItem value="organiser">Sort by Organiser</SelectItem>
            <SelectItem value="confidence">Sort by Confidence</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assessment List */}
      <div className="space-y-3">
        {sortedAssessments.map((assessment, index) => (
          <Card key={assessment.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {format(new Date(assessment.assessment_date), 'MMM d, yyyy')}
                      </span>
                    </div>

                    <Badge
                      variant={assessment.confidence_level === 'high' ? 'default' :
                               assessment.confidence_level === 'medium' ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {assessment.confidence_level.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{assessment.organiser_name}</span>
                    </div>
                    <TrafficLightRatingDisplay
                      rating={assessment.overall_rating_label}
                      confidence={assessment.confidence_level}
                      size="sm"
                      showLabel={true}
                    />
                    <div className="text-sm text-muted-foreground">
                      Score: {assessment.overall_rating}/4
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                    <div className="font-medium mb-1">Assessment Basis:</div>
                    {assessment.assessment_basis.length > 120
                      ? `${assessment.assessment_basis.substring(0, 120)}...`
                      : assessment.assessment_basis
                    }
                  </div>
                </div>

                <div className="ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewAssessment(assessment.id)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {sortedAssessments.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No organiser expertise assessments available</p>
          <p className="text-sm mt-1">Launch the rating wizard to add the first assessment</p>
          <Button variant="outline" className="mt-4" onClick={onLaunchWizard}>
            <Plus className="h-4 w-4 mr-1" />
            Start Assessment
          </Button>
        </div>
      )}

      {/* Mobile-friendly summary at bottom */}
      <div className="sm:hidden">
        <Separator className="my-4" />
        <div className="text-center text-sm text-muted-foreground">
          {summary.total_assessments} assessments from {summary.unique_organisers} organisers
          {summary.has_conflicts && " • Rating conflict detected"}
        </div>
      </div>
    </div>
  );
}
