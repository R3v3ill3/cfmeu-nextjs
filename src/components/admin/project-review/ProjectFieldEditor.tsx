'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Edit, Save, X } from 'lucide-react';
import type { PendingProject, ProjectEditableFields } from '@/types/pendingProjectReview';

interface ProjectFieldEditorProps {
  project: PendingProject;
  onSave: (updates: ProjectEditableFields) => Promise<void>;
  readOnly?: boolean;
}

export function ProjectFieldEditor({
  project,
  onSave,
  readOnly = false,
}: ProjectFieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedFields, setEditedFields] = useState<ProjectEditableFields>({});

  const handleEdit = () => {
    setEditedFields({
      name: project.name,
      value: project.value,
      proposed_start_date: project.proposed_start_date,
      proposed_end_date: project.proposed_end_date,
      project_stage: project.project_stage,
      project_status: project.project_status,
      development_type: project.development_type,
      owner_type: project.owner_type,
      funding_type: project.funding_type,
      bci_project_id: project.bci_project_id,
      external_project_number: project.external_project_number,
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedFields({});
    setIsEditing(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editedFields);
      setIsEditing(false);
      setEditedFields({});
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = Object.keys(editedFields).some(
    (key) => editedFields[key as keyof ProjectEditableFields] !== project[key as keyof PendingProject]
  );

  if (!isEditing) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Project Details</CardTitle>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={handleEdit}>
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Project Name</Label>
              <p className="font-medium">{project.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Value</Label>
              <p className="font-medium">
                {project.value
                  ? `$${project.value.toLocaleString()}`
                  : 'Not specified'}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Proposed Start</Label>
              <p className="font-medium">
                {project.proposed_start_date || 'Not specified'}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Proposed End</Label>
              <p className="font-medium">
                {project.proposed_end_date || 'Not specified'}
              </p>
            </div>
            {project.project_stage && (
              <div>
                <Label className="text-xs text-muted-foreground">Stage</Label>
                <p className="font-medium">
                  <Badge variant="secondary">{project.project_stage}</Badge>
                </p>
              </div>
            )}
            {project.project_status && (
              <div>
                <Label className="text-xs text-muted-foreground">Status</Label>
                <p className="font-medium">
                  <Badge variant="default">{project.project_status}</Badge>
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Edit Project Details</CardTitle>
            <Badge variant="outline" className="bg-blue-50">
              Editing
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="h-3 w-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
            >
              <Save className="h-3 w-3 mr-1" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label htmlFor="name">Project Name *</Label>
            <Input
              id="name"
              value={editedFields.name || ''}
              onChange={(e) =>
                setEditedFields({ ...editedFields, name: e.target.value })
              }
              placeholder="Enter project name"
            />
          </div>

          <div>
            <Label htmlFor="value">Project Value</Label>
            <Input
              id="value"
              type="number"
              value={editedFields.value || ''}
              onChange={(e) =>
                setEditedFields({
                  ...editedFields,
                  value: e.target.value ? Number(e.target.value) : null,
                })
              }
              placeholder="0"
            />
          </div>

          <div>
            <Label htmlFor="development_type">Development Type</Label>
            <Input
              id="development_type"
              value={editedFields.development_type || ''}
              onChange={(e) =>
                setEditedFields({
                  ...editedFields,
                  development_type: e.target.value,
                })
              }
              placeholder="e.g., Residential, Commercial"
            />
          </div>

          <div>
            <Label htmlFor="proposed_start_date">Proposed Start Date</Label>
            <Input
              id="proposed_start_date"
              type="date"
              value={editedFields.proposed_start_date || ''}
              onChange={(e) =>
                setEditedFields({
                  ...editedFields,
                  proposed_start_date: e.target.value,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="proposed_end_date">Proposed End Date</Label>
            <Input
              id="proposed_end_date"
              type="date"
              value={editedFields.proposed_end_date || ''}
              onChange={(e) =>
                setEditedFields({
                  ...editedFields,
                  proposed_end_date: e.target.value,
                })
              }
            />
          </div>

          <div>
            <Label htmlFor="project_stage">Project Stage</Label>
            <Input
              id="project_stage"
              value={editedFields.project_stage || ''}
              onChange={(e) =>
                setEditedFields({
                  ...editedFields,
                  project_stage: e.target.value,
                })
              }
              placeholder="e.g., Planning, Construction"
            />
          </div>

          <div>
            <Label htmlFor="project_status">Project Status</Label>
            <Input
              id="project_status"
              value={editedFields.project_status || ''}
              onChange={(e) =>
                setEditedFields({
                  ...editedFields,
                  project_status: e.target.value,
                })
              }
              placeholder="e.g., Active, On Hold"
            />
          </div>

          <div>
            <Label htmlFor="owner_type">Owner Type</Label>
            <Input
              id="owner_type"
              value={editedFields.owner_type || ''}
              onChange={(e) =>
                setEditedFields({ ...editedFields, owner_type: e.target.value })
              }
              placeholder="e.g., Government, Private"
            />
          </div>

          <div>
            <Label htmlFor="funding_type">Funding Type</Label>
            <Input
              id="funding_type"
              value={editedFields.funding_type || ''}
              onChange={(e) =>
                setEditedFields({
                  ...editedFields,
                  funding_type: e.target.value,
                })
              }
              placeholder="e.g., Public, Private"
            />
          </div>

          <div>
            <Label htmlFor="bci_project_id">BCI Project ID</Label>
            <Input
              id="bci_project_id"
              value={editedFields.bci_project_id || ''}
              onChange={(e) =>
                setEditedFields({
                  ...editedFields,
                  bci_project_id: e.target.value,
                })
              }
              placeholder="BCI identifier"
            />
          </div>

          <div>
            <Label htmlFor="external_project_number">External Project Number</Label>
            <Input
              id="external_project_number"
              value={editedFields.external_project_number || ''}
              onChange={(e) =>
                setEditedFields({
                  ...editedFields,
                  external_project_number: e.target.value,
                })
              }
              placeholder="External reference"
            />
          </div>
        </div>

        {hasChanges && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p className="text-blue-900 font-medium">You have unsaved changes</p>
            <p className="text-blue-700 text-xs mt-1">
              Click &quot;Save Changes&quot; to apply your edits or &quot;Cancel&quot; to
              discard them.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
