"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CfmeuEbaBadge } from "@/components/ui/CfmeuEbaBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Info,
  Users,
  Shield,
  FileText,
  CreditCard,
  Star
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  RatingWizardFormData,
  FrequencyRating,
  Assessment4PointData,
  UnionRespectAssessment,
  SafetyAssessment,
  SubcontractorAssessment,
  ComplianceAssessment
} from "@/types/rating";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

interface RatingWizardProps {
  employerId: string;
  employerName: string;
  onSubmit: (data: RatingWizardFormData) => Promise<void>;
  onCancel: () => void;
  className?: string;
}

// 4-point frequency scale options
const frequencyOptions: { value: FrequencyRating; label: string; color: string; points: number }[] = [
  {
    value: 'always',
    label: 'Always',
    color: 'text-green-600 bg-green-50 border-green-200',
    points: 4
  },
  {
    value: 'almost_always',
    label: 'Almost Always',
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    points: 3
  },
  {
    value: 'sometimes',
    label: 'Sometimes',
    color: 'text-amber-600 bg-amber-50 border-amber-200',
    points: 2
  },
  {
    value: 'rarely_never',
    label: 'Rarely/Never',
    color: 'text-red-600 bg-red-50 border-red-200',
    points: 1
  }
];

// Assessment categories
const assessmentCategories = [
  {
    id: 'union_respect',
    name: 'Union Respect',
    description: 'Employer\'s relationship and cooperation with the union',
    icon: Users,
    criteria: [
      { id: 'right_of_entry', name: 'Right of Entry', description: 'Allows union officials access to workplace' },
      { id: 'delegate_accommodation', name: 'Delegate Accommodation', description: 'Supports and accommodates union delegates' },
      { id: 'access_to_information', name: 'Access to Information', description: 'Provides relevant information to union' },
      { id: 'access_to_inductions', name: 'Access to Inductions', description: 'Allows union participation in site inductions' }
    ]
  },
  {
    id: 'safety',
    name: 'Safety',
    description: 'Workplace health and safety performance',
    icon: Shield,
    criteria: [
      { id: 'site_safety', name: 'Site Safety', description: 'Maintains safe work practices on site' },
      { id: 'safety_procedures', name: 'Safety Procedures', description: 'Follows established safety procedures' },
      { id: 'incident_reporting', name: 'Incident Reporting', description: 'Reports safety incidents appropriately' }
    ]
  },
  {
    id: 'subcontractor',
    name: 'Subcontractor Usage',
    description: 'Treatment and management of subcontractors',
    icon: FileText,
    criteria: [
      { id: 'subcontractor_usage', name: 'Subcontractor Treatment', description: 'Treats subcontractors fairly and professionally' }
    ]
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description: 'Financial and regulatory compliance',
    icon: CreditCard,
    criteria: [
      { id: 'cbus_compliance', name: 'CBUS Compliance', description: 'Maintains CBUS superannuation compliance' },
      { id: 'incolink_compliance', name: 'Incolink Compliance', description: 'Maintains Incolink insurance compliance' },
      { id: 'payment_timing', name: 'Payment Timing', description: 'Pays workers and subcontractors on time' }
    ]
  }
];

export function RatingWizard({
  employerId,
  employerName,
  onSubmit,
  onCancel,
  className
}: RatingWizardProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assessmentData, setAssessmentData] = useState<Assessment4PointData>({
    union_respect: {
      right_of_entry: 'sometimes',
      delegate_accommodation: 'sometimes',
      access_to_information: 'sometimes',
      access_to_inductions: 'sometimes'
    },
    safety: {
      site_safety: 'sometimes',
      safety_procedures: 'sometimes',
      incident_reporting: 'sometimes'
    },
    subcontractor: {
      subcontractor_usage: 'sometimes'
    },
    compliance: {
      cbus_compliance: 'sometimes',
      incolink_compliance: 'sometimes',
      payment_timing: 'sometimes'
    }
  });

  const [additionalData, setAdditionalData] = useState({
    notes: '',
    assessment_method: '' as string,
    follow_up_required: false,
    follow_up_date: ''
  });

  // EBA status state
  const [ebaStatus, setEbaStatus] = useState<{
    hasActiveEba: boolean;
    loading: boolean;
    error?: string;
  }>({
    hasActiveEba: false,
    loading: true
  });

  // Fetch EBA status on component mount
  useEffect(() => {
    const fetchEbaStatus = async () => {
      try {
        setEbaStatus(prev => ({ ...prev, loading: true, error: undefined }));

        const response = await fetch(`/api/employers/${employerId}/eba-status`);
        if (!response.ok) {
          throw new Error(`Failed to fetch EBA status: ${response.status}`);
        }

        const data = await response.json();
        setEbaStatus({
          hasActiveEba: data.hasActiveEba || false,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching EBA status:', error);
        setEbaStatus({
          hasActiveEba: false,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    if (employerId) {
      fetchEbaStatus();
    }
  }, [employerId]);

  const totalSteps = assessmentCategories.length + 1; // Categories + Review step

  const updateAssessmentValue = useCallback((
    category: keyof Assessment4PointData,
    criterion: string,
    value: FrequencyRating
  ) => {
    setAssessmentData(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [criterion]: value
      }
    }));
  }, []);

  const calculateScore = useCallback(() => {
    let totalPoints = 0;
    let maxPoints = 0;

    Object.values(assessmentData).forEach(category => {
      Object.values(category).forEach(value => {
        const option = frequencyOptions.find(opt => opt.value === value);
        if (option) {
          totalPoints += option.points;
          maxPoints += 4; // Maximum points per criterion
        }
      });
    });

    return maxPoints > 0 ? (totalPoints / maxPoints) * 4 : 0;
  }, [assessmentData]);

  const getRatingColor = useCallback((score: number) => {
    if (score >= 3.5) return 'text-green-600 bg-green-50 border-green-200';
    if (score >= 2.5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (score >= 1.5) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-red-600 bg-red-50 border-red-200';
  }, []);

  const getRatingLabel = useCallback((score: number) => {
    if (score >= 3.5) return 'Green';
    if (score >= 2.5) return 'Yellow';
    if (score >= 1.5) return 'Amber';
    return 'Red';
  }, []);

  const handleSubmit = useCallback(async () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
      return;
    }

    // Submit form
    setIsSubmitting(true);
    try {
      const formData: RatingWizardFormData = {
        employer_id: employerId,
        track: 'organiser_expertise',
        role_context: 'organiser',
        assessment_data,
        notes: additionalData.notes || undefined,
        assessment_method: additionalData.assessment_method as any || 'other',
        follow_up_required: additionalData.follow_up_required,
        follow_up_date: additionalData.follow_up_date || null,
        confidence_factors: {}
      };

      await onSubmit(formData);
      toast({
        title: "Assessment Submitted",
        description: "Your 4-point assessment has been saved successfully.",
      });
    } catch (error) {
      console.error('Failed to submit assessment:', error);
      toast({
        title: "Submission Failed",
        description: "Unable to save your assessment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, totalSteps, employerId, assessmentData, additionalData, onSubmit, toast]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const renderAssessmentStep = (category: typeof assessmentCategories[0]) => {
    const Icon = category.icon;
    const categoryData = assessmentData[category.id as keyof Assessment4PointData];

    return (
      <div className="space-y-6">
        {/* Category Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Icon className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{category.name}</h2>
          <p className="text-sm text-muted-foreground">{category.description}</p>
        </div>

        <Separator />

        {/* Criteria */}
        <div className="space-y-4">
          {category.criteria.map((criterion) => (
            <Card key={criterion.id} className="border-l-4 border-l-blue-200">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-sm font-medium">{criterion.name}</Label>
                    <p className="text-xs text-muted-foreground mt-1">{criterion.description}</p>
                  </div>

                  <RadioGroup
                    value={categoryData[criterion.id as keyof typeof categoryData] as string}
                    onValueChange={(value) => updateAssessmentValue(
                      category.id as keyof Assessment4PointData,
                      criterion.id,
                      value as FrequencyRating
                    )}
                    className="grid grid-cols-2 gap-2"
                  >
                    {frequencyOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem value={option.value} id={`${criterion.id}-${option.value}`} />
                        <Label
                          htmlFor={`${criterion.id}-${option.value}`}
                          className={cn(
                            "text-sm cursor-pointer px-2 py-1 rounded border",
                            option.color
                          )}
                        >
                          {option.label} ({option.points}pt)
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Frequency Scale Legend */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="text-sm space-y-1">
              <p className="font-medium">4-Point Frequency Scale:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {frequencyOptions.map((option) => (
                  <div key={option.value} className={cn("px-2 py-1 rounded border", option.color)}>
                    <span className="font-medium">{option.label}:</span> {option.points} points
                  </div>
                ))}
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const renderReviewStep = () => {
    const score = calculateScore();
    const ratingLabel = getRatingLabel(score);
    const ratingColor = getRatingColor(score);

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-4">Review Assessment</h2>

          <div className="flex justify-center mb-4">
            <div className={cn("px-4 py-2 rounded-lg border", ratingColor)}>
              <div className="text-2xl font-bold">{ratingLabel}</div>
              <div className="text-sm">Score: {score.toFixed(1)}/4.0</div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Based on your assessment, {employerName} receives a {ratingLabel.toLowerCase()} rating.
          </p>
        </div>

        <Separator />

        {/* Assessment Summary */}
        <div className="space-y-4">
          <h3 className="font-medium">Assessment Summary</h3>

          {assessmentCategories.map((category) => {
            const Icon = category.icon;
            const categoryData = assessmentData[category.id as keyof Assessment4PointData];

            return (
              <Card key={category.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Icon className="h-4 w-4" />
                    {category.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {category.criteria.map((criterion) => {
                      const value = categoryData[criterion.id as keyof typeof categoryData] as FrequencyRating;
                      const option = frequencyOptions.find(opt => opt.value === value);

                      return (
                        <div key={criterion.id} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{criterion.name}</span>
                          <Badge className={cn("text-xs", option?.color)}>
                            {option?.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Additional Information */}
        <div className="space-y-4">
          <h3 className="font-medium">Additional Information</h3>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="text-sm font-medium">Assessment Method</Label>
              <Select
                value={additionalData.assessment_method}
                onValueChange={(value) => setAdditionalData(prev => ({ ...prev, assessment_method: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="How was this assessment conducted?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="site_visit">Site Visit</SelectItem>
                  <SelectItem value="phone_call">Phone Call</SelectItem>
                  <SelectItem value="union_meeting">Union Meeting</SelectItem>
                  <SelectItem value="worker_interview">Worker Interview</SelectItem>
                  <SelectItem value="document_review">Document Review</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Notes (Optional)</Label>
              <Textarea
                value={additionalData.notes}
                onChange={(e) => setAdditionalData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Add any additional context or comments..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* EBA Status Information */}
        <div className="space-y-4">
          <h3 className="font-medium">EBA Status</h3>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Enterprise Agreement Status</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    EBA status determines the maximum possible rating for this employer.
                    Without an active EBA, the employer cannot receive a green rating.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {ebaStatus.loading ? (
                    <Badge variant="outline">Loading...</Badge>
                  ) : ebaStatus.error ? (
                    <Badge variant="destructive">Error</Badge>
                  ) : ebaStatus.hasActiveEba ? (
                    <CfmeuEbaBadge
                      hasActiveEba={true}
                      builderName={employerName}
                      size="md"
                    />
                  ) : (
                    <div className="text-center">
                      <Badge variant="destructive" className="mb-1">No Active EBA</Badge>
                      <p className="text-xs text-muted-foreground">
                        Maximum rating: Amber
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Your assessment will be saved and contribute to the employer's overall traffic light rating.
            The rating system prioritises organiser expertise when there are conflicts with project data.
            {!ebaStatus.loading && !ebaStatus.hasActiveEba && (
              <span className="block mt-2 text-amber-600">
                <strong>Note:</strong> This employer does not have an active EBA, so their final rating will be capped at Amber regardless of assessment scores.
              </span>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const renderCurrentStep = () => {
    if (currentStep < assessmentCategories.length) {
      return renderAssessmentStep(assessmentCategories[currentStep]);
    }
    return renderReviewStep();
  };

  const canProceed = () => {
    if (currentStep < assessmentCategories.length) {
      const category = assessmentCategories[currentStep];
      const categoryData = assessmentData[category.id as keyof Assessment4PointData];

      return category.criteria.every(criterion => {
        const value = categoryData[criterion.id as keyof typeof categoryData];
        return value && value !== '' && value !== undefined && value !== null;
      });
    }
    return true; // Review step can always proceed
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Progress */}
      <div className="flex-shrink-0 space-y-2 p-4 sm:p-6 pb-0">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Step {currentStep + 1} of {totalSteps}</span>
          <span>{Math.round(((currentStep + 1) / totalSteps) * 100)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content - Scrollable */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 pt-4 sm:pt-6 min-h-0">
        <div className="pb-20">
          {renderCurrentStep()}
        </div>
      </div>

      {/* Navigation - Fixed at bottom */}
      <div className="flex-shrink-0 flex justify-between gap-3 p-4 pt-4 border-t bg-background/95 backdrop-blur-sm relative z-10">
        <Button
          variant="outline"
          onClick={currentStep === 0 ? onCancel : handlePrevious}
          disabled={isSubmitting}
          className="min-w-[100px]"
        >
          {currentStep === 0 ? 'Cancel' : (
            <>
              <ChevronLeft className="h-4 w-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </>
          )}
        </Button>

        <Button
          onClick={handleSubmit}
          disabled={!canProceed() || isSubmitting}
          className="min-w-[100px] flex-1"
        >
          {isSubmitting ? 'Submitting...' : (
            <>
              {currentStep === totalSteps - 1 ? 'Submit Assessment' : 'Next'}
              {currentStep < totalSteps - 1 && <ChevronRight className="h-4 w-4 ml-1 sm:ml-2" />}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}