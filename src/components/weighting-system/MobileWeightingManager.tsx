// CFMEU Employer Rating System - Mobile Weighting Manager
// Mobile-optimized weighting management interface with accessibility features

'use client';

import {  useState, useEffect  } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useWeightingConfiguration } from '@/hooks/useWeightingConfiguration';
import { useWeightingTemplates } from '@/hooks/useWeightingTemplates';
import { MobileWeightingForm } from './MobileWeightingForm';
import { MobileWeightingPreview } from './MobileWeightingPreview';
import {
  UserWeightingProfile,
  ProfileType,
  UserRole,
  ValidationStatus
} from '@/lib/weighting-system/types/WeightingTypes';
import {
  Settings,
  Eye,
  Plus,
  FileText,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Menu,
  X,
  ChevronRight,
  Smartphone,
  TrendingUp,
  TrendingDown,
  Info
} from 'lucide-react';

interface MobileWeightingManagerProps {
  userRole?: UserRole;
  className?: string;
}

export function MobileWeightingManager({
  userRole = 'lead_organiser',
  className = ''
}: MobileWeightingManagerProps) {
  // State management
  const [activeTab, setActiveTab] = useState('profiles');
  const [editingProfile, setEditingProfile] = useState<UserWeightingProfile | null>(null);
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

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
    setCurrentProfile
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

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle profile selection
  const handleProfileSelect = (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setCurrentProfile(profile);
      // Haptic feedback on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  };

  // Handle profile editing
  const handleEditProfile = (profile: UserWeightingProfile) => {
    setEditingProfile(profile);
    setShowCreateSheet(true);
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

      setShowCreateSheet(false);
      setEditingProfile(null);

      // Success feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch (error) {
      console.error('Error creating profile:', error);
    }
  };

  // Handle profile deletion
  const handleDeleteProfile = async (profileId: string) => {
    if (confirm('Are you sure you want to delete this weighting profile? This action cannot be undone.')) {
      try {
        await deleteProfile(profileId);
        // Success feedback
        if ('vibrate' in navigator) {
          navigator.vibrate([100, 50, 100]);
        }
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

      // Success feedback
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100]);
      }
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
    const variants = {
      personal: 'bg-blue-100 text-blue-800',
      role_template: 'bg-purple-100 text-purple-800',
      project_specific: 'bg-green-100 text-green-800',
      experimental: 'bg-orange-100 text-orange-800'
    };

    return (
      <Badge className={variants[type] || 'bg-gray-100 text-gray-800'}>
        {type.replace('_', ' ')}
      </Badge>
    );
  };

  // Offline indicator
  if (isOffline) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <Smartphone className="h-4 w-4" />
          <AlertTitle>Offline Mode</AlertTitle>
          <AlertDescription>
            You're currently offline. Some features may not be available until you reconnect.
          </AlertDescription>
        </Alert>

        <Card>
          <CardContent className="p-6 text-center">
            <Smartphone className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Offline</h3>
            <p className="text-gray-600">
              Check your internet connection to access weighting management features.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    <div className={`space-y-4 ${className}`}>
      {/* Mobile Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Weightings</h2>
          <p className="text-sm text-gray-600">Manage rating configurations</p>
        </div>
        <div className="flex items-center space-x-2">
          {validation && (
            <div className="mr-2">
              {getValidationStatusDisplay()}
            </div>
          )}
          <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
            <SheetTrigger asChild>
              <Button size="sm" disabled={profilesLoading}>
                <Plus className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>
                  {editingProfile ? 'Edit Weighting Profile' : 'Create Weighting Profile'}
                </SheetTitle>
                <SheetDescription>
                  {editingProfile
                    ? 'Modify your weighting configuration'
                    : 'Create a new personalized weighting configuration'
                  }
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6">
                <MobileWeightingForm
                  profile={editingProfile}
                  track1Weightings={track1Weightings}
                  track2Weightings={track2Weightings}
                  onSubmit={handleCreateProfile}
                  onCancel={() => {
                    setShowCreateSheet(false);
                    setEditingProfile(null);
                  }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Current Profile Summary */}
      {currentProfile && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{currentProfile.profile_name}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  {currentProfile.is_default && (
                    <Badge variant="default" className="text-xs">Default</Badge>
                  )}
                  {getProfileTypeDisplay(currentProfile.profile_type)}
                </div>
              </div>
              <Sheet open={showPreviewSheet} onOpenChange={setShowPreviewSheet}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>Weighting Preview</SheetTitle>
                    <SheetDescription>
                      See how your weightings affect employer ratings
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <MobileWeightingPreview
                      profile={currentProfile}
                      track1Weightings={track1Weightings}
                      track2Weightings={track2Weightings}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-lg font-bold text-blue-600">
                  {(currentProfile.project_data_weight * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-600">Data</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  {(currentProfile.organiser_expertise_weight * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-gray-600">Expertise</div>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="text-lg font-bold text-purple-600">
                  {currentProfile.employer_category_focus === 'all' ? 'All' :
                   currentProfile.employer_category_focus === 'builders' ? 'Builders' : 'Trades'}
                </div>
                <div className="text-xs text-gray-600">Focus</div>
              </div>
            </div>

            {/* Validation Summary */}
            {validation && validation.validation_state !== 'valid' && (
              <div className="mt-3">
                {validation.errors.length > 0 && (
                  <Alert variant="destructive" className="mb-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Validation Issues</AlertTitle>
                    <AlertDescription className="text-xs">
                      {validation.errors.slice(0, 2).map((error, index) => (
                        <div key={index}>• {error.message}</div>
                      ))}
                      {validation.errors.length > 2 && (
                        <div>• ... and {validation.errors.length - 2} more</div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center space-x-2 mt-4">
              <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditProfile(currentProfile)}
                  >
                    <Settings className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </SheetTrigger>
              </Sheet>
              <Sheet open={showPreviewSheet} onOpenChange={setShowPreviewSheet}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                </SheetTrigger>
              </Sheet>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveValue}>
        <TabsList className="grid w-full grid-cols-3 h-auto py-2">
          <TabsTrigger value="profiles" className="flex-col space-y-1 text-xs">
            <Settings className="w-4 h-4" />
            <span>Profiles</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex-col space-y-1 text-xs">
            <FileText className="w-4 h-4" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-col space-y-1 text-xs">
            <Eye className="w-4 h-4" />
            <span>Preview</span>
          </TabsTrigger>
        </TabsList>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          {profiles.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Settings className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No profiles yet</h3>
                <p className="text-gray-600 mb-4">Create your first weighting profile</p>
                <Button onClick={() => setShowCreateSheet(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Profile
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile) => (
                <Card
                  key={profile.id}
                  className={`cursor-pointer transition-colors ${
                    currentProfile?.id === profile.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleProfileSelect(profile.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{profile.profile_name}</h4>
                          {profile.is_default && <Badge variant="default" className="text-xs">Default</Badge>}
                          {getProfileTypeDisplay(profile.profile_type)}
                        </div>
                        <p className="text-xs text-gray-600 mb-2">
                          {profile.description || 'No description'}
                        </p>
                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                          <span>Role: {profile.user_role.replace('_', ' ')}</span>
                          <span>Focus: {profile.employer_category_focus}</span>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>

                    {/* Quick Actions */}
                    {currentProfile?.id === profile.id && (
                      <div className="flex items-center space-x-2 mt-3 pt-3 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProfile(profile);
                          }}
                        >
                          <Settings className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Sheet open={showPreviewSheet} onOpenChange={setShowPreviewSheet}>
                          <SheetTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Preview
                            </Button>
                          </SheetTrigger>
                        </Sheet>
                        {!profile.is_default && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProfile(profile.id);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.slice(0, 5).map((template) => (
                <div
                  key={template.id}
                  className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-sm">{template.template_name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {template.template_category}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {template.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      {template.usage_count || 0} uses
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleApplyTemplate(template.id)}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="space-y-4">
          {currentProfile ? (
            <MobileWeightingPreview
              profile={currentProfile}
              track1Weightings={track1Weightings}
              track2Weightings={track2Weightings}
            />
          ) : (
            <Card>
              <CardContent className="p-6 text-center">
                <Eye className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Profile Selected</h3>
                <p className="text-gray-600">Select a profile to preview its impact</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}