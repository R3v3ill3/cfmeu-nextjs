// CFMEU Employer Rating System - Weighting Templates Hook
// React hook for managing weighting templates and presets

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '@/lib/supabase/client';
import {
  WeightingTemplate,
  WeightingTemplatesResponse,
  TemplateCategory,
  UserRole,
  WeightingTemplateData
} from '@/lib/weighting-system/types/WeightingTypes';

interface UseWeightingTemplatesOptions {
  autoLoad?: boolean;
  category?: TemplateCategory;
  targetRole?: UserRole;
  employerType?: string;
  isSystemTemplate?: boolean;
  searchQuery?: string;
  includeInactive?: boolean;
}

interface TemplateState {
  templates: WeightingTemplate[];
  categories: TemplateCategory[];
  loading: boolean;
  error: string | null;
  selectedTemplate: WeightingTemplate | null;
}

interface TemplateActions {
  loadTemplates: () => Promise<void>;
  createTemplate: (templateData: Omit<WeightingTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'average_rating'>) => Promise<WeightingTemplate>;
  updateTemplate: (templateId: string, updates: Partial<WeightingTemplate>) => Promise<WeightingTemplate>;
  deleteTemplate: (templateId: string) => Promise<boolean>;
  applyTemplate: (templateId: string) => Promise<WeightingTemplateData>;
  rateTemplate: (templateId: string, rating: number) => Promise<boolean>;
  searchTemplates: (query: string) => Promise<void>;
  filterTemplates: (filters: UseWeightingTemplatesOptions) => Promise<void>;
  setSelectedTemplate: (template: WeightingTemplate | null) => void;
  getTemplatesByCategory: (category: TemplateCategory) => WeightingTemplate[];
  getPopularTemplates: (limit?: number) => WeightingTemplate[];
  getTopRatedTemplates: (limit?: number) => WeightingTemplate[];
  resetState: () => void;
}

export function useWeightingTemplates(
  options: UseWeightingTemplatesOptions = {}
): TemplateState & TemplateActions {
  const {
    autoLoad = true,
    category,
    targetRole,
    employerType,
    isSystemTemplate,
    searchQuery,
    includeInactive = false
  } = options;

  const supabase = useSupabaseClient();
  const user = useUser();

  // State management
  const [templates, setTemplates] = useState<WeightingTemplate[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WeightingTemplate | null>(null);

  // Current filters
  const [currentFilters, setCurrentFilters] = useState<UseWeightingTemplatesOptions>(options);

  // Reset state function
  const resetState = useCallback(() => {
    setTemplates([]);
    setCategories([]);
    setLoading(false);
    setError(null);
    setSelectedTemplate(null);
    setCurrentFilters(options);
  }, [options]);

  // Load templates from API
  const loadTemplates = useCallback(async () => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams();

      if (currentFilters.category) queryParams.append('category', currentFilters.category);
      if (currentFilters.targetRole) queryParams.append('target_role', currentFilters.targetRole);
      if (currentFilters.employerType && currentFilters.employerType !== 'all') {
        queryParams.append('employer_type', currentFilters.employerType);
      }
      if (currentFilters.isSystemTemplate !== undefined) {
        queryParams.append('is_system_template', currentFilters.isSystemTemplate.toString());
      }
      if (!currentFilters.includeInactive) {
        queryParams.append('is_active', 'true');
      }
      if (currentFilters.searchQuery) {
        queryParams.append('search', currentFilters.searchQuery);
      }

      const response = await fetch(`/api/weightings/templates?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to load templates');
      }

      const data: WeightingTemplatesResponse = await response.json();

      if (data.success) {
        setTemplates(data.data || []);
        setCategories(data.categories || []);
      } else {
        throw new Error(data.error || 'Unknown error loading templates');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error loading weighting templates:', err);
    } finally {
      setLoading(false);
    }
  }, [user, currentFilters]);

  // Create new template
  const createTemplate = useCallback(async (
    templateData: Omit<WeightingTemplate, 'id' | 'created_at' | 'updated_at' | 'usage_count' | 'average_rating'>
  ): Promise<WeightingTemplate> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/weightings/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create template');
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Update local state
        setTemplates(prev => [...prev, data.data]);
        return data.data;
      } else {
        throw new Error(data.error || 'Unknown error creating template');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error creating weighting template:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Update existing template
  const updateTemplate = useCallback(async (
    templateId: string,
    updates: Partial<WeightingTemplate>
  ): Promise<WeightingTemplate> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/weightings/templates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          updates
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update template');
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Update local state
        setTemplates(prev =>
          prev.map(t => t.id === templateId ? data.data : t)
        );

        // Update selected template if it matches
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(data.data);
        }

        return data.data;
      } else {
        throw new Error(data.error || 'Unknown error updating template');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error updating weighting template:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, selectedTemplate]);

  // Delete template
  const deleteTemplate = useCallback(async (templateId: string): Promise<boolean> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/weightings/templates?template_id=${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete template');
      }

      const data = await response.json();

      if (data.success) {
        // Update local state
        setTemplates(prev => prev.filter(t => t.id !== templateId));

        // Clear selected template if it was deleted
        if (selectedTemplate?.id === templateId) {
          setSelectedTemplate(null);
        }

        return true;
      } else {
        throw new Error(data.error || 'Unknown error deleting template');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      console.error('Error deleting weighting template:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user, selectedTemplate]);

  // Apply template to create profile
  const applyTemplate = useCallback(async (templateId: string): Promise<WeightingTemplateData> => {
    const template = templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Increment usage count
    try {
      await fetch('/api/weightings/templates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          updates: {
            usage_count: (template.usage_count || 0) + 1
          }
        }),
      });

      // Update local state
      setTemplates(prev =>
        prev.map(t => t.id === templateId
          ? { ...t, usage_count: (t.usage_count || 0) + 1 }
          : t
        )
      );
    } catch (err) {
      console.error('Error updating template usage count:', err);
      // Don't throw error here, as the main functionality still works
    }

    return template.template_data;
  }, [templates]);

  // Rate template
  const rateTemplate = useCallback(async (templateId: string, rating: number): Promise<boolean> => {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const template = templates.find(t => t.id === templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    try {
      // Calculate new average rating
      const currentCount = template.usage_count || 1;
      const currentAverage = template.average_rating || 0;
      const newAverage = ((currentAverage * currentCount) + rating) / (currentCount + 1);

      const response = await fetch('/api/weightings/templates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_id: templateId,
          updates: {
            average_rating: newAverage
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to rate template');
      }

      // Update local state
      setTemplates(prev =>
        prev.map(t => t.id === templateId
          ? { ...t, average_rating: newAverage }
          : t
        )
      );

      return true;
    } catch (err) {
      console.error('Error rating template:', err);
      throw err;
    }
  }, [templates]);

  // Search templates
  const searchTemplates = useCallback(async (query: string) => {
    setCurrentFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  // Filter templates
  const filterTemplates = useCallback(async (filters: UseWeightingTemplatesOptions) => {
    setCurrentFilters(prev => ({ ...prev, ...filters }));
  }, []);

  // Get templates by category
  const getTemplatesByCategory = useCallback((category: TemplateCategory): WeightingTemplate[] => {
    return templates.filter(t => t.template_category === category);
  }, [templates]);

  // Get popular templates (by usage count)
  const getPopularTemplates = useCallback((limit = 5): WeightingTemplate[] => {
    return templates
      .filter(t => t.is_active)
      .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
      .slice(0, limit);
  }, [templates]);

  // Get top rated templates
  const getTopRatedTemplates = useCallback((limit = 5): WeightingTemplate[] => {
    return templates
      .filter(t => t.is_active && t.average_rating !== null)
      .sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0))
      .slice(0, limit);
  }, [templates]);

  // Auto-load templates on mount if enabled
  useEffect(() => {
    if (autoLoad && user) {
      loadTemplates();
    }
  }, [autoLoad, user, loadTemplates]);

  // Reload templates when filters change
  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [currentFilters, user, loadTemplates]);

  return {
    // State
    templates,
    categories,
    loading,
    error,
    selectedTemplate,

    // Actions
    loadTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
    rateTemplate,
    searchTemplates,
    filterTemplates,
    setSelectedTemplate,
    getTemplatesByCategory,
    getPopularTemplates,
    getTopRatedTemplates,
    resetState
  };
}