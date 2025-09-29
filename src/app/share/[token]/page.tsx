"use client";

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Clock, Building, Users, AlertTriangle, CheckCircle, Plus, Trash2, Edit, X, Check } from 'lucide-react';
import Image from 'next/image';
import DateInput from '@/components/ui/date-input';
import { EmployerSearch } from '@/components/ui/EmployerSearch';

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
    main_job_site_id: string | null;
  };
  siteContacts?: Array<{
    id?: string;
    role: string;
    name: string;
    email: string;
    phone: string;
  }>;
  mappingSheetData?: {
    contractorRoles: Array<{
      id: string;
      employerId: string;
      employerName: string;
      roleLabel: string;
      roleCode: string;
      ebaStatus?: boolean | null;
      dataSource?: string;
      matchStatus?: string;
    }>;
    tradeContractors: Array<{
      id: string;
      employerId: string;
      employerName: string;
      tradeType: string;
      tradeLabel: string;
      stage: string;
      estimatedWorkforce?: number | null;
      ebaStatus?: boolean | null;
      dataSource?: string;
      matchStatus?: string;
    }>;
  };
  employers?: Array<{
    id: string;
    name: string;
    enterprise_agreement_status?: boolean | null;
  }>;
  tradeOptions?: Array<{
    value: string;
    label: string;
    stage: string;
  }>;
  contractorRoleTypes?: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  expiresAt: string;
  allowedActions: string[];
}

interface FormData {
  // Project data
  name: string;
  value: string;
  address: string;
  proposed_start_date: string;
  proposed_finish_date: string;
  project_type: string;
  state_funding: string;
  federal_funding: string;
  roe_email: string;
  // Site contacts
  siteContacts: Record<string, { role: string; name: string; email: string; phone: string; id?: string }>;
}

const SITE_CONTACT_ROLES = [
  { value: 'project_manager', label: 'Project Manager' },
  { value: 'site_manager', label: 'Site Manager' },
  { value: 'site_delegate', label: 'Site Delegate' },
  { value: 'site_hsr', label: 'Site HSR' },
];

export default function PublicFormPage() {
  const params = useParams();
  const token = params?.token as string;
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<FormData>({
    name: '', value: '', address: '', proposed_start_date: '', proposed_finish_date: '',
    project_type: '', state_funding: '', federal_funding: '', roe_email: '',
    siteContacts: {
      project_manager: { role: 'project_manager', name: '', email: '', phone: '' },
      site_manager: { role: 'site_manager', name: '', email: '', phone: '' },
      site_delegate: { role: 'site_delegate', name: '', email: '', phone: '' },
      site_hsr: { role: 'site_hsr', name: '', email: '', phone: '' },
    }
  });

  // New contractor/trade state
  const [newContractorRole, setNewContractorRole] = useState({ employerId: '', employerName: '', roleCode: '' });
  const [newTradeContractor, setNewTradeContractor] = useState({ employerId: '', employerName: '', tradeType: '', estimatedWorkforce: '' });
  
  // Contractor status management
  const [contractorActions, setContractorActions] = useState<Record<string, {
    action: 'confirm' | 'change' | 'wrong' | 'add' | null;
    newEmployerId?: string;
    newEmployerName?: string;
  }>>({});

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
  });

  // Initialize form data when publicData changes
  useEffect(() => {
    if (publicData?.project) {
      setFormData({
        name: publicData.project.name || '',
        value: publicData.project.value?.toString() || '',
        address: publicData.project.address || '',
        proposed_start_date: publicData.project.proposed_start_date || '',
        proposed_finish_date: publicData.project.proposed_finish_date || '',
        project_type: publicData.project.project_type || '',
        state_funding: publicData.project.state_funding?.toString() || '',
        federal_funding: publicData.project.federal_funding?.toString() || '',
        roe_email: publicData.project.roe_email || '',
        siteContacts: {
          project_manager: { role: 'project_manager', name: '', email: '', phone: '' },
          site_manager: { role: 'site_manager', name: '', email: '', phone: '' },
          site_delegate: { role: 'site_delegate', name: '', email: '', phone: '' },
          site_hsr: { role: 'site_hsr', name: '', email: '', phone: '' },
        }
      });
    }
      
    // Initialize site contacts
    if (publicData?.siteContacts) {
      const siteContactsMap = {
        project_manager: { role: 'project_manager', name: '', email: '', phone: '' },
        site_manager: { role: 'site_manager', name: '', email: '', phone: '' },
        site_delegate: { role: 'site_delegate', name: '', email: '', phone: '' },
        site_hsr: { role: 'site_hsr', name: '', email: '', phone: '' },
      };
      publicData.siteContacts.forEach(contact => {
        siteContactsMap[contact.role as keyof typeof siteContactsMap] = contact;
      });
      setFormData(prev => ({ ...prev, siteContacts: siteContactsMap }));
    }
  }, [publicData]);

  // Submit form mutation
  const submitMutation = useMutation({
    mutationFn: async (submission: any) => {
      const response = await fetch(`/api/public/form-data/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      queryClient.invalidateQueries({ queryKey: ['public-form-data', token] });
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

    const siteContactUpdates = Object.values(formData.siteContacts)
      .filter(contact => contact.name.trim())
      .map(contact => ({
        id: contact.id,
        role: contact.role,
        name: contact.name.trim(),
        email: contact.email.trim() || '',
        phone: contact.phone.trim() || '',
      }));

    // Process contractor actions
    const contractorRoleUpdates: any[] = [];
    const tradeContractorUpdates: any[] = [];
    
    // Handle contractor status changes
    Object.entries(contractorActions).forEach(([contractorId, actionData]) => {
      const isTradeContractor = publicData?.mappingSheetData?.tradeContractors?.some(tc => tc.id === contractorId);
      
      if (actionData.action === 'confirm') {
        // Mark as confirmed - need to extract the actual database ID
        const actualId = contractorId.includes(':') ? contractorId.split(':')[1] : contractorId;
        
        if (isTradeContractor) {
          tradeContractorUpdates.push({
            id: actualId,
            action: 'confirm_match'
          });
        } else {
          contractorRoleUpdates.push({
            id: actualId,
            action: 'confirm_match'
          });
        }
      } else if (actionData.action === 'change' && actionData.newEmployerId) {
        // Change employer
        if (isTradeContractor) {
          tradeContractorUpdates.push({
            id: contractorId,
            employerId: actionData.newEmployerId,
            action: 'update'
          });
        } else {
          contractorRoleUpdates.push({
            id: contractorId,
            employerId: actionData.newEmployerId,
            action: 'update'
          });
        }
      } else if (actionData.action === 'wrong') {
        // Mark as wrong
        if (isTradeContractor) {
          tradeContractorUpdates.push({
            id: contractorId,
            action: 'mark_wrong'
          });
        } else {
          contractorRoleUpdates.push({
            id: contractorId,
            action: 'mark_wrong'
          });
        }
      } else if (actionData.action === 'add' && actionData.newEmployerId) {
        // Add contractor to empty key trade
        const contractor = publicData?.mappingSheetData?.tradeContractors?.find(tc => tc.id === contractorId);
        if (contractor && isTradeContractor) {
          tradeContractorUpdates.push({
            employerId: actionData.newEmployerId,
            tradeType: contractor.tradeType,
            estimatedWorkforce: null,
            action: 'create'
          });
        }
      }
    });

    // Add new contractors
    if (newContractorRole.employerId) {
      contractorRoleUpdates.push({
        employerId: newContractorRole.employerId,
        roleCode: newContractorRole.roleCode,
        action: 'create'
      });
    }
    
    if (newTradeContractor.employerId) {
      tradeContractorUpdates.push({
        employerId: newTradeContractor.employerId,
        tradeType: newTradeContractor.tradeType,
        estimatedWorkforce: newTradeContractor.estimatedWorkforce ? parseInt(newTradeContractor.estimatedWorkforce) : null,
        action: 'create'
      });
    }

    submitMutation.mutate({
      projectUpdates,
      addressUpdate: formData.address,
      siteContactUpdates,
      contractorRoleUpdates,
      tradeContractorUpdates,
    });
  };

  const addContractorRole = () => {
    if (!newContractorRole.employerId || !newContractorRole.roleCode) {
      toast.error('Please select both employer and role');
      return;
    }
    
    toast.success('Contractor role will be added when form is submitted');
    setNewContractorRole({ employerId: '', employerName: '', roleCode: '' });
  };

  const addTradeContractor = () => {
    if (!newTradeContractor.employerId || !newTradeContractor.tradeType) {
      toast.error('Please select both employer and trade type');
      return;
    }
    
    toast.success('Trade contractor will be added when form is submitted');
    setNewTradeContractor({ employerId: '', employerName: '', tradeType: '', estimatedWorkforce: '' });
  };

  const handleContractorAction = (contractorId: string, action: 'confirm' | 'change' | 'wrong' | 'add', newEmployerId?: string, newEmployerName?: string) => {
    setContractorActions(prev => ({
      ...prev,
      [contractorId]: {
        action,
        newEmployerId,
        newEmployerName
      }
    }));
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
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
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

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        
        {/* Project Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Project Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
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
          </CardContent>
        </Card>

        {/* Site Contacts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Site Contacts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Role</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-64">Email</TableHead>
                    <TableHead className="w-40">Phone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SITE_CONTACT_ROLES.map((role) => {
                    const contact = formData.siteContacts[role.value];
                    return (
                      <TableRow key={role.value}>
                        <TableCell className="font-medium">{role.label}</TableCell>
                        <TableCell>
                          <Input
                            value={contact?.name || ''}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              siteContacts: {
                                ...prev.siteContacts,
                                [role.value]: { ...prev.siteContacts[role.value], name: e.target.value }
                              }
                            }))}
                            placeholder="Full name"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="email"
                            value={contact?.email || ''}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              siteContacts: {
                                ...prev.siteContacts,
                                [role.value]: { ...prev.siteContacts[role.value], email: e.target.value }
                              }
                            }))}
                            placeholder="email@example.com"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={contact?.phone || ''}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              siteContacts: {
                                ...prev.siteContacts,
                                [role.value]: { ...prev.siteContacts[role.value], phone: e.target.value }
                              }
                            }))}
                            placeholder="Phone"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Contractor Roles */}
        <Card>
          <CardHeader>
            <CardTitle>Contractor Roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing contractor roles */}
            {publicData.mappingSheetData?.contractorRoles?.length === 0 && (
              <div className="text-muted-foreground text-center py-4">
                No existing contractor roles found
              </div>
            )}
            {publicData.mappingSheetData?.contractorRoles?.map((contractor) => {
              const contractorAction = contractorActions[contractor.id];
              const needsReview = contractor.matchStatus === 'auto_matched' && contractor.dataSource === 'bci_import';
              
              return (
                <div key={contractor.id} className="p-4 border rounded-lg bg-card">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{contractor.roleLabel}</div>
                      <div className="text-sm text-muted-foreground">
                        {contractorAction?.action === 'change' && contractorAction.newEmployerName ? 
                          contractorAction.newEmployerName : contractor.employerName
                        }
                      </div>
                      {contractor.dataSource === 'bci_import' && (
                        <div className="text-xs text-blue-600 mt-1">
                          BCI Match {needsReview ? '- Needs Review' : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {contractor.ebaStatus ? (
                        <Badge variant="default" className="text-xs gap-1">
                          <CheckCircle className="h-3 w-3" />
                          EBA Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          No EBA
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Action buttons for BCI matches that need review */}
                  {needsReview && !contractorAction?.action && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleContractorAction(contractor.id, 'confirm')}
                        className="text-green-600 border-green-200 hover:bg-green-50"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        Confirm
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          // Set up change mode - in real implementation, show employer search
                          const newEmployerId = prompt('Enter new employer ID (in real implementation, this would be a search):');
                          if (newEmployerId) {
                            const employer = publicData.employers?.find(e => e.id === newEmployerId);
                            handleContractorAction(contractor.id, 'change', newEmployerId, employer?.name || 'Selected Employer');
                          }
                        }}
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Change
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleContractorAction(contractor.id, 'wrong')}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Mark as Wrong
                      </Button>
                    </div>
                  )}
                  
                  {/* Show action taken */}
                  {contractorAction?.action && (
                    <div className="mt-3 pt-3 border-t">
                      {contractorAction.action === 'confirm' && (
                        <Badge variant="default" className="text-xs">
                          <Check className="h-3 w-3 mr-1" />
                          Confirmed by Delegate
                        </Badge>
                      )}
                      {contractorAction.action === 'change' && (
                        <Badge variant="secondary" className="text-xs">
                          <Edit className="h-3 w-3 mr-1" />
                          Changed by Delegate
                        </Badge>
                      )}
                      {contractorAction.action === 'add' && (
                        <Badge variant="secondary" className="text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Added by Delegate
                        </Badge>
                      )}
                      {contractorAction.action === 'wrong' && (
                        <Badge variant="destructive" className="text-xs">
                          <X className="h-3 w-3 mr-1" />
                          Marked as Wrong
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add new contractor role */}
            <div className="border-2 border-dashed border-muted rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>Employer</Label>
                  <EmployerSearch
                    employers={publicData.employers || []}
                    value={newContractorRole.employerId}
                    onSelect={(employerId, employerName) => {
                      setNewContractorRole(prev => ({ ...prev, employerId, employerName }));
                    }}
                    placeholder="Search and select employer..."
                  />
                </div>
                <div className="flex-1">
                  <Label>Role</Label>
                  <Select
                    value={newContractorRole.roleCode}
                    onValueChange={(value) => setNewContractorRole(prev => ({ ...prev, roleCode: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {publicData.contractorRoleTypes?.map(role => (
                        <SelectItem key={role.id} value={role.code}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addContractorRole} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trade Contractors */}
        <Card>
          <CardHeader>
            <CardTitle>Trade Contractors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Group by stage */}
            {['early_works', 'structure', 'finishing', 'other'].map(stage => {
              const stageContractors = publicData.mappingSheetData?.tradeContractors?.filter(tc => tc.stage === stage) || [];
              if (stageContractors.length === 0) return null;

              const stageLabels: Record<string, string> = {
                early_works: 'Early Works',
                structure: 'Structure',
                finishing: 'Finishing',
                other: 'Other'
              };

              return (
                <div key={stage}>
                  <h4 className="font-semibold text-lg mb-2">{stageLabels[stage]}</h4>
                  <div className="space-y-2">
                    {stageContractors.map((contractor) => {
                      const contractorAction = contractorActions[contractor.id];
                      const needsReview = contractor.matchStatus === 'auto_matched' && contractor.dataSource === 'bci_import';
                      const isEmpty = !contractor.employerId; // Check if this is an empty key contractor trade
                      
                      return (
                        <div key={contractor.id} className="p-3 border rounded-lg bg-card">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-medium">{contractor.tradeLabel}</div>
                              <div className="text-sm text-muted-foreground">
                                {isEmpty ? (
                                  <span className="italic text-gray-400">No contractor assigned</span>
                                ) : (
                                  contractorAction?.action === 'change' && contractorAction.newEmployerName ? 
                                    contractorAction.newEmployerName : contractor.employerName
                                )}
                              </div>
                              {contractor.estimatedWorkforce && (
                                <div className="text-xs text-muted-foreground">
                                  Est. workforce: {contractor.estimatedWorkforce}
                                </div>
                              )}
                              {contractor.dataSource === 'bci_import' && (
                                <div className="text-xs text-blue-600 mt-1">
                                  BCI Match {needsReview ? '- Needs Review' : ''}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {!isEmpty && (
                                contractor.ebaStatus ? (
                                  <Badge variant="default" className="text-xs gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    EBA Active
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">
                                    No EBA
                                  </Badge>
                                )
                              )}
                            </div>
                          </div>
                          
                          {/* Action buttons for empty key contractor trades */}
                          {isEmpty && (
                            <div className="flex gap-2 mt-3 pt-3 border-t">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  // In real implementation, show employer search modal
                                  const newEmployerId = prompt('Enter employer ID to assign:');
                                  if (newEmployerId) {
                                    const employer = publicData.employers?.find(e => e.id === newEmployerId);
                                    handleContractorAction(contractor.id, 'add', newEmployerId, employer?.name || 'Selected Employer');
                                  }
                                }}
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Contractor
                              </Button>
                            </div>
                          )}
                          
                          {/* Action buttons for BCI matches that need review */}
                          {needsReview && !contractorAction?.action && (
                            <div className="flex gap-2 mt-3 pt-3 border-t">
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleContractorAction(contractor.id, 'confirm')}
                                className="text-green-600 border-green-200 hover:bg-green-50"
                              >
                                <Check className="h-3 w-3 mr-1" />
                                Confirm
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => {
                                  // In real implementation, show employer search modal
                                  const newEmployerId = prompt('Enter new employer ID:');
                                  if (newEmployerId) {
                                    const employer = publicData.employers?.find(e => e.id === newEmployerId);
                                    handleContractorAction(contractor.id, 'change', newEmployerId, employer?.name || 'Selected Employer');
                                  }
                                }}
                                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Change
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleContractorAction(contractor.id, 'wrong')}
                                className="text-red-600 border-red-200 hover:bg-red-50"
                              >
                                <X className="h-3 w-3 mr-1" />
                                Mark as Wrong
                              </Button>
                            </div>
                          )}
                          
                          {/* Show action taken */}
                          {contractorAction?.action && (
                            <div className="mt-3 pt-3 border-t">
                              {contractorAction.action === 'confirm' && (
                                <Badge variant="default" className="text-xs">
                                  <Check className="h-3 w-3 mr-1" />
                                  Confirmed by Delegate
                                </Badge>
                              )}
                              {contractorAction.action === 'change' && (
                                <Badge variant="secondary" className="text-xs">
                                  <Edit className="h-3 w-3 mr-1" />
                                  Changed by Delegate
                                </Badge>
                              )}
                              {contractorAction.action === 'add' && (
                                <Badge variant="secondary" className="text-xs">
                                  <Plus className="h-3 w-3 mr-1" />
                                  Added by Delegate
                                </Badge>
                              )}
                              {contractorAction.action === 'wrong' && (
                                <Badge variant="destructive" className="text-xs">
                                  <X className="h-3 w-3 mr-1" />
                                  Marked as Wrong
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Add new trade contractor */}
            <div className="border-2 border-dashed border-muted rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label>Employer</Label>
                  <EmployerSearch
                    employers={publicData.employers || []}
                    value={newTradeContractor.employerId}
                    onSelect={(employerId, employerName) => {
                      setNewTradeContractor(prev => ({ ...prev, employerId, employerName }));
                    }}
                    placeholder="Search and select employer..."
                  />
                </div>
                <div className="flex-1">
                  <Label>Trade Type</Label>
                  <Select
                    value={newTradeContractor.tradeType}
                    onValueChange={(value) => setNewTradeContractor(prev => ({ ...prev, tradeType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select trade" />
                    </SelectTrigger>
                    <SelectContent>
                      {publicData.tradeOptions?.map(trade => (
                        <SelectItem key={trade.value} value={trade.value}>
                          {trade.label} ({trade.stage.replace('_', ' ')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-32">
                  <Label>Workforce</Label>
                  <Input
                    type="number"
                    placeholder="Est."
                    value={newTradeContractor.estimatedWorkforce}
                    onChange={(e) => setNewTradeContractor(prev => ({ ...prev, estimatedWorkforce: e.target.value }))}
                  />
                </div>
                <Button onClick={addTradeContractor} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-3">
          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="min-w-32"
          >
            {submitMutation.isPending ? 'Submitting...' : 'Submit Updates'}
          </Button>
        </div>
      </div>
    </div>
  );
}