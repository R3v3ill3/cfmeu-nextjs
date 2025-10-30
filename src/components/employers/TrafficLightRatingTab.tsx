"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  Users,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Info,
  Eye,
  Plus,
  Calendar,
  Target
} from "lucide-react";
import { TrafficLightRatingDisplay } from "./TrafficLightRatingDisplay";
import { ProjectAssessmentList } from "./ProjectAssessmentList";
import { ExpertiseAssessmentList } from "./ExpertiseAssessmentList";
import { RatingHistoryChart } from "./RatingHistoryChart";
import { AssessmentDetailModal } from "./AssessmentDetailModal";
import { RatingWizardModal } from "./RatingWizardModal";
import { ProjectCountIndicator } from "./ProjectCountIndicator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface TrafficLightRatingTabProps {
  employerId: string;
  employerName: string;
}

export function TrafficLightRatingTab({ employerId, employerName }: TrafficLightRatingTabProps) {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedAssessment, setSelectedAssessment] = useState<string | null>(null);
  const [showAssessmentDetail, setShowAssessmentDetail] = useState(false);
  const [showRatingWizard, setShowRatingWizard] = useState(false);

  // Fetch 4-point rating data
  const { data: ratingData, isLoading, error } = useQuery({
    queryKey: ["employer-ratings-4point", employerId],
    queryFn: async () => {
      const response = await fetch(`/api/employers/${employerId}/ratings-4point`);
      if (!response.ok) {
        throw new Error('Failed to fetch rating data');
      }
      return response.json();
    },
    enabled: !!employerId,
  });

  const handleViewAssessment = (assessmentId: string) => {
    setSelectedAssessment(assessmentId);
    setShowAssessmentDetail(true);
  };

  const handleLaunchWizard = () => {
    setShowRatingWizard(true);
  };

  const handleWizardComplete = () => {
    setShowRatingWizard(false);
    // Refresh rating data
    window.location.reload(); // Simple refresh for now
    toast({
      title: "Rating Updated",
      description: "Your assessment has been saved successfully.",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading rating data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load rating data. Please try again later.
          {error.message && <div className="mt-1 text-xs text-muted-foreground">{error.message}</div>}
        </AlertDescription>
      </Alert>
    );
  }

  if (!ratingData) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No rating data available for this employer.
        </AlertDescription>
      </Alert>
    );
  }

  const { current_rating, project_assessments, expertise_assessments, rating_history, data_quality, project_count_data, error: apiError } = ratingData;

  // Show error message if API returned an error
  if (apiError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-medium">4-Point Rating System Not Available</div>
          <div className="mt-1">{apiError}</div>
          <div className="mt-2 text-xs">
            This may be because:
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>The 4-point rating system feature flag is disabled</li>
              <li>The database migrations have not been run yet</li>
              <li>The required database tables do not exist</li>
            </ul>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Rating Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Current Rating Overview
          </CardTitle>
          <CardDescription>
            Traffic light rating based on project assessments and organiser expertise
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Overall Rating */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Overall Rating</div>
              {current_rating ? (
                <div className="space-y-1">
                  <TrafficLightRatingDisplay
                    rating={current_rating.rating}
                    confidence={current_rating.confidence}
                    source={current_rating.source}
                    size="lg"
                    showLabel={true}
                    showConfidence={true}
                  />
                  <div className="text-xs text-muted-foreground">
                    Score: {current_rating.score}/4
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No rating available</div>
              )}
            </div>

            {/* Project Data (Track 1) */}
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Project Data</div>
              {project_assessments?.summary ? (
                <div className="space-y-1">
                  <TrafficLightRatingDisplay
                    rating={project_assessments.summary.average_rating_label}
                    confidence={project_assessments.summary.total_assessments >= 5 ? 'high' : 'medium'}
                    size="md"
                    showLabel={true}
                    showConfidence={false}
                  />
                  <div className="text-xs text-muted-foreground">
                    {project_assessments.summary.total_assessments} assessments
                    <br className="hidden sm:block" />
                    <span className="sm:hidden"> • </span>
                    {project_assessments.summary.unique_projects} projects
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No project data</div>
              )}
            </div>

            {/* Organiser Expertise (Track 2) */}
            <div className="text-center space-y-2 sm:col-span-2 lg:col-span-1">
              <div className="text-sm font-medium text-muted-foreground">Organiser Expertise</div>
              {expertise_assessments?.summary ? (
                <div className="space-y-1">
                  <TrafficLightRatingDisplay
                    rating={expertise_assessments.summary.average_rating_label}
                    confidence={expertise_assessments.summary.total_assessments >= 3 ? 'high' : 'medium'}
                    size="md"
                    showLabel={true}
                    showConfidence={false}
                  />
                  <div className="text-xs text-muted-foreground">
                    {expertise_assessments.summary.total_assessments} assessments
                    <br className="hidden sm:block" />
                    <span className="sm:hidden"> • </span>
                    {expertise_assessments.summary.unique_organisers} organisers
                  </div>
                  {expertise_assessments.summary.has_conflicts && (
                    <div className="flex items-center justify-center gap-1 text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      <span className="text-xs">Conflict detected</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-muted-foreground">No expertise data</div>
              )}
            </div>
          </div>

          {/* Project Count Data */}
          {project_count_data && (
            <div className="mt-4 pt-4 border-t">
              <ProjectCountIndicator data={project_count_data} />
            </div>
          )}

          {/* Data Quality Indicator */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Data Quality: <span className="capitalize font-medium">{data_quality}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={data_quality === 'high' ? 'default' : data_quality === 'medium' ? 'secondary' : 'destructive'}>
                  {data_quality === 'high' ? 'High' : data_quality === 'medium' ? 'Medium' : 'Low'}
                </Badge>
                <Button variant="outline" size="sm" onClick={handleLaunchWizard}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Assessment
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Assessment Tabs */}
      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="projects" className="text-xs sm:text-sm py-2">
            Project<br className="sm:hidden" />
            <span className="hidden sm:inline"> </span>Assessments
          </TabsTrigger>
          <TabsTrigger value="expertise" className="text-xs sm:text-sm py-2">
            Organiser<br className="sm:hidden" />
            <span className="hidden sm:inline"> </span>Expertise
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm py-2">
            Rating<br className="sm:hidden" />
            <span className="hidden sm:inline"> </span>History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Project-Based Assessments
              </CardTitle>
              <CardDescription>
                Compliance assessments from specific projects
              </CardDescription>
            </CardHeader>
            <CardContent>
              {project_assessments?.assessments && project_assessments.assessments.length > 0 ? (
                <ProjectAssessmentList
                  assessments={project_assessments.assessments}
                  summary={project_assessments.summary}
                  onViewAssessment={handleViewAssessment}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No project assessments available</p>
                  <p className="text-sm mt-1">Complete assessments in the project compliance tabs to generate ratings</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expertise" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Organiser Expertise Assessments
              </CardTitle>
              <CardDescription>
                Overall employer ratings based on organiser knowledge and experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              {expertise_assessments?.assessments && expertise_assessments.assessments.length > 0 ? (
                <ExpertiseAssessmentList
                  assessments={expertise_assessments.assessments}
                  summary={expertise_assessments.summary}
                  onViewAssessment={handleViewAssessment}
                  onLaunchWizard={handleLaunchWizard}
                />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No organiser expertise assessments available</p>
                  <p className="text-sm mt-1">Launch the rating wizard to add an assessment</p>
                  <Button variant="outline" className="mt-4" onClick={handleLaunchWizard}>
                    <Plus className="h-4 w-4 mr-1" />
                    Start Assessment
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Rating History
              </CardTitle>
              <CardDescription>
                Historical rating trends over the last 6 months
              </CardDescription>
            </CardHeader>
            <CardContent>
              {rating_history && rating_history.length > 0 ? (
                <RatingHistoryChart history={rating_history} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No rating history available</p>
                  <p className="text-sm mt-1">Rating history will appear after multiple assessments</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assessment Detail Modal */}
      <AssessmentDetailModal
        assessmentId={selectedAssessment}
        isOpen={showAssessmentDetail}
        onClose={() => setShowAssessmentDetail(false)}
      />

      {/* Rating Wizard Modal */}
      <RatingWizardModal
        employerId={employerId}
        employerName={employerName}
        isOpen={showRatingWizard}
        onClose={() => setShowRatingWizard(false)}
        onComplete={handleWizardComplete}
      />
    </div>
  );
}
