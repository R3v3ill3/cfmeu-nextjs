// CFMEU Employer Rating System - Weighting Configuration Hook
// React hook for managing user weighting profiles

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@/lib/supabase/client';
import {
  UserWeightingProfile,
  Track1Weightings,
  Track2Weightings,
  CreateWeightingProfileRequest,
  UpdateWeightingProfileRequest,
  UpdateTrack1WeightingsRequest,
  UpdateTrack2WeightingsRequest,
  WeightingProfileResponse,
  WeightingProfilesResponse,
  WeightingValidationResult
} from '@/lib/weighting-system/types/WeightingTypes';
import { WeightingValidator } from '@/lib/weighting-system/WeightingValidator';

interface UseWeightingConfigurationOptions {
  autoLoad?: boolean;
  includeWeightings?: boolean;
  userRole?: string;
  profileType?: string;
  isDefault?: boolean;
}

interface WeightingState {
  profiles: UserWeightingProfile[];
  currentProfile: UserWeightingProfile | null;
  track1Weightings: Track1Weightings | null;
  track2Weightings: Track2Weightings | null;
  loading: boolean;
  error: string | null;
  validation: WeightingValidationResult | null;
}

interface WeightingActions {
  loadProfiles: () => Promise<void>;
  createProfile: (request: CreateWeightingProfileRequest) => Promise<WeightingProfileResponse>;
  updateProfile: (profileId: string, updates: UpdateWeightingProfileRequest) => Promise<WeightingProfileResponse>;
  updateTrack1Weightings: (updates: UpdateTrack1WeightingsRequest) => Promise<WeightingProfileResponse>;
  updateTrack2Weightings: (updates: UpdateTrack2WeightingsRequest) => Promise<WeightingProfileResponse>;
  deleteProfile: (profileId: string) => Promise<boolean>;
  setCurrentProfile: (profile: UserWeightingProfile | null) => void;
  validateCurrentConfiguration: () => WeightingValidationResult;
  resetState: () => void;
}

export function useWeightingConfiguration(
  options: UseWeightingConfigurationOptions = {}
): WeightingState & WeightingActions {
  const { autoLoad = true, includeWeightings = true, userRole, profileType, isDefault } = options;

  const supabase = useSupabaseClient();
  const user = useUser();

  // State management
  const [profiles, setProfiles] = useState<UserWeightingProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<UserWeightingProfile | null>(null);
  const [track1Weightings, setTrack1Weightings] = useState<Track1Weightings | null>(null);
  const [track2Weightings, setTrack2Weightings] = useState<Track2Weightings | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<WeightingValidationResult | null>(null);

  // Reset state function
  const resetState = useCallback(() => {
    setProfiles([]);
    setCurrentProfile(null);
    setTrack1Weightings(null);
    setTrack2Weightings(null);
    setLoading(false);
    setError(null);
    setValidation(null);
  }, []);

  // Load profiles from API
  const loadProfiles = useCallback(async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();

      if (userRole) queryParams.append('user_role', userRole);
      if (profileType) queryParams.append('profile_type', profileType);
      if (isDefault !== undefined) queryParams.append('is_default', isDefault.toString());
      if (includeWeightings) queryParams.append('include_weightings', 'true');

      const response = await fetch(`/api/weightings?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load profiles');
      }

      const data: WeightingProfilesResponse = await response.json();

      if (data.success && data.data) {
        setProfiles(data.data);

        // Set default profile if none selected
        if (!currentProfile && data.data.length > 0) {
          const defaultProfile = data.data.find(p => p.is_default) || data.data[0];
          setCurrentProfile(defaultProfile);

          // Extract weightings if available
          const profileWithWeightings = data.data.find(p => p.id === defaultProfile.id);
          if (profileWithWeightings) {
            setTrack1Weightings(profileWithWeightings.track1_weightings || null);
            setTrack2Weightings(profileWithWeightings.track2_weightings || null);
          }
        }
      } else {
        throw new Error(data.error || 'Unknown error loading profiles');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error loading weighting profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [user, userRole, profileType, isDefault, includeWeightings, currentProfile]);

  // Create new profile
  const createProfile = useCallback(async (
    request: CreateWeightingProfileRequest
  ): Promise<WeightingProfileResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/weightings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create profile');
      }

      const data: WeightingProfileResponse = await response.json();

      if (data.success && data.data) {
        // Update local state
        setProfiles(prev => [...prev, data.data!]);

        // Set as current profile
        setCurrentProfile(data.data);
        setTrack1Weightings(data.track1_weightings || null);
        setTrack2Weightings(data.track2_weightings || null);
        setValidation(data.validation_result || null);

        return data;
      } else {
        throw new Error(data.error || 'Unknown error creating profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error creating weighting profile:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update existing profile
  const updateProfile = useCallback(async (
    profileId: string,
    updates: UpdateWeightingProfileRequest
  ): Promise<WeightingProfileResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/weightings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_id,
          updates
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      const data: WeightingProfileResponse = await response.json();

      if (data.success && data.data) {
        // Update local state
        setProfiles(prev =>
          prev.map(p => p.id === profileId ? data.data! : p)
        );

        // Update current profile if it matches
        if (currentProfile?.id === profileId) {
          setCurrentProfile(data.data);
          setValidation(data.validation_result || null);
        }

        return data;
      } else {
        throw new Error(data.error || 'Unknown error updating profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error updating weighting profile:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, currentProfile]);

  // Update Track 1 weightings
  const updateTrack1Weightings = useCallback(async (
    updates: UpdateTrack1WeightingsRequest
  ): Promise<WeightingProfileResponse> => {
    if (!user || !currentProfile) {
      throw new Error('User not authenticated or no current profile');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/weightings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_id: currentProfile.id,
          track1_updates: updates
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update Track 1 weightings');
      }

      const data: WeightingProfileResponse = await response.json();

      if (data.success && data.track1_weightings) {
        // Update local state
        setTrack1Weightings(data.track1_weightings);
        setValidation(data.validation_result || null);

        return data;
      } else {
        throw new Error(data.error || 'Unknown error updating Track 1 weightings');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error updating Track 1 weightings:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, currentProfile]);

  // Update Track 2 weightings
  const updateTrack2Weightings = useCallback(async (
    updates: UpdateTrack2WeightingsRequest
  ): Promise<WeightingProfileResponse> => {
    if (!user || !currentProfile) {
      throw new Error('User not authenticated or no current profile');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/weightings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile_id: currentProfile.id,
          track2_updates: updates
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update Track 2 weightings');
      }

      const data: WeightingProfileResponse = await response.json();

      if (data.success && data.track2_weightings) {
        // Update local state
        setTrack2Weightings(data.track2_weightings);
        setValidation(data.validation_result || null);

        return data;
      } else {
        throw new Error(data.error || 'Unknown error updating Track 2 weightings');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error updating Track 2 weightings:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, currentProfile]);

  // Delete profile
  const deleteProfile = useCallback(async (profileId: string): Promise<boolean> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/weightings?profile_id=${profileId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete profile');
      }

      const data = await response.json();

      if (data.success) {
        // Update local state
        setProfiles(prev => prev.filter(p => p.id !== profileId));

        // Clear current profile if it was deleted
        if (currentProfile?.id === profileId) {
          setCurrentProfile(null);
          setTrack1Weightings(null);
          setTrack2Weightings(null);
          setValidation(null);
        }

        return true;
      } else {
        throw new Error(data.error || 'Unknown error deleting profile');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error deleting weighting profile:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, currentProfile]);

  // Set current profile and load its weightings
  const handleSetCurrentProfile = useCallback((profile: UserWeightingProfile | null) => {
    setCurrentProfile(profile);
    setTrack1Weightings(null);
    setTrack2Weightings(null);
    setValidation(null);

    if (profile && includeWeightings) {
      // Load weightings for this specific profile
      loadProfileWeightings(profile.id);
    }
  }, [includeWeightings]);

  // Load weightings for a specific profile
  const loadProfileWeightings = useCallback(async (profileId: string) => {
    try {
      const response = await fetch(`/api/weightings?include_weightings=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load profile weightings');
      }

      const data: WeightingProfilesResponse = await response.json();

      if (data.success && data.data) {
        const profile = data.data.find(p => p.id === profileId);
        if (profile) {
          setTrack1Weightings(profile.track1_weightings || null);
          setTrack2Weightings(profile.track2_weightings || null);
        }
      }
    } catch (err) {
      console.error('Error loading profile weightings:', err);
    }
  }, []);

  // Validate current configuration
  const validateCurrentConfiguration = useCallback((): WeightingValidationResult => {
    if (!currentProfile || !track1Weightings || !track2Weightings) {
      return {
        is_valid: false,
        validation_state: 'invalid',
        errors: [{
          field: 'configuration',
          message: 'Complete configuration not available for validation',
          current_value: null,
          severity: 'error',
          category: 'logic_validation'
        }],
        warnings: [],
        summary: {
          total_weight_sum: 0,
          track1_weight_sum: 0,
          track2_weight_sum: 0,
          balance_ratio: 0
        }
      };
    }

    const validationResult = WeightingValidator.validateCompleteConfiguration(
      currentProfile,
      track1Weightings,
      track2Weightings,
      currentProfile.user_role
    );

    setValidation(validationResult);
    return validationResult;
  }, [currentProfile, track1Weightings, track2Weightings]);

  // Auto-load profiles on mount if enabled
  useEffect(() => {
    if (autoLoad && user) {
      loadProfiles();
    }
  }, [autoLoad, user, loadProfiles]);

  // Validate configuration when it changes
  useEffect(() => {
    if (currentProfile && track1Weightings && track2Weightings) {
      validateCurrentConfiguration();
    }
  }, [currentProfile, track1Weightings, track2Weightings, validateCurrentConfiguration]);

  return {
    // State
    profiles,
    currentProfile,
    track1Weightings,
    track2Weightings,
    loading,
    error,
    validation,

    // Actions
    loadProfiles,
    createProfile,
    updateProfile,
    updateTrack1Weightings,
    updateTrack2Weightings,
    deleteProfile,
    setCurrentProfile: handleSetCurrentProfile,
    validateCurrentConfiguration,
    resetState
  };
}