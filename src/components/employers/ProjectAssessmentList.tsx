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
  Building,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Info
} from "lucide-react";
import { TrafficLightRatingDisplay } from "./TrafficLightRatingDisplay";
import { format } from "date-fns";

interface ProjectAssessment {
  id: string;
  project_id: string;
  project_name: string;
  assessment_date: string;
  overall_rating: number;
  overall_rating_label: 'red' | 'amber' | 'yellow' | 'green';
  assessment_type: string;
  confidence_level: 'very_high' | 'high' | 'medium' | 'low';
  notes?: string;
}

interface ProjectSummary {
  average_rating: number;
  average_rating_label: 'red' | 'amber' | 'yellow' | 'green';
  total_assessments: number;
  unique_projects: number;
  latest_assessment_date: string | null;
  assessment_types: string[];
}

interface ProjectAssessmentListProps {
  assessments: ProjectAssessment[];
  summary: ProjectSummary;
  onViewAssessment: (assessmentId: string) => void;
}

export function ProjectAssessmentList({ assessments, summary, onViewAssessment }: ProjectAssessmentListProps) {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");

  // Group assessments by project
  const projectGroups = assessments.reduce((groups, assessment) => {
    if (!groups[assessment.project_id]) {
      groups[assessment.project_id] = [];
    }
    groups[assessment.project_id].push(assessment);
    return groups;
  }, {} as Record<string, ProjectAssessment[]>);

  // Get unique projects for dropdown
  const projects = Object.keys(projectGroups).map(projectId => {
    const projectAssessments = projectGroups[projectId];
    return {
      id: projectId,
      name: projectAssessments[0].project_name,
      assessmentCount: projectAssessments.length,
      latestDate: projectAssessments[0].assessment_date
    };
  }).sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());

  // Filter assessments based on selected project
  const filteredAssessments = selectedProject === "all"
    ? assessments
    : assessments.filter(a => a.project_id === selectedProject);

  // Sort assessments
  const sortedAssessments = [...filteredAssessments].sort((a, b) => {
    switch (sortBy) {
      case "date":
        return new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime();
      case "rating":
        return b.overall_rating - a.overall_rating;
      case "project":
        return a.project_name.localeCompare(b.project_name);
      case "type":
        return a.assessment_type.localeCompare(b.assessment_type);
      default:
        return 0;
    }
  });

  // Calculate project-specific averages for display
  const selectedProjectAssessments = selectedProject === "all"
    ? assessments
    : assessments.filter(a => a.project_id === selectedProject);

  const projectAverage = selectedProjectAssessments.length > 0
    ? selectedProjectAssessments.reduce((sum, a) => sum + a.overall_rating, 0) / selectedProjectAssessments.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Project Assessment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div>
              <div className="text-2xl font-bold">{summary.total_assessments}</div>
              <div className="text-xs text-muted-foreground">Total Assessments</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.unique_projects}</div>
              <div className="text-xs text-muted-foreground">Projects</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.assessment_types.length}</div>
              <div className="text-xs text-muted-foreground">Assessment Types</div>
            </div>
            <div>
              <TrafficLightRatingDisplay
                rating={summary.average_rating_label}
                confidence={summary.total_assessments >= 5 ? 'high' : 'medium'}
                size="md"
                showLabel={true}
              />
              <div className="text-xs text-muted-foreground">Average Rating</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects ({summary.total_assessments})</SelectItem>
              {projects.map(project => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name} ({project.assessmentCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full sm:w-48">
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="rating">Sort by Rating</SelectItem>
              <SelectItem value="project">Sort by Project</SelectItem>
              <SelectItem value="type">Sort by Type</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selected Project Info */}
      {selectedProject !== "all" && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium">
                    {projects.find(p => p.id === selectedProject)?.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedProjectAssessments.length} assessments •
                    Latest: {format(new Date(selectedProjectAssessments[0]?.assessment_date), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <TrafficLightRatingDisplay
                  rating={Math.round(projectAverage) === 1 ? 'red' :
                         Math.round(projectAverage) === 2 ? 'amber' :
                         Math.round(projectAverage) === 3 ? 'yellow' : 'green'}
                  confidence={selectedProjectAssessments.length >= 3 ? 'high' : 'medium'}
                  size="md"
                  showLabel={true}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Project Average
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

                    <Badge variant="outline" className="text-xs">
                      {assessment.assessment_type.replace('_', ' ')}
                    </Badge>

                    <Badge
                      variant={assessment.confidence_level === 'high' ? 'default' :
                               assessment.confidence_level === 'medium' ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {assessment.confidence_level.replace('_', ' ')}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="font-medium">{assessment.project_name}</div>
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

                  {assessment.notes && (
                    <div className="text-sm text-muted-foreground bg-muted p-2 rounded">
                      {assessment.notes.length > 100
                        ? `${assessment.notes.substring(0, 100)}...`
                        : assessment.notes
                      }
                    </div>
                  )}
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
          <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No assessments found for the selected filters</p>
        </div>
      )}

      {/* Mobile-friendly summary at bottom */}
      <div className="sm:hidden">
        <Separator className="my-4" />
        <div className="text-center text-sm text-muted-foreground">
          {summary.total_assessments} assessments across {summary.unique_projects} projects
        </div>
      </div>
    </div>
  );
}
