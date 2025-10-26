// CFMEU Employer Rating System - Weighting Templates Component
// Template management and preset functionality

'use client';

import {  useState  } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useWeightingTemplates } from '@/hooks/useWeightingTemplates';
import {
  WeightingTemplate,
  TemplateCategory,
  UserRole,
  WeightingTemplateData
} from '@/lib/weighting-system/types/WeightingTypes';
import {
  FileText,
  Star,
  Download,
  Upload,
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Trash2,
  Copy,
  Users,
  Building,
  CheckCircle,
  TrendingUp
} from 'lucide-react';

interface WeightingTemplatesProps {
  onApplyTemplate?: (templateId: string) => Promise<void>;
  userRole?: UserRole;
  allowCreate?: boolean;
  allowEdit?: boolean;
  allowDelete?: boolean;
  showApplyButton?: boolean;
  className?: string;
}

export function WeightingTemplates({
  onApplyTemplate,
  userRole = 'lead_organiser',
  allowCreate = true,
  allowEdit = true,
  allowDelete = true,
  showApplyButton = true,
  className = ''
}: WeightingTemplatesProps) {
  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDetails, setShowTemplateDetails] = useState<WeightingTemplate | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [newTemplate, setNewTemplate] = useState<Partial<WeightingTemplate>>({});

  // Templates hook
  const {
    templates,
    categories,
    loading,
    error,
    selectedTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    rateTemplate,
    searchTemplates,
    getPopularTemplates,
    getTopRatedTemplates,
    setSelectedTemplate
  } = useWeightingTemplates({
    autoLoad: true,
    targetRole: userRole === 'all' ? undefined : userRole,
    searchQuery: searchQuery || undefined
  });

  // Get filtered templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = !searchQuery ||
      template.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'all' || template.template_category === selectedCategory;
    const matchesRole = selectedRole === 'all' || template.target_role === selectedRole;

    return matchesSearch && matchesCategory && matchesRole;
  });

  // Get popular and top rated templates
  const popularTemplates = getPopularTemplates(3);
  const topRatedTemplates = getTopRatedTemplates(3);

  // Handle template creation
  const handleCreateTemplate = async () => {
    if (!newTemplate.template_name || !newTemplate.template_category || !newTemplate.target_role) {
      return;
    }

    setCreatingTemplate(true);
    try {
      await createTemplate({
        template_name: newTemplate.template_name,
        description: newTemplate.description || '',
        template_category: newTemplate.template_category,
        target_role: newTemplate.target_role,
        target_employer_type: newTemplate.target_employer_type,
        template_data: newTemplate.template_data || {},
        is_system_template: false
      });

      setShowCreateDialog(false);
      setNewTemplate({});
    } catch (error) {
      console.error('Error creating template:', error);
    } finally {
      setCreatingTemplate(false);
    }
  };

  // Handle template application
  const handleApplyTemplate = async (templateId: string) => {
    if (onApplyTemplate) {
      await onApplyTemplate(templateId);
    }
  };

  // Handle template deletion
  const handleDeleteTemplate = async (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteTemplate(templateId);
      } catch (error) {
        console.error('Error deleting template:', error);
      }
    }
  };

  // Get template category display
  const getCategoryDisplay = (category: TemplateCategory) => {
    const variants = {
      beginner: 'bg-green-100 text-green-800',
      intermediate: 'bg-blue-100 text-blue-800',
      advanced: 'bg-purple-100 text-purple-800',
      specialized: 'bg-orange-100 text-orange-800'
    };

    return (
      <Badge className={variants[category]}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  // Get star rating display
  const getStarRating = (rating: number | null) => {
    if (!rating) return null;

    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="text-sm text-gray-600 ml-1">({rating.toFixed(1)})</span>
      </div>
    );
  };

  // Template Details Dialog
  const TemplateDetailsDialog = ({ template }: { template: WeightingTemplate }) => (
    <Dialog open={!!template} onOpenChange={() => setShowTemplateDetails(null)}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>{template.template_name}</span>
            {template.is_system_template && (
              <Badge variant="secondary">System</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {template.description || 'No description provided'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Template Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium">Category</Label>
              <div className="mt-1">{getCategoryDisplay(template.template_category)}</div>
            </div>
            <div>
              <Label className="text-sm font-medium">Target Role</Label>
              <div className="mt-1 capitalize">{template.target_role.replace('_', ' ')}</div>
            </div>
            <div>
              <Label className="text-sm font-medium">Target Type</Label>
              <div className="mt-1 capitalize">{template.target_employer_type || 'All'}</div>
            </div>
          </div>

          {/* Usage Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{template.usage_count || 0}</div>
              <div className="text-sm text-gray-600">Times Used</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {template.average_rating ? template.average_rating.toFixed(1) : 'N/A'}
              </div>
              <div className="text-sm text-gray-600">Average Rating</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {template.template_data.project_data_weight
                  ? `${(template.template_data.project_data_weight * 100).toFixed(0)}% / ${(template.template_data.organiser_expertise_weight * 100).toFixed(0)}%`
                  : 'N/A'
                }
              </div>
              <div className="text-sm text-gray-600">Data / Expertise</div>
            </div>
          </div>

          {/* Template Data Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Weighting Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Main Balance */}
                <div>
                  <h4 className="font-medium mb-2">Main Balance</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">Project Data Weight</Label>
                      <div className="text-lg font-semibold">
                        {template.template_data.project_data_weight
                          ? `${(template.template_data.project_data_weight * 100).toFixed(1)}%`
                          : 'Not specified'
                        }
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm">Expertise Weight</Label>
                      <div className="text-lg font-semibold">
                        {template.template_data.organiser_expertise_weight
                          ? `${(template.template_data.organiser_expertise_weight * 100).toFixed(1)}%`
                          : 'Not specified'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Track 1 Summary */}
                {template.template_data.track1_weightings && (
                  <div>
                    <h4 className="font-medium mb-2">Project Data Categories</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>CBUS: {template.template_data.track1_weightings.cbus_paying_weight
                        ? `${(template.template_data.track1_weightings.cbus_paying_weight * 100).toFixed(1)}%`
                        : 'N/A'
                      }</div>
                      <div>Incolink: {template.template_data.track1_weightings.incolink_entitlements_weight
                        ? `${(template.template_data.track1_weightings.incolink_entitlements_weight * 100).toFixed(1)}%`
                        : 'N/A'
                      }</div>
                      <div>Union Relations: {template.template_data.track1_weightings.union_relations_right_of_entry_weight
                        ? `${(template.template_data.track1_weightings.union_relations_right_of_entry_weight * 100).toFixed(1)}%`
                        : 'N/A'
                      }</div>
                      <div>Safety: {template.template_data.track1_weightings.safety_hsr_respect_weight
                        ? `${(template.template_data.track1_weightings.safety_hsr_respect_weight * 100).toFixed(1)}%`
                        : 'N/A'
                      }</div>
                    </div>
                  </div>
                )}

                {/* Track 2 Summary */}
                {template.template_data.track2_weightings && (
                  <div>
                    <h4 className="font-medium mb-2">Expertise Categories</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      <div>CBUS Assessment: {template.template_data.track2_weightings.cbus_overall_assessment_weight
                        ? `${(template.template_data.track2_weightings.cbus_overall_assessment_weight * 100).toFixed(1)}%`
                        : 'N/A'
                      }</div>
                      <div>Union Relations: {template.template_data.track2_weightings.union_relations_overall_weight
                        ? `${(template.template_data.track2_weightings.union_relations_overall_weight * 100).toFixed(1)}%`
                        : 'N/A'
                      }</div>
                      <div>Safety Culture: {template.template_data.track2_weightings.safety_culture_overall_weight
                        ? `${(template.template_data.track2_weightings.safety_culture_overall_weight * 100).toFixed(1)}%`
                        : 'N/A'
                      }</div>
                      <div>Confidence Multiplier: {template.template_data.track2_weightings.organiser_confidence_multiplier
                        ? `${template.template_data.track2_weightings.organiser_confidence_multiplier.toFixed(2)}x`
                        : 'N/A'
                      }</div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              {template.average_rating && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => rateTemplate(template.id, 5)}
                >
                  <Star className="w-4 h-4 mr-1" />
                  Rate 5 Stars
                </Button>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" onClick={() => setShowTemplateDetails(null)}>
                Close
              </Button>
              {showApplyButton && (
                <Button onClick={() => handleApplyTemplate(template.id)}>
                  <Download className="w-4 h-4 mr-2" />
                  Apply Template
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner className="w-8 h-8" />
        <span className="ml-2">Loading templates...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-600">
        <p>Error loading templates: {error}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">Weighting Templates</h3>
          <p className="text-gray-600">Pre-configured weighting presets for different scenarios</p>
        </div>
        {allowCreate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        )}
      </div>

      {/* Popular Templates */}
      {popularTemplates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Popular Templates</span>
            </CardTitle>
            <CardDescription>
              Most used templates by {userRole.replace('_', ' ')}s
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {popularTemplates.map((template) => (
                <div
                  key={template.id}
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setShowTemplateDetails(template)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{template.template_name}</h4>
                    {getCategoryDisplay(template.template_category)}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {template.description || 'No description'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{template.usage_count || 0} uses</span>
                      {template.average_rating && (
                        <div className="flex items-center">
                          <Star className="w-3 h-3 text-yellow-400 fill-current" />
                          <span className="ml-1">{template.average_rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    {showApplyButton && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyTemplate(template.id);
                        }}
                      >
                        Apply
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="w-5 h-5" />
            <span>Browse Templates</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search">Search Templates</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  id="search"
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="role">Target Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="lead_organiser">Lead Organiser</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="organiser">Organiser</SelectItem>
                  <SelectItem value="delegate">Delegate</SelectItem>
                  <SelectItem value="observer">Observer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Template List */}
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
              <p className="text-gray-600">
                Try adjusting your search or filters to find templates
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h4 className="font-medium">{template.template_name}</h4>
                      {template.is_system_template && (
                        <Badge variant="secondary">System</Badge>
                      )}
                      {getCategoryDisplay(template.template_category)}
                      {template.average_rating && getStarRating(template.average_rating)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {template.description || 'No description provided'}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span className="capitalize">{template.target_role.replace('_', ' ')}</span>
                      <span>•</span>
                      <span>{template.usage_count || 0} uses</span>
                      <span>•</span>
                      <span>Updated {new Date(template.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowTemplateDetails(template)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    {allowEdit && !template.is_system_template && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // Edit template logic
                        }}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    {showApplyButton && (
                      <Button
                        size="sm"
                        onClick={() => handleApplyTemplate(template.id)}
                      >
                        <Download className="w-4 h-4 mr-1" />
                        Apply
                      </Button>
                    )}
                    {allowDelete && !template.is_system_template && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
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

      {/* Template Details Dialog */}
      {showTemplateDetails && (
        <TemplateDetailsDialog template={showTemplateDetails} />
      )}

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Create a new weighting template that others can use
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="template_name">Template Name *</Label>
              <Input
                id="template_name"
                value={newTemplate.template_name || ''}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, template_name: e.target.value }))}
                placeholder="e.g., Conservative Lead Organiser"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newTemplate.description || ''}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe when and how to use this template"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="template_category">Category *</Label>
                <Select
                  value={newTemplate.template_category}
                  onValueChange={(value) => setNewTemplate(prev => ({ ...prev, template_category: value as TemplateCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="specialized">Specialized</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="target_role">Target Role *</Label>
                <Select
                  value={newTemplate.target_role}
                  onValueChange={(value) => setNewTemplate(prev => ({ ...prev, target_role: value as UserRole }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
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
              <Label htmlFor="target_employer_type">Target Employer Type</Label>
              <Select
                value={newTemplate.target_employer_type}
                onValueChange={(value) => setNewTemplate(prev => ({ ...prev, target_employer_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employers</SelectItem>
                  <SelectItem value="builders">Builders</SelectItem>
                  <SelectItem value="trade_contractors">Trade Contractors</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={creatingTemplate || !newTemplate.template_name || !newTemplate.template_category || !newTemplate.target_role}
            >
              {creatingTemplate ? (
                <>
                  <LoadingSpinner className="w-4 h-4 mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Template
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}