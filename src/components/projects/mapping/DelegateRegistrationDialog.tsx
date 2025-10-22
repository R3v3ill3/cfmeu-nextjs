"use client"

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, Plus, ExternalLink, UserPlus } from "lucide-react";
import DateInput from "@/components/ui/date-input";
import { WorkerSelector } from "../compliance/WorkerSelector";

interface DelegateRegistrationDialogProps {
  projectId: string;
  mainSiteId: string | null;
  role: 'site_delegate' | 'site_hsr';
  mode: 'add' | 'change' | 'additional' | 'register';
  onClose: () => void;
  onSuccess: () => void;
}

interface WorkerData {
  id: string;
  first_name: string;
  surname: string;
  mobile_phone: string | null;
  email: string | null;
  home_address_line_1: string | null;
  home_address_line_2: string | null;
  home_address_suburb: string | null;
  home_address_postcode: string | null;
  home_address_state: string | null;
  union_membership_status: string;
}

interface ProjectData {
  id: string;
  name: string;
  proposed_finish_date: string | null;
  job_sites: Array<{
    id: string;
    name: string;
    location: string | null;
  }>;
}

interface EmployerData {
  id: string;
  name: string;
}

// Rep type mapping for CFMEU form
const REP_TYPE_MAPPING = {
  site_delegate: 'Delegate Only',
  hsr: 'OHS Rep Only',
  both: 'Delegate & OHS Rep'
};

export function DelegateRegistrationDialog({ 
  projectId, 
  mainSiteId, 
  role, 
  mode, 
  onClose, 
  onSuccess 
}: DelegateRegistrationDialogProps) {
  const [step, setStep] = useState<'worker-selection' | 'worker-details' | 'registration-details' | 'cfmeu-form'>('worker-selection');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [showWorkerSelector, setShowWorkerSelector] = useState(false);
  const [showNewWorkerForm, setShowNewWorkerForm] = useState(false);
  const [isNewWorker, setIsNewWorker] = useState(false);
  
  // Form data states
  const [workerFormData, setWorkerFormData] = useState<Partial<WorkerData>>({});
  const [registrationData, setRegistrationData] = useState({
    repType: role === 'site_delegate' ? 'Delegate Only' : 'OHS Rep Only',
    electedBy: '',
    dateElected: '',
    ohsTrainingDate: '',
    ohsRefresherTrainingDate: '',
    notes: ''
  });
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // Fetch project data
  const { data: projectData } = useQuery<ProjectData>({
    queryKey: ["project-delegate-registration", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          proposed_finish_date,
          job_sites (
            id,
            name,
            location
          )
        `)
        .eq("id", projectId)
        .single();
      
      if (error) throw error;
      return data as ProjectData;
    },
    enabled: !!projectId
  });

  // Fetch employers assigned to this project
  const { data: employers = [] } = useQuery<EmployerData[]>({
    queryKey: ["project-employers", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_assignments")
        .select(`
          employer_id,
          employers!inner (
            id,
            name
          )
        `)
        .eq("project_id", projectId);
      
      if (error) throw error;
      return (data || [])
        .filter(pa => pa.employers)
        .map(pa => pa.employers as unknown as EmployerData);
    },
    enabled: !!projectId
  });

  // Fetch selected worker data
  const { data: selectedWorker } = useQuery<WorkerData | null>({
    queryKey: ["worker-delegate-registration", selectedWorkerId],
    queryFn: async () => {
      if (!selectedWorkerId) return null;
      
      const { data, error } = await supabase
        .from("workers")
        .select(`
          id,
          first_name,
          surname,
          mobile_phone,
          email,
          home_address_line_1,
          home_address_line_2,
          home_address_suburb,
          home_address_postcode,
          home_address_state,
          union_membership_status
        `)
        .eq("id", selectedWorkerId)
        .single();
      
      if (error) throw error;
      return data as WorkerData;
    },
    enabled: !!selectedWorkerId
  });

  // Update worker form data when selected worker changes
  useEffect(() => {
    if (selectedWorker) {
      setWorkerFormData(selectedWorker);
      if (!isNewWorker) {
        setStep('worker-details');
      }
    }
  }, [selectedWorker, isNewWorker]);

  // Create/update worker mutation
  const workerMutation = useMutation({
    mutationFn: async (data: Partial<WorkerData>) => {
      if (selectedWorkerId) {
        // Update existing worker
        const { error } = await supabase
          .from("workers")
          .update(data)
          .eq("id", selectedWorkerId);
        if (error) throw error;
        return selectedWorkerId;
      } else {
        // Create new worker - ensure required fields have defaults
        const workerData = {
          ...data,
          union_membership_status: data.union_membership_status || 'member',
        };
        const { data: newWorker, error } = await supabase
          .from("workers")
          .insert(workerData)
          .select("id")
          .single();
        if (error) throw error;
        return newWorker.id;
      }
    },
    onSuccess: (workerId) => {
      setSelectedWorkerId(workerId);
      // After worker is saved (created or updated), proceed to registration
      setStep('registration-details');
      setIsNewWorker(false);
      toast.success(selectedWorkerId ? "Worker updated" : "Worker created");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save worker");
    }
  });

  // Create union role and assignments mutation
  const registrationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkerId || !mainSiteId || !selectedEmployerId) {
        throw new Error("Missing required data for registration");
      }

      // Determine union role name based on rep type
      let unionRoleName: string;
      if (registrationData.repType === 'Delegate Only') {
        unionRoleName = 'site_delegate';
      } else if (registrationData.repType === 'OHS Rep Only') {
        unionRoleName = 'hsr';
      } else {
        // For "Delegate & OHS Rep", create site_delegate role (we'll create HSR separately)
        unionRoleName = 'site_delegate';
      }

      // Create union role
      const { data: unionRole, error: roleError } = await supabase
        .from("union_roles")
        .insert({
          worker_id: selectedWorkerId,
          name: unionRoleName,
          job_site_id: mainSiteId,
          start_date: new Date().toISOString().split('T')[0],
          elected_by: registrationData.electedBy || null,
          date_elected: registrationData.dateElected || null,
          ohs_training_date: registrationData.ohsTrainingDate || null,
          ohs_refresher_training_date: registrationData.ohsRefresherTrainingDate || null,
          notes: registrationData.notes || null
        })
        .select("id")
        .single();

      if (roleError) throw roleError;

      // If "Delegate & OHS Rep", also create HSR role
      if (registrationData.repType === 'Delegate & OHS Rep') {
        const { error: hsrError } = await supabase
          .from("union_roles")
          .insert({
            worker_id: selectedWorkerId,
            name: 'hsr',
            job_site_id: mainSiteId,
            start_date: new Date().toISOString().split('T')[0],
            elected_by: registrationData.electedBy || null,
            date_elected: registrationData.dateElected || null,
            ohs_training_date: registrationData.ohsTrainingDate || null,
            ohs_refresher_training_date: registrationData.ohsRefresherTrainingDate || null,
            notes: registrationData.notes || null
          });

        if (hsrError) throw hsrError;
      }

      // Ensure worker is assigned to the employer
      // First check if placement exists
      const { data: existingPlacement } = await supabase
        .from("worker_placements")
        .select("id")
        .eq("worker_id", selectedWorkerId)
        .eq("employer_id", selectedEmployerId)
        .eq("job_site_id", mainSiteId)
        .single();

      if (!existingPlacement) {
        const { error: assignmentError } = await supabase
          .from("worker_placements")
          .insert({
            worker_id: selectedWorkerId,
            employer_id: selectedEmployerId,
            job_site_id: mainSiteId,
            start_date: new Date().toISOString().split('T')[0],
            employment_status: 'permanent' // Default, can be updated later
          });

        if (assignmentError) throw assignmentError;
      }

      // Update site contact
      const contactName = `${workerFormData.first_name} ${workerFormData.surname}`;
      
      // First check if site contact exists
      const { data: existingContact } = await supabase
        .from("site_contacts")
        .select("id")
        .eq("job_site_id", mainSiteId)
        .eq("role", role)
        .single();

      if (existingContact) {
        // Update existing contact
        const { error: contactError } = await supabase
          .from("site_contacts")
          .update({
            name: contactName,
            email: workerFormData.email || null,
            phone: workerFormData.mobile_phone || null
          })
          .eq("id", existingContact.id);

        if (contactError) throw contactError;
      } else {
        // Create new contact
        const { error: contactError } = await supabase
          .from("site_contacts")
          .insert({
            job_site_id: mainSiteId,
            role: role,
            name: contactName,
            email: workerFormData.email || null,
            phone: workerFormData.mobile_phone || null
          });

        if (contactError) throw contactError;
      }

      return unionRole.id;
    },
    onSuccess: () => {
      setStep('cfmeu-form');
      toast.success("Representative registered successfully");
    },
    onError: (error: any) => {
      console.error("Registration error:", error);
      toast.error(`Registration failed: ${error.message || 'Unknown error'}`);
      
      // If the error is related to database constraints, provide helpful message
      if (error.message?.includes('constraint') || error.message?.includes('unique')) {
        toast.error("This worker may already be assigned to this role. Please check existing assignments.");
      }
    }
  });

  const handleWorkerSelection = (workerId: string) => {
    setSelectedWorkerId(workerId);
    setShowWorkerSelector(false);
    setShowNewWorkerForm(false);
    setIsNewWorker(false);
  };

  const handleNewWorker = () => {
    setShowNewWorkerForm(true);
    setShowWorkerSelector(false);
    setIsNewWorker(true);
    setSelectedWorkerId(null);
    setWorkerFormData({
      union_membership_status: 'member' // Default for new workers
    });
  };

  const handleSearchExistingWorkers = () => {
    setShowWorkerSelector(true);
    setShowNewWorkerForm(false);
    setIsNewWorker(false);
  };

  const handleWorkerFormSubmit = () => {
    // Validate required fields
    if (!workerFormData.first_name || !workerFormData.surname) {
      toast.error("First name and surname are required");
      return;
    }

    workerMutation.mutate(workerFormData);
  };

  const handleRegistrationSubmit = () => {
    if (!selectedEmployerId) {
      toast.error("Please select an employer");
      return;
    }

    registrationMutation.mutate();
  };

  const generateCFMEUFormData = () => {
    if (!selectedWorker || !projectData || !selectedEmployerId) return null;

    const employer = employers.find(e => e.id === selectedEmployerId);
    const mainSite = projectData.job_sites.find(s => s.id === mainSiteId);

    return {
      firstName: selectedWorker.first_name,
      surname: selectedWorker.surname,
      mobileNumber: selectedWorker.mobile_phone || '',
      union: 'CFMEU',
      emailAddress: selectedWorker.email || '',
      homeAddress: [
        selectedWorker.home_address_line_1,
        selectedWorker.home_address_line_2,
        selectedWorker.home_address_suburb,
        selectedWorker.home_address_postcode,
        selectedWorker.home_address_state
      ].filter(Boolean).join(', '),
      employer: employer?.name || '',
      siteName: mainSite?.name || projectData.name,
      siteAddress: mainSite?.location || '',
      sitePhone: '', // Will be populated from site manager contact
      siteFax: '',
      siteType: 'Construction Site', // Default
      siteEstimatedCompletionDate: projectData.proposed_finish_date || '',
      industrySector: 'Construction',
      electedBy: registrationData.electedBy,
      dateElected: registrationData.dateElected,
      organiser: '', // To be filled by organiser
      repType: registrationData.repType,
      dateCompletedOHSRefresherTraining: registrationData.ohsRefresherTrainingDate,
      dateCompletedOHSTraining: registrationData.ohsTrainingDate
    };
  };

  const openCFMEUForm = () => {
    const formData = generateCFMEUFormData();
    if (!formData) return;

    // Create URL with pre-filled data
    const cfmeuUrl = new URL('https://nsw.cfmeu.org/members/health-safety/delegate-hsr-registration/');
    
    // Open in new window
    window.open(cfmeuUrl.toString(), '_blank');
    
    // Show instructions to user
    toast.success("CFMEU form opened in new window. Please fill in the remaining fields and submit.");
  };

  const getDialogTitle = () => {
    const roleLabel = role === 'site_delegate' ? 'Site Delegate' : 'Site HSR';
    switch (mode) {
      case 'add': return `Add ${roleLabel}`;
      case 'change': return `Change ${roleLabel}`;
      case 'additional': return `Add Additional ${roleLabel}`;
      case 'register': return `Register ${roleLabel}`;
      default: return `Manage ${roleLabel}`;
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>

        {step === 'worker-selection' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Select an existing worker or add a new one to assign as {role === 'site_delegate' ? 'Site Delegate' : 'Site HSR'}.
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={handleSearchExistingWorkers} 
                variant={showWorkerSelector ? "default" : "outline"}
                className="flex-1"
              >
                <Search className="w-4 h-4 mr-2" />
                Search Existing Workers
              </Button>
              <Button 
                onClick={handleNewWorker} 
                variant={showNewWorkerForm ? "default" : "outline"}
                className="flex-1"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add New Worker
              </Button>
            </div>

            {showNewWorkerForm && (
              <Card>
                <CardHeader>
                  <CardTitle>New Worker Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={workerFormData.first_name || ''}
                        onChange={(e) => setWorkerFormData(prev => ({ ...prev, first_name: e.target.value }))}
                        placeholder="First name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="surname">Surname *</Label>
                      <Input
                        id="surname"
                        value={workerFormData.surname || ''}
                        onChange={(e) => setWorkerFormData(prev => ({ ...prev, surname: e.target.value }))}
                        placeholder="Surname"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="mobile">Mobile Phone</Label>
                      <Input
                        id="mobile"
                        value={workerFormData.mobile_phone || ''}
                        onChange={(e) => setWorkerFormData(prev => ({ ...prev, mobile_phone: e.target.value }))}
                        placeholder="Mobile phone"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={workerFormData.email || ''}
                        onChange={(e) => setWorkerFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Email address"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address1">Home Address</Label>
                    <Input
                      id="address1"
                      value={workerFormData.home_address_line_1 || ''}
                      onChange={(e) => setWorkerFormData(prev => ({ ...prev, home_address_line_1: e.target.value }))}
                      placeholder="Address line 1"
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="suburb">Suburb</Label>
                      <Input
                        id="suburb"
                        value={workerFormData.home_address_suburb || ''}
                        onChange={(e) => setWorkerFormData(prev => ({ ...prev, home_address_suburb: e.target.value }))}
                        placeholder="Suburb"
                      />
                    </div>
                    <div>
                      <Label htmlFor="postcode">Postcode</Label>
                      <Input
                        id="postcode"
                        value={workerFormData.home_address_postcode || ''}
                        onChange={(e) => setWorkerFormData(prev => ({ ...prev, home_address_postcode: e.target.value }))}
                        placeholder="Postcode"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Select
                        value={workerFormData.home_address_state || ''}
                        onValueChange={(value) => setWorkerFormData(prev => ({ ...prev, home_address_state: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NSW">NSW</SelectItem>
                          <SelectItem value="VIC">VIC</SelectItem>
                          <SelectItem value="QLD">QLD</SelectItem>
                          <SelectItem value="WA">WA</SelectItem>
                          <SelectItem value="SA">SA</SelectItem>
                          <SelectItem value="TAS">TAS</SelectItem>
                          <SelectItem value="ACT">ACT</SelectItem>
                          <SelectItem value="NT">NT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="membershipStatus">Union Membership Status</Label>
                    <Select
                      value={workerFormData.union_membership_status || 'member'}
                      onValueChange={(value) => setWorkerFormData(prev => ({ ...prev, union_membership_status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="non_member">Non-member</SelectItem>
                        <SelectItem value="potential">Potential</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={handleWorkerFormSubmit} disabled={workerMutation.isPending}>
                      {workerMutation.isPending ? 'Creating...' : 'Continue'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowNewWorkerForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {step === 'worker-details' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              {isNewWorker || !selectedWorker ? 
                "Complete all worker details before proceeding to registration." :
                "Review and update worker details as needed."
              }
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Worker Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={workerFormData.first_name || ''}
                      onChange={(e) => setWorkerFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="surname">Surname *</Label>
                    <Input
                      id="surname"
                      value={workerFormData.surname || ''}
                      onChange={(e) => setWorkerFormData(prev => ({ ...prev, surname: e.target.value }))}
                      placeholder="Surname"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="mobile">Mobile Phone *</Label>
                    <Input
                      id="mobile"
                      value={workerFormData.mobile_phone || ''}
                      onChange={(e) => setWorkerFormData(prev => ({ ...prev, mobile_phone: e.target.value }))}
                      placeholder="Mobile phone"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={workerFormData.email || ''}
                      onChange={(e) => setWorkerFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="Email address"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="address1">Home Address *</Label>
                  <Input
                    id="address1"
                    value={workerFormData.home_address_line_1 || ''}
                    onChange={(e) => setWorkerFormData(prev => ({ ...prev, home_address_line_1: e.target.value }))}
                    placeholder="Address line 1"
                    className="mb-2"
                  />
                  <Input
                    value={workerFormData.home_address_line_2 || ''}
                    onChange={(e) => setWorkerFormData(prev => ({ ...prev, home_address_line_2: e.target.value }))}
                    placeholder="Address line 2 (optional)"
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="suburb">Suburb *</Label>
                    <Input
                      id="suburb"
                      value={workerFormData.home_address_suburb || ''}
                      onChange={(e) => setWorkerFormData(prev => ({ ...prev, home_address_suburb: e.target.value }))}
                      placeholder="Suburb"
                    />
                  </div>
                  <div>
                    <Label htmlFor="postcode">Postcode *</Label>
                    <Input
                      id="postcode"
                      value={workerFormData.home_address_postcode || ''}
                      onChange={(e) => setWorkerFormData(prev => ({ ...prev, home_address_postcode: e.target.value }))}
                      placeholder="Postcode"
                    />
                  </div>
                  <div>
                    <Label htmlFor="state">State *</Label>
                    <Select
                      value={workerFormData.home_address_state || ''}
                      onValueChange={(value) => setWorkerFormData(prev => ({ ...prev, home_address_state: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NSW">NSW</SelectItem>
                        <SelectItem value="VIC">VIC</SelectItem>
                        <SelectItem value="QLD">QLD</SelectItem>
                        <SelectItem value="WA">WA</SelectItem>
                        <SelectItem value="SA">SA</SelectItem>
                        <SelectItem value="TAS">TAS</SelectItem>
                        <SelectItem value="ACT">ACT</SelectItem>
                        <SelectItem value="NT">NT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="membershipStatus">Union Membership Status *</Label>
                  <Select
                    value={workerFormData.union_membership_status || 'member'}
                    onValueChange={(value) => setWorkerFormData(prev => ({ ...prev, union_membership_status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="non_member">Non-member</SelectItem>
                      <SelectItem value="potential">Potential</SelectItem>
                      <SelectItem value="declined">Declined</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => {
                      // Enhanced validation
                      const requiredFields = [
                        'first_name', 'surname', 'mobile_phone', 'home_address_line_1', 
                        'home_address_suburb', 'home_address_postcode', 'home_address_state'
                      ];
                      
                      const missingFields = requiredFields.filter(field => 
                        !workerFormData[field as keyof WorkerData]?.toString().trim()
                      );
                      
                      if (missingFields.length > 0) {
                        toast.error(`Please complete: ${missingFields.map(f => f.replace(/_/g, ' ')).join(', ')}`);
                        return;
                      }
                      
                      if (selectedWorkerId) {
                        // Update existing worker
                        workerMutation.mutate(workerFormData);
                      } else {
                        // Save worker details and go to registration
                        workerMutation.mutate(workerFormData);
                      }
                    }}
                    disabled={workerMutation.isPending}
                  >
                    {workerMutation.isPending ? 'Saving...' : 
                     selectedWorkerId ? 'Update & Continue' : 'Save & Continue'}
                  </Button>
                  <Button variant="outline" onClick={() => setStep('worker-selection')}>
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'registration-details' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Enter registration and training details for the representative.
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>Registration Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="employer">Employer *</Label>
                  <Select
                    value={selectedEmployerId || ''}
                    onValueChange={setSelectedEmployerId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employer" />
                    </SelectTrigger>
                    <SelectContent>
                      {employers.map(employer => (
                        <SelectItem key={employer.id} value={employer.id}>
                          {employer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="repType">Representative Type</Label>
                  <Select
                    value={registrationData.repType}
                    onValueChange={(value) => setRegistrationData(prev => ({ ...prev, repType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Delegate Only">Delegate Only</SelectItem>
                      <SelectItem value="OHS Rep Only">OHS Rep Only</SelectItem>
                      <SelectItem value="Delegate & OHS Rep">Delegate & OHS Rep</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="electedBy">Elected By</Label>
                    <Input
                      id="electedBy"
                      value={registrationData.electedBy}
                      onChange={(e) => setRegistrationData(prev => ({ ...prev, electedBy: e.target.value }))}
                      placeholder="e.g., Site workers, Union members"
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateElected">Date Elected</Label>
                    <DateInput
                      value={registrationData.dateElected}
                      onChange={(e) => setRegistrationData(prev => ({ ...prev, dateElected: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ohsTraining">OHS Training Date</Label>
                    <DateInput
                      value={registrationData.ohsTrainingDate}
                      onChange={(e) => setRegistrationData(prev => ({ ...prev, ohsTrainingDate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ohsRefresher">OHS Refresher Training Date</Label>
                    <DateInput
                      value={registrationData.ohsRefresherTrainingDate}
                      onChange={(e) => setRegistrationData(prev => ({ ...prev, ohsRefresherTrainingDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={registrationData.notes}
                    onChange={(e) => setRegistrationData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes or comments"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleRegistrationSubmit} disabled={registrationMutation.isPending}>
                    {registrationMutation.isPending ? 'Registering...' : 'Register Representative'}
                  </Button>
                  <Button variant="outline" onClick={() => setStep('worker-details')}>
                    Back
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'cfmeu-form' && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Representative registered successfully! Now submit to CFMEU official registration.
            </div>
            
            <Card>
              <CardHeader>
                <CardTitle>CFMEU Official Registration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                    <UserPlus className="w-4 h-4" />
                    Representative Successfully Registered
                  </div>
                  <div className="text-sm text-green-700">
                    {workerFormData.first_name} {workerFormData.surname} has been registered as {registrationData.repType} for this site.
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-medium">Next Step: Official CFMEU Registration</div>
                  <div className="text-sm text-muted-foreground">
                    Click the button below to open the official CFMEU registration form with pre-filled data.
                    You'll need to complete any remaining fields and submit the form.
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm space-y-2">
                    <div><strong>Worker:</strong> {workerFormData.first_name} {workerFormData.surname}</div>
                    <div><strong>Role:</strong> {registrationData.repType}</div>
                    <div><strong>Site:</strong> {projectData?.job_sites.find(s => s.id === mainSiteId)?.name || projectData?.name}</div>
                    <div><strong>Employer:</strong> {employers.find(e => e.id === selectedEmployerId)?.name}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={openCFMEUForm} className="flex-1">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open CFMEU Registration Form
                  </Button>
                  <Button variant="outline" onClick={onSuccess}>
                    Done
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showWorkerSelector && (
          <WorkerSelector
            projectId={projectId}
            title="Select Worker for Representative Role"
            onSelect={handleWorkerSelection}
            onClose={() => {
              setShowWorkerSelector(false);
              // Reset state when closing worker selector
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
