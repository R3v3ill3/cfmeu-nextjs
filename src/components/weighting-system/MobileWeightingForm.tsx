// CFMEU Employer Rating System - Mobile Weighting Form
// Mobile-optimized weighting configuration form with accessibility features

'use client';

import {  useState, useEffect  } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  UserWeightingProfile,
  Track1Weightings,
  Track2Weightings,
  ProfileType,
  UserRole,
  EmployerCategoryFocus,
  UpdateWeightingProfileRequest,
  UpdateTrack1WeightingsRequest,
  UpdateTrack2WeightingsRequest,
  MinDataRequirements,
  ConfidenceThresholds
} from '@/lib/weighting-system/types/WeightingTypes';
import { WeightingValidator } from '@/lib/weighting-system/WeightingValidator';
import {
  Settings,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  Shield,
  Users,
  Building,
  Calculator,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// Form validation schema
const profileSchema = z.object({
  profile_name: z.string().min(1, 'Profile name is required').max(100, 'Profile name must be 100 characters or less'),
  description: z.string().optional(),
  profile_type: z.enum(['personal', 'role_template', 'project_specific', 'experimental']),
  user_role: z.enum(['lead_organiser', 'admin', 'organiser', 'delegate', 'observer']),
  employer_category_focus: z.enum(['builders', 'trade_contractors', 'all']),
  project_data_weight: z.number().min(0).max(1),
  organiser_expertise_weight: z.number().min(0).max(1),
  is_default: z.boolean().default(false),
  is_public: z.boolean().default(false),
  min_data_requirements: z.object({
    min_project_assessments: z.number().min(1).max(50),
    min_expertise_assessments: z.number().min(0).max(20),
    min_data_age_days: z.number().min(1).max(1095),
    require_eba_status: z.boolean().default(false),
    require_safety_data: z.boolean().default(false)
  }),
  confidence_thresholds: z.object({
    high_confidence_min: z.number().min(0.5).max(1),
    medium_confidence_min: z.number().min(0.3).max(0.9),
    low_confidence_min: z.number().min(0.1).max(0.7),
    very_low_confidence_max: z.number().min(0).max(0.5)
  })
}).refine((data) => Math.abs((data.project_data_weight + data.organiser_expertise_weight) - 1.0) < 0.01, {
  message: 'Weights must sum to 100%',
  path: ['organiser_expertise_weight']
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface MobileWeightingFormProps {
  profile?: UserWeightingProfile | null;
  track1Weightings?: Track1Weightings | null;
  track2Weightings?: Track2Weightings | null;
  onSubmit: (data: ProfileFormData) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function MobileWeightingForm({
  profile,
  track1Weightings,
  track2Weightings,
  onSubmit,
  onCancel,
  disabled = false
}: MobileWeightingFormProps) {
  // Form state
  const [activeTab, setActiveTab] = useState('basic');
  const [track1Form, setTrack1Form] = useState<Partial<Track1Weightings>>({});
  const [track2Form, setTrack2Form] = useState<Partial<Track2Weightings>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // React Hook Form
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isValid, isDirty }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: profile ? {
      profile_name: profile.profile_name,
      description: profile.description || '',
      profile_type: profile.profile_type,
      user_role: profile.user_role,
      employer_category_focus: profile.employer_category_focus,
      project_data_weight: profile.project_data_weight,
      organiser_expertise_weight: profile.organiser_expertise_weight,
      is_default: profile.is_default,
      is_public: profile.is_public,
      min_data_requirements: profile.min_data_requirements,
      confidence_thresholds: profile.confidence_thresholds
    } : {
      profile_name: '',
      description: '',
      profile_type: 'personal' as ProfileType,
      user_role: 'lead_organiser' as UserRole,
      employer_category_focus: 'all' as EmployerCategoryFocus,
      project_data_weight: 0.6,
      organiser_expertise_weight: 0.4,
      is_default: false,
      is_public: false,
      min_data_requirements: {
        min_project_assessments: 3,
        min_expertise_assessments: 1,
        min_data_age_days: 365,
        require_eba_status: false,
        require_safety_data: false
      },
      confidence_thresholds: {
        high_confidence_min: 0.8,
        medium_confidence_min: 0.6,
        low_confidence_min: 0.4,
        very_low_confidence_max: 0.4
      }
    }
  });

  // Watch form values for real-time updates
  const watchedValues = watch();

  // Initialize track forms
  useEffect(() => {
    if (track1Weightings) {
      setTrack1Form(track1Weightings);
    }
    if (track2Weightings) {
      setTrack2Form(track2Weightings);
    }
  }, [track1Weightings, track2Weightings]);

  // Real-time validation
  useEffect(() => {
    if (!isDirty) return;

    const validateForm = async () => {
      setIsValidating(true);
      setValidationErrors([]);
      setWarnings([]);

      try {
        const formData = getValues();

        // Quick validation
        const quickValidation = WeightingValidator.validateForPreview({
          profile: formData,
          track1: track1Form,
          track2: track2Form
        });

        if (!quickValidation.isValid) {
          setValidationErrors(quickValidation.criticalErrors);
        }

        setWarnings(quickValidation.warnings);
      } catch (error) {
        console.error('Validation error:', error);
      } finally {
        setIsValidating(false);
      }
    };

    const timeoutId = setTimeout(validateForm, 500);
    return () => clearTimeout(timeoutId);
  }, [watchedValues, track1Form, track2Form, isDirty, getValues]);

  // Handle Track 1 weighting changes
  const handleTrack1Change = (field: keyof Track1Weightings, value: number) => {
    setTrack1Form(prev => ({ ...prev, [field]: value }));
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  // Handle Track 2 weighting changes
  const handleTrack2Change = (field: keyof Track2Weightings, value: number) => {
    setTrack2Form(prev => ({ ...prev, [field]: value }));
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
  };

  // Handle form submission
  const handleFormSubmit = (data: ProfileFormData) => {
    // Haptic feedback for success
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 25, 50]);
    }

    // Validate complete configuration
    const mockProfile: UserWeightingProfile = {
      ...data,
      id: profile?.id || 'temp',
      user_id: 'temp',
      is_active: true,
      version: profile?.version || 1,
      created_at: profile?.created_at || new Date(),
      updated_at: new Date(),
      created_by: 'temp',
      last_updated_by: 'temp'
    };

    const mockTrack1Weightings: Track1Weightings = {
      ...track1Form,
      id: 'temp',
      profile_id: 'temp',
      created_at: new Date(),
      updated_at: new Date()
    } as Track1Weightings;

    const mockTrack2Weightings: Track2Weightings = {
      ...track2Form,
      id: 'temp',
      profile_id: 'temp',
      created_at: new Date(),
      updated_at: new Date()
    } as Track2Weightings;

    const validation = WeightingValidator.validateCompleteConfiguration(
      mockProfile,
      mockTrack1Weightings,
      mockTrack2Weightings,
      data.user_role
    );

    if (!validation.is_valid) {
      setValidationErrors(validation.errors.map(e => e.message));
      return;
    }

    onSubmit(data);
  };

  // Ensure weights sum to 1.0
  const handleWeightBalanceChange = (field: 'project_data_weight' | 'organiser_expertise_weight', value: number) => {
    const otherField = field === 'project_data_weight' ? 'organiser_expertise_weight' : 'project_data_weight';
    const otherValue = getValues(otherField);
    const total = value + otherValue;

    if (total > 1) {
      // Adjust the other weight to maintain balance
      const adjustedOtherValue = Math.max(0, 1 - value);
      setValue(otherField, adjustedOtherValue);
    }
    setValue(field, value);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Validation Summary */}
      {(validationErrors.length > 0 || warnings.length > 0) && (
        <div className="space-y-2">
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">Validation Errors</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.slice(0, 2).map((error, index) => (
                    <li key={index} className="text-xs">{error}</li>
                  ))}
                  {validationErrors.length > 2 && (
                    <li className="text-xs">... and {validationErrors.length - 2} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          {warnings.length > 0 && (
            <Alert variant="default">
              <Info className="h-4 w-4" />
              <AlertTitle className="text-sm">Warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1">
                  {warnings.slice(0, 2).map((warning, index) => (
                    <li key={index} className="text-xs">{warning}</li>
                  ))}
                  {warnings.length > 2 && (
                    <li className="text-xs">... and {warnings.length - 2} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveValue}>
        <TabsList className="grid w-full grid-cols-3 h-auto py-2">
          <TabsTrigger value="basic" className="flex-col space-y-1 text-xs">
            <Settings className="w-4 h-4" />
            <span>Basic</span>
          </TabsTrigger>
          <TabsTrigger value="track1" className="flex-col space-y-1 text-xs">
            <TrendingUp className="w-4 h-4" />
            <span>Data</span>
          </TabsTrigger>
          <TabsTrigger value="track2" className="flex-col space-y-1 text-xs">
            <Users className="w-4 h-4" />
            <span>Expertise</span>
          </TabsTrigger>
        </TabsList>

        {/* Basic Settings Tab */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="profile_name" className="text-sm font-medium">Profile Name *</Label>
                <Input
                  id="profile_name"
                  {...register('profile_name')}
                  placeholder="e.g., Lead Organiser Balanced"
                  disabled={disabled}
                  className="mt-1"
                />
                {errors.profile_name && (
                  <p className="text-xs text-red-600 mt-1">{errors.profile_name.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Describe your weighting approach"
                  rows={2}
                  disabled={disabled}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="profile_type" className="text-sm font-medium">Profile Type</Label>
                  <Select
                    value={watchedValues.profile_type}
                    onValueChange={(value) => setValue('profile_type', value as ProfileType)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="role_template">Role Template</SelectItem>
                      <SelectItem value="project_specific">Project Specific</SelectItem>
                      <SelectItem value="experimental">Experimental</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="user_role" className="text-sm font-medium">User Role</Label>
                  <Select
                    value={watchedValues.user_role}
                    onValueChange={(value) => setValue('user_role', value as UserRole)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead_organiser">Lead Organiser</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="organiser">Organiser</SelectItem>
                      <SelectItem value="delegate">Delegate</SelectItem>
                      <SelectItem value="observer">Observer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="employer_category_focus" className="text-sm font-medium">Employer Focus</Label>
                <Select
                  value={watchedValues.employer_category_focus}
                  onValueChange={(value) => setValue('employer_category_focus', value as EmployerCategoryFocus)}
                  disabled={disabled}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employers</SelectItem>
                    <SelectItem value="builders">Builders</SelectItem>
                    <SelectItem value="trade_contractors">Trade Contractors</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Weight Balance</CardTitle>
              <CardDescription className="text-sm">
                Balance between project data and organiser expertise
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Project Data</Label>
                  <span className="text-sm font-bold text-blue-600">
                    {(watchedValues.project_data_weight * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[watchedValues.project_data_weight]}
                  onValueChange={([value]) => handleWeightBalanceChange('project_data_weight', value)}
                  max={1}
                  min={0}
                  step={0.05}
                  disabled={disabled}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Objective compliance data and project metrics
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Organiser Expertise</Label>
                  <span className="text-sm font-bold text-green-600">
                    {(watchedValues.organiser_expertise_weight * 100).toFixed(0)}%
                  </span>
                </div>
                <Slider
                  value={[watchedValues.organiser_expertise_weight]}
                  onValueChange={([value]) => handleWeightBalanceChange('organiser_expertise_weight', value)}
                  max={1}
                  min={0}
                  step={0.05}
                  disabled={disabled}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Organiser knowledge, relationships, and context
                </p>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center space-x-2 text-blue-800">
                  <Info className="w-4 h-4" />
                  <span className="text-sm font-medium">Balance Check</span>
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  Total: {((watchedValues.project_data_weight + watchedValues.organiser_expertise_weight) * 100).toFixed(0)}%
                  {Math.abs((watchedValues.project_data_weight + watchedValues.organiser_expertise_weight) - 1.0) < 0.01 ? (
                    <span className="ml-2 text-green-600">✓ Balanced</span>
                  ) : (
                    <span className="ml-2 text-orange-600">⚠ Must sum to 100%</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Track 1 Weightings Tab */}
        <TabsContent value="track1" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Project Data Weightings</CardTitle>
              <CardDescription className="text-sm">
                Configure weights for compliance categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                {/* CBUS Compliance */}
                <AccordionItem value="cbus">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center space-x-2">
                      <Shield className="w-4 h-4 text-green-600" />
                      <span>CBUS Compliance</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">Paying Compliance</Label>
                        <span className="text-xs font-medium">
                          {((track1Form.cbus_paying_weight || 0.15) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track1Form.cbus_paying_weight || 0.15]}
                        onValueChange={([value]) => handleTrack1Change('cbus_paying_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">On-time Payments</Label>
                        <span className="text-xs font-medium">
                          {((track1Form.cbus_on_time_weight || 0.10) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track1Form.cbus_on_time_weight || 0.10]}
                        onValueChange={([value]) => handleTrack1Change('cbus_on_time_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">All Workers Coverage</Label>
                        <span className="text-xs font-medium">
                          {((track1Form.cbus_all_workers_weight || 0.10) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track1Form.cbus_all_workers_weight || 0.10]}
                        onValueChange={([value]) => handleTrack1Change('cbus_all_workers_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Union Relations */}
                <AccordionItem value="union">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-blue-600" />
                      <span>Union Relations</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">Right of Entry</Label>
                        <span className="text-xs font-medium">
                          {((track1Form.union_relations_right_of_entry_weight || 0.15) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track1Form.union_relations_right_of_entry_weight || 0.15]}
                        onValueChange={([value]) => handleTrack1Change('union_relations_right_of_entry_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">Delegate Accommodation</Label>
                        <span className="text-xs font-medium">
                          {((track1Form.union_relations_delegate_accommodation_weight || 0.10) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track1Form.union_relations_delegate_accommodation_weight || 0.10]}
                        onValueChange={([value]) => handleTrack1Change('union_relations_delegate_accommodation_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Safety Performance */}
                <AccordionItem value="safety">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <span>Safety Performance</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">HSR Respect</Label>
                        <span className="text-xs font-medium">
                          {((track1Form.safety_hsr_respect_weight || 0.20) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track1Form.safety_hsr_respect_weight || 0.20]}
                        onValueChange={([value]) => handleTrack1Change('safety_hsr_respect_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">Safety Incidents</Label>
                        <span className="text-xs font-medium">
                          {((track1Form.safety_incidents_weight || 0.25) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track1Form.safety_incidents_weight || 0.25]}
                        onValueChange={([value]) => handleTrack1Change('safety_incidents_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Track 2 Weightings Tab */}
        <TabsContent value="track2" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Expertise Weightings</CardTitle>
              <CardDescription className="text-sm">
                Configure weights for organiser assessment categories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Accordion type="single" collapsible className="w-full">
                {/* Individual Assessments */}
                <AccordionItem value="assessments">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center space-x-2">
                      <Calculator className="w-4 h-4 text-purple-600" />
                      <span>Assessment Categories</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">CBUS Assessment</Label>
                        <span className="text-xs font-medium">
                          {((track2Form.cbus_overall_assessment_weight || 0.20) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track2Form.cbus_overall_assessment_weight || 0.20]}
                        onValueChange={([value]) => handleTrack2Change('cbus_overall_assessment_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">Union Relations</Label>
                        <span className="text-xs font-medium">
                          {((track2Form.union_relations_overall_weight || 0.25) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track2Form.union_relations_overall_weight || 0.25]}
                        onValueChange={([value]) => handleTrack2Change('union_relations_overall_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">Safety Culture</Label>
                        <span className="text-xs font-medium">
                          {((track2Form.safety_culture_overall_weight || 0.20) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[track2Form.safety_culture_overall_weight || 0.20]}
                        onValueChange={([value]) => handleTrack2Change('safety_culture_overall_weight', value)}
                        max={1}
                        min={0}
                        step={0.05}
                        disabled={disabled}
                        className="w-full"
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Confidence Multiplier */}
                <AccordionItem value="confidence">
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4 text-orange-600" />
                      <span>Confidence Multiplier</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label className="text-xs">Organiser Confidence</Label>
                        <span className="text-xs font-medium">
                          {(track2Form.organiser_confidence_multiplier || 1.00).toFixed(2)}x
                        </span>
                      </div>
                      <Slider
                        value={[track2Form.organiser_confidence_multiplier || 1.00]}
                        onValueChange={([value]) => handleTrack2Change('organiser_confidence_multiplier', value)}
                        max={2}
                        min={0.5}
                        step={0.1}
                        disabled={disabled}
                        className="w-full"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Multiplies the impact of organiser expertise
                      </p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="text-sm text-gray-500">
          {isValidating && (
            <span className="flex items-center space-x-1">
              <LoadingSpinner className="w-3 h-3" />
              <span>Validating...</span>
            </span>
          )}
        </div>
        <div className="flex items-center space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={disabled}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={disabled || !isValid || validationErrors.length > 0}
          >
            {isValidating ? (
              <>
                <LoadingSpinner className="w-4 h-4 mr-2" />
                Validating...
              </>
            ) : profile ? 'Update' : 'Create'}
          </Button>
        </div>
      </div>
    </form>
  );
}