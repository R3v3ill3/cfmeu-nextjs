"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  User,
  Building,
  FileText,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle,
  Info,
  Eye,
  TrendingUp
} from "lucide-react";
import { TrafficLightRatingDisplay } from "./TrafficLightRatingDisplay";
import { format } from "date-fns";

interface AssessmentDetailModalProps {
  assessmentId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

interface AssessmentDetail {
  assessment: {
    id: string;
    type: 'union_respect' | 'safety' | 'subcontractor' | 'expertise';
    assessment_date: string;
    overall_rating: number;
    overall_rating_label: 'red' | 'amber' | 'yellow' | 'green';
    confidence_level: 'very_high' | 'high' | 'medium' | 'low';
    project_name?: string;
    organiser_name?: string;
    assessment_method?: string;
    notes?: string;
    // Union Respect specific fields
    union_respect_details?: {
      right_of_entry_rating?: number;
      delegate_accommodation_rating?: number;
      access_to_information_rating?: number;
      access_to_inductions_rating?: number;
      eba_status_rating?: number;
    };
    // Safety specific fields
    safety_details?: {
      hsr_respect_rating?: number;
      general_safety_rating?: number;
      safety_incidents_rating?: number;
    };
    // Subcontractor specific fields
    subcontractor_details?: {
      usage_rating?: number;
      subcontractor_count?: number;
      subcontractor_percentage?: number;
      assessment_basis?: string;
    };
    // Expertise specific fields
    expertise_details?: {
      assessment_basis?: string;
      knowledge_beyond_projects?: boolean;
      union_relationship_quality?: string;
      industry_reputation?: string;
    };
  };
  created_at: string;
  updated_at: string;
}

export function AssessmentDetailModal({ assessmentId, isOpen, onClose }: AssessmentDetailModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const { data: assessmentDetail, isLoading: queryLoading, error } = useQuery({
    queryKey: ["assessment-detail-4point", assessmentId],
    queryFn: async () => {
      if (!assessmentId) return null;

      const response = await fetch(`/api/assessments/4point/${assessmentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch assessment details');
      }
      return response.json();
    },
    enabled: !!assessmentId && isOpen,
  });

  const getAssessmentTypeIcon = (type: string) => {
    switch (type) {
      case 'union_respect': return <Users className="h-5 w-5 text-blue-600" />;
      case 'safety': return <Shield className="h-5 w-5 text-green-600" />;
      case 'subcontractor': return <Building className="h-5 w-5 text-purple-600" />;
      case 'expertise': return <User className="h-5 w-5 text-orange-600" />;
      default: return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  const getAssessmentTypeLabel = (type: string) => {
    switch (type) {
      case 'union_respect': return 'Union Respect Assessment';
      case 'safety': return 'Safety Assessment';
      case 'subcontractor': return 'Subcontractor Assessment';
      case 'expertise': return 'Organiser Expertise Assessment';
      default: return 'Assessment';
    }
  };

  const getRatingCriteria = (type: string, details: any) => {
    switch (type) {
      case 'union_respect':
        return [
          { name: 'Right of Entry', rating: details?.right_of_entry_rating, max: 4 },
          { name: 'Delegate Accommodation', rating: details?.delegate_accommodation_rating, max: 4 },
          { name: 'Access to Information', rating: details?.access_to_information_rating, max: 4 },
          { name: 'Access to Inductions', rating: details?.access_to_inductions_rating, max: 4 },
          { name: 'EBA Status', rating: details?.eba_status_rating, max: 4 },
        ];
      case 'safety':
        return [
          { name: 'HSR Respect', rating: details?.hsr_respect_rating, max: 4 },
          { name: 'General Safety', rating: details?.general_safety_rating, max: 4 },
          { name: 'Safety Incidents', rating: details?.safety_incidents_rating, max: 4 },
        ];
      case 'subcontractor':
        return [
          { name: 'Usage Rating', rating: details?.usage_rating, max: 4 },
          { name: 'Subcontractor Count', rating: details?.subcontractor_count, max: null, isCount: true },
          { name: 'Coverage %', rating: details?.subcontractor_percentage, max: 100, isPercent: true },
        ];
      case 'expertise':
        return [
          { name: 'Knowledge Beyond Projects', rating: details?.knowledge_beyond_projects ? 4 : 1, max: 4, isBoolean: true },
          { name: 'Union Relationship', rating: details?.union_relationship_quality === 'excellent' ? 4 :
                                                  details?.union_relationship_quality === 'good' ? 3 :
                                                  details?.union_relationship_quality === 'neutral' ? 2 :
                                                  details?.union_relationship_quality === 'poor' ? 1 : 0, max: 4 },
        ];
      default:
        return [];
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'very_high': return 'text-green-700 bg-green-100';
      case 'high': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'low': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {assessmentDetail && getAssessmentTypeIcon(assessmentDetail.assessment.type)}
            {assessmentDetail ? getAssessmentTypeLabel(assessmentDetail.assessment.type) : 'Assessment Details'}
          </DialogTitle>
        </DialogHeader>

        {queryLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading assessment details...</span>
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Failed to load assessment details</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        ) : assessmentDetail ? (
          <div className="space-y-6">
            {/* Assessment Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Assessment Overview</span>
                  <TrafficLightRatingDisplay
                    rating={assessmentDetail.assessment.overall_rating_label}
                    confidence={assessmentDetail.assessment.confidence_level}
                    size="md"
                    showLabel={true}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {format(new Date(assessmentDetail.assessment.assessment_date), 'PPP')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getConfidenceColor(assessmentDetail.assessment.confidence_level)}`}>
                      {assessmentDetail.assessment.confidence_level.replace('_', ' ')} confidence
                    </Badge>
                  </div>

                  {assessmentDetail.assessment.project_name && (
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{assessmentDetail.assessment.project_name}</span>
                    </div>
                  )}

                  {assessmentDetail.assessment.organiser_name && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{assessmentDetail.assessment.organiser_name}</span>
                    </div>
                  )}
                </div>

                {assessmentDetail.assessment.assessment_method && (
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Method: {assessmentDetail.assessment.assessment_method.replace('_', ' ')}
                    </span>
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  Score: {assessmentDetail.assessment.overall_rating}/4
                </div>
              </CardContent>
            </Card>

            {/* Assessment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Assessment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {getRatingCriteria(assessmentDetail.assessment.type, assessmentDetail.assessment).map((criteria, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="font-medium">{criteria.name}</span>
                    <div className="flex items-center gap-2">
                      {criteria.isBoolean ? (
                        <div className="flex items-center gap-1">
                          {criteria.rating === 4 ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="text-sm">
                            {criteria.rating === 4 ? 'Yes' : 'No'}
                          </span>
                        </div>
                      ) : criteria.isPercent ? (
                        <div className="text-sm font-mono">
                          {criteria.rating?.toFixed(1) || 0}%
                        </div>
                      ) : criteria.isCount ? (
                        <div className="text-sm font-mono">
                          {criteria.rating || 0}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {[...Array(4)].map((_, i) => (
                              <div
                                key={i}
                                className={`w-2 h-2 rounded-full ${
                                  i < (criteria.rating || 0)
                                    ? 'bg-blue-500'
                                    : 'bg-gray-200'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm font-mono">
                            {criteria.rating || 0}/{criteria.max}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Assessment Notes */}
            {assessmentDetail.assessment.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    {assessmentDetail.assessment.notes}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Assessment Basis (for expertise assessments) */}
            {assessmentDetail.assessment.expertise_details?.assessment_basis && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Assessment Basis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                    {assessmentDetail.assessment.expertise_details.assessment_basis}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Created: {format(new Date(assessmentDetail.created_at), 'PPp')}</span>
                  <span>Updated: {format(new Date(assessmentDetail.updated_at), 'PPp')}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Assessment not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
