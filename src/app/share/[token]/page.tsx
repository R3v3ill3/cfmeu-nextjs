"use client";

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Clock, Building, Users, AlertTriangle, CheckCircle } from 'lucide-react';
import Image from 'next/image';
import DateInput from '@/components/ui/date-input';

interface PublicFormData {
  token: string;
  resourceType: string;
  resourceId: string;
  project?: {
    id: string;
    name: string;
    value: number | null;
    tier: string | null;
    proposed_start_date: string | null;
    proposed_finish_date: string | null;
    roe_email: string | null;
    project_type: string | null;
    state_funding: number;
    federal_funding: number;
    address: string | null;
  };
  mappingSheetData?: {
    contractorRoles: Array<{
      id: string;
      employerId: string;
      employerName: string;
      roleLabel: string;
      ebaStatus?: boolean | null;
    }>;
    tradeContractors: Array<{
      id: string;
      employerId: string;
      employerName: string;
      tradeLabel: string;
      stage: string;
      ebaStatus?: boolean | null;
    }>;
  };
  employers?: Array<{
    id: string;
    name: string;
    enterprise_agreement_status?: boolean | null;
  }>;
  expiresAt: string;
  allowedActions: string[];
}

interface FormData {
  name: string;
  value: string;
  address: string;
  proposed_start_date: string;
  proposed_finish_date: string;
  project_type: string;
  state_funding: string;
  federal_funding: string;
  roe_email: string;
}

export default function PublicFormPage() {
  const params = useParams();
  const token = params?.token as string;
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    value: '',
    address: '',
    proposed_start_date: '',
    proposed_finish_date: '',
    project_type: '',
    state_funding: '',
    federal_funding: '',
    roe_email: '',
  });

  // Fetch form data
  const { data: publicData, isLoading, error } = useQuery<PublicFormData>({
    queryKey: ['public-form-data', token],
    enabled: !!token,
    queryFn: async () => {
      const response = await fetch(`/api/public/form-data/${token}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to load form data');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Initialize form with existing project data
      if (data.project) {
        setFormData({
          name: data.project.name || '',
          value: data.project.value?.toString() || '',
          address: data.project.address || '',
          proposed_start_date: data.project.proposed_start_date || '',
          proposed_finish_date: data.project.proposed_finish_date || '',
          project_type: data.project.project_type || '',
          state_funding: data.project.state_funding?.toString() || '',
          federal_funding: data.project.federal_funding?.toString() || '',
          roe_email: data.project.roe_email || '',
        });
      }
    },
  });

  // Submit form mutation
  const submitMutation = useMutation({
    mutationFn: async (submission: any) => {
      const response = await fetch(`/api/public/form-data/${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submission),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit form');
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success('Form submitted successfully!');
      queryClient.invalidateQueries(['public-form-data', token]);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to submit form');
    },
  });

  const handleSubmit = () => {
    const projectUpdates = {
      name: formData.name,
      value: formData.value ? Number(formData.value) : null,
      proposed_start_date: formData.proposed_start_date || null,
      proposed_finish_date: formData.proposed_finish_date || null,
      project_type: formData.project_type || null,
      state_funding: formData.state_funding ? Number(formData.state_funding) : 0,
      federal_funding: formData.federal_funding ? Number(formData.federal_funding) : 0,
      roe_email: formData.roe_email || null,
    };

    submitMutation.mutate({
      projectUpdates,
      addressUpdate: formData.address,
    });
  };

  const formatExpiryTime = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const hoursRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
    
    if (hoursRemaining <= 0) {
      return { text: 'Expired', variant: 'destructive' as const };
    } else if (hoursRemaining < 24) {
      return { 
        text: `${hoursRemaining} hour${hoursRemaining === 1 ? '' : 's'} remaining`, 
        variant: hoursRemaining < 6 ? 'destructive' as const : 'secondary' as const 
      };
    } else {
      const daysRemaining = Math.ceil(hoursRemaining / 24);
      return { 
        text: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining`, 
        variant: 'secondary' as const 
      };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-2" />
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              {(error as any)?.message || 'This link is invalid or has expired.'}
            </p>
            <p className="text-sm text-muted-foreground">
              Please contact the person who shared this link for a new one.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!publicData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p>No data available</p>
      </div>
    );
  }

  const expiryInfo = formatExpiryTime(publicData.expiresAt);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/cfmeu-logo.png" alt="CFMEU" width={120} height={40} className="object-contain" />
              <div>
                <h1 className="text-xl font-bold">Project Mapping Sheet</h1>
                <p className="text-sm text-muted-foreground">Shared Access Form</p>
              </div>
            </div>
            <div className="text-right">
              <Badge variant={expiryInfo.variant} className="gap-1">
                <Clock className="h-3 w-3" />
                {expiryInfo.text}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              {publicData.project?.name || 'Project Information'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Project Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter project name"
                />
              </div>
              <div>
                <Label htmlFor="value">Project Value (AUD)</Label>
                <Input
                  id="value"
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  placeholder="Enter project value"
                />
              </div>
            </div>

            <div className="md:col-span-3">
              <Label htmlFor="address">Project Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter project address"
              />
            </div>

            <Separator />

            {/* Project Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="start-date">Proposed Start Date</Label>
                <DateInput
                  id="start-date"
                  value={formData.proposed_start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, proposed_start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="finish-date">Proposed Finish Date</Label>
                <DateInput
                  id="finish-date"
                  value={formData.proposed_finish_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, proposed_finish_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="project-type">Funding Type</Label>
                <Select
                  value={formData.project_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, project_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select funding type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Funding Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="state-funding">State Funding (AUD)</Label>
                <Input
                  id="state-funding"
                  type="number"
                  value={formData.state_funding}
                  onChange={(e) => setFormData(prev => ({ ...prev, state_funding: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="federal-funding">Federal Funding (AUD)</Label>
                <Input
                  id="federal-funding"
                  type="number"
                  value={formData.federal_funding}
                  onChange={(e) => setFormData(prev => ({ ...prev, federal_funding: e.target.value }))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="roe-email">ROE Contact Email</Label>
                <Input
                  id="roe-email"
                  type="email"
                  value={formData.roe_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, roe_email: e.target.value }))}
                  placeholder="Enter contact email"
                />
              </div>
            </div>

            <Separator />

            {/* Contractor Information */}
            {publicData.mappingSheetData && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Contractor Information
                </h3>
                
                {publicData.mappingSheetData.contractorRoles.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {publicData.mappingSheetData.contractorRoles.map((contractor) => (
                      <div key={contractor.id} className="p-4 bg-muted/30 rounded-lg">
                        <div className="font-medium text-sm mb-2">{contractor.roleLabel}</div>
                        <div className="text-sm">{contractor.employerName}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">EBA Status:</span>
                          {contractor.ebaStatus ? (
                            <Badge variant="default" className="text-xs gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              No EBA
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <Button
                onClick={handleSubmit}
                disabled={submitMutation.isLoading}
                className="min-w-32"
              >
                {submitMutation.isLoading ? 'Submitting...' : 'Submit Updates'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
