// CFMEU Employer Rating System - Weighting Manager Component
// Main component for managing user-configurable weightings

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useWeightingConfiguration } from '@/hooks/useWeightingConfiguration';
import { useWeightingTemplates } from '@/hooks/useWeightingTemplates';
import { WeightingForm } from './WeightingForm';
import { WeightingPreview } from './WeightingPreview';
import { WeightingTemplates } from './WeightingTemplates';
import { WeightingComparison } from './WeightingComparison';
import {
  UserWeightingProfile,
  ProfileType,
  UserRole,
  ValidationStatus
} from '@/lib/weighting-system/types/WeightingTypes';
import {
  Settings,
  Eye,
  Copy,
  Trash2,
  Plus,
  FileText,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';

interface WeightingManagerProps {
  userRole?: UserRole;
  className?: string;
  showPreview?: boolean;
  showTemplates?: boolean;
  showComparison?: boolean;
  defaultTab?: 'profiles' | 'templates' | 'preview' | 'comparison';
}

export function WeightingManager({
  userRole = 'lead_organiser',
  className = '',
  showPreview = true,
  showTemplates = true,
  showComparison = true,
  defaultTab = 'profiles'
}: WeightingManagerProps) {
  // State management
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [editingProfile, setEditingProfile] = useState<UserWeightingProfile | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);

  // Custom hooks
  const {
    profiles,
    currentProfile,
    track1Weightings,
    track2Weightings,
    loading: profilesLoading,
    error: profilesError,
    validation,
    loadProfiles,
    createProfile,
    updateProfile,
    deleteProfile,
    setCurrentProfile,
    resetState
  } = useWeightingConfiguration({
    autoLoad: true,
    includeWeightings: true,
    userRole
  });

  const {
    templates,
    loading: templatesLoading,
    loadTemplates,
    applyTemplate,
    getPopularTemplates
  } = useWeightingTemplates({
    autoLoad: true,
    targetRole: userRole
  });

  // Load data on mount
  useEffect(() => {
    loadProfiles();
    loadTemplates();
  }, [loadProfiles, loadTemplates]);

  // Handle profile selection
  const handleProfileSelect = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setCurrentProfile(profile);
    }
  };

  // Handle profile editing
  const handleEditProfile = (profile: UserWeightingProfile) => {
    setEditingProfile(profile);
    setShowCreateDialog(true);
  };

  // Handle profile creation
  const handleCreateProfile = async (profileData: any) => {
    try {
      await createProfile({
        profile_name: profileData.profile_name,
        description: profileData.description,
        profile_type: profileData.profile_type,
        user_role: profileData.user_role,
        employer_category_focus: profileData.employer_category_focus,
        project_data_weight: profileData.project_data_weight,
        organiser_expertise_weight: profileData.organiser_expertise_weight,
        min_data_requirements: profileData.min_data_requirements,
        confidence_thresholds: profileData.confidence_thresholds,
        is_default: profileData.is_default,
        is_public: profileData.is_public
      });

      setShowCreateDialog(false);
      setEditingProfile(null);
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  // Handle profile deletion
  const handleDeleteProfile = async (profileId: string) => {
    if (confirm('Are you sure you want to delete this weighting profile? This action cannot be undone.')) {
      try {
        await deleteProfile(profileId);
      } catch (error) {
        console.error('Error deleting profile:', error);
      }
    }
  };

  // Handle template application
  const handleApplyTemplate = async (templateId: string) => {
    try {
      const templateData = await applyTemplate(templateId);

      // Create a new profile from template
      await createProfile({
        profile_name: `${templateData.profile_name} (from template)`,
        description: templateData.description,
        profile_type: templateData.profile_type,
        user_role: templateData.user_role,
        employer_category_focus: templateData.employer_category_focus,
        project_data_weight: templateData.project_data_weight,
        organiser_expertise_weight: templateData.organiser_expertise_weight,
        min_data_requirements: templateData.min_data_requirements,
        confidence_thresholds: templateData.confidence_thresholds,
        is_default: false,
        is_public: false
      });
    } catch (error) {
      console.error('Error applying template:', error);
    }
  };

  // Get validation status display
  const getValidationStatusDisplay = () => {
    if (!validation) return null;

    const { validation_state, errors, warnings } = validation;

    switch (validation_state) {
      case 'valid':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Valid
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {warnings?.length || 0} Warnings
          </Badge>
        );
      case 'invalid':
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            {errors?.length || 0} Errors
          </Badge>
        );
      default:
        return null;
    }
  };

  // Get profile type display
  const getProfileTypeDisplay = (type: ProfileType) => {
    switch (type) {
      case 'personal':
        return <Badge variant="outline">Personal</Badge>;
      case 'role_template':
        return <Badge variant="secondary">Role Template</Badge>;
      case 'project_specific':
        return <Badge variant="outline">Project Specific</Badge>;
      case 'experimental':
        return <Badge variant="secondary">Experimental</Badge>;
      default:
        return null;
    }
  };

  if (profilesLoading && !profiles.length) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner className="w-8 h-8" />
        <span className="ml-2">Loading weighting profiles...</span>
      </div>
    );
  }

  if (profilesError) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{profilesError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Weighting Configuration</h2>
          <p className="text-gray-600">Manage your personalized rating weightings</p>
        </div>
        <div className="flex items-center space-x-2">
          {validation && (
            <div className="mr-4">
              {getValidationStatusDisplay()}
            </div>
          )}
          <Button
            onClick={() => setShowCreateDialog(true)}
            disabled={profilesLoading}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Profile
          </Button>
        </div>
      </div>

      {/* Current Profile Summary */}
      {currentProfile && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span>{currentProfile.profile_name}</span>
                  {currentProfile.is_default && (
                    <Badge variant="default">Default</Badge>
                  )}
                  {getProfileTypeDisplay(currentProfile.profile_type)}
                </CardTitle>
                <CardDescription>
                  {currentProfile.description || 'No description provided'}
                </CardDescription>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditProfile(currentProfile)}
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Edit
                </Button>
                {showPreview && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreviewDialog(true)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {(currentProfile.project_data_weight * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Project Data</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {(currentProfile.organiser_expertise_weight * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-600">Organiser Expertise</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {currentProfile.employer_category_focus}
                </div>
                <div className="text-sm text-gray-600">Focus Category</div>
              </div>
            </div>

            {/* Validation Summary */}
            {validation && validation.validation_state !== 'valid' && (
              <div className="mt-4">
                {validation.errors.length > 0 && (
                  <Alert variant="destructive" className="mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Validation Errors</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside">
                        {validation.errors.slice(0, 3).map((error, index) => (
                          <li key={index}>{error.message}</li>
                        ))}
                        {validation.errors.length > 3 && (
                          <li>... and {validation.errors.length - 3} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {validation.warnings.length > 0 && (
                  <Alert variant="default" className="mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Warnings</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside">
                        {validation.warnings.slice(0, 3).map((warning, index) => (
                          <li key={index}>{warning.message}</li>
                        ))}
                        {validation.warnings.length > 3 && (
                          <li>... and {validation.warnings.length - 3} more</li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profiles" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Profiles</span>
          </TabsTrigger>
          {showTemplates && (
            <TabsTrigger value="templates" className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Templates</span>
            </TabsTrigger>
          )}
          {showPreview && (
            <TabsTrigger value="preview" className="flex items-center space-x-2">
              <Eye className="w-4 h-4" />
              <span>Preview</span>
            </TabsTrigger>
          )}
          {showComparison && (
            <TabsTrigger value="comparison" className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4" />
              <span>Comparison</span>
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profiles Tab */}
        <TabsContent value="profiles">
          <Card>
            <CardHeader>
              <CardTitle>Weighting Profiles</CardTitle>
              <CardDescription>
                Your personalized weighting configurations for employer ratings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {profiles.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No profiles yet</h3>
                  <p className="text-gray-600 mb-4">Create your first weighting profile to get started</p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Profile
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      className={`flex items-center justify-between p-4 border rounded-lg ${
                        currentProfile?.id === profile.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{profile.profile_name}</h3>
                          {profile.is_default && <Badge variant="default">Default</Badge>}
                          {getProfileTypeDisplay(profile.profile_type)}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {profile.description || 'No description'}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>Role: {profile.user_role}</span>
                          <span>Focus: {profile.employer_category_focus}</span>
                          <span>Updated: {new Date(profile.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant={currentProfile?.id === profile.id ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleProfileSelect(profile.id)}
                        >
                          {currentProfile?.id === profile.id ? 'Active' : 'Select'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditProfile(profile)}
                        >
                          <Settings className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Clone profile logic
                            const clonedProfile = {
                              ...profile,
                              profile_name: `${profile.profile_name} (Copy)`,
                              is_default: false
                            };
                            handleEditProfile(clonedProfile as any);
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        {!profile.is_default && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProfile(profile.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        {showTemplates && (
          <TabsContent value="templates">
            <WeightingTemplates
              onApplyTemplate={handleApplyTemplate}
              userRole={userRole}
            />
          </TabsContent>
        )}

        {/* Preview Tab */}
        {showPreview && (
          <TabsContent value="preview">
            <WeightingPreview
              profile={currentProfile}
              track1Weightings={track1Weightings}
              track2Weightings={track2Weightings}
            />
          </TabsContent>
        )}

        {/* Comparison Tab */}
        {showComparison && (
          <TabsContent value="comparison">
            <WeightingComparison
              profiles={profiles}
              currentProfile={currentProfile}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Create/Edit Profile Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProfile ? 'Edit Weighting Profile' : 'Create Weighting Profile'}
            </DialogTitle>
            <DialogDescription>
              {editingProfile
                ? 'Modify your weighting configuration for employer ratings'
                : 'Create a new personalized weighting configuration'
              }
            </DialogDescription>
          </DialogHeader>
          <WeightingForm
            profile={editingProfile}
            track1Weightings={track1Weightings}
            track2Weightings={track2Weightings}
            onSubmit={handleCreateProfile}
            onCancel={() => {
              setShowCreateDialog(false);
              setEditingProfile(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Weighting Preview</DialogTitle>
            <DialogDescription>
              See how your weightings affect employer ratings
            </DialogDescription>
          </DialogHeader>
          <WeightingPreview
            profile={currentProfile}
            track1Weightings={track1Weightings}
            track2Weightings={track2Weightings}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}