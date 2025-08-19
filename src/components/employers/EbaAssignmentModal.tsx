import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, Plus, Building, ExternalLink, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ProcessedEbaData } from "@/utils/ebaDataProcessor";

interface EbaAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employer: {
    id: string;
    name: string;
  };
}

interface ExistingEba {
  id: string;
  eba_file_number: string | null;
  sector: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  fwc_document_url: string | null;
  company_name: string;
}

export const EbaAssignmentModal = ({ isOpen, onClose, employer }: EbaAssignmentModalProps) => {
  const [activeTab, setActiveTab] = useState("existing");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEba, setSelectedEba] = useState<string | null>(null);
  const [newEbaData, setNewEbaData] = useState<{
    eba_file_number?: string;
    sector?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    fwc_document_url?: string;
    fwc_lodgement_number?: string;
    fwc_matter_number?: string;
    comments?: string;
    nominal_expiry_date?: Date;
    fwc_certified_date?: Date;
  }>({});
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch existing EBAs that aren't already assigned to this employer
  const { data: existingEbas, isLoading } = useQuery({
    queryKey: ['unassigned-ebas', employer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_eba_records')
        .select(`
          id,
          eba_file_number,
          sector,
          contact_name,
          contact_email,
          contact_phone,
          fwc_document_url,
          employers(name)
        `)
        .is('employer_id', null);
      
      if (error) throw error;
      
      return (data || []).map((record: any) => ({
        ...record,
        company_name: (Array.isArray(record.employers) ? record.employers[0]?.name : record.employers?.name) || 'Unknown Company'
      })) as ExistingEba[];
    },
    enabled: isOpen && activeTab === "existing",
  });

  const filteredEbas = existingEbas?.filter(eba => 
    eba.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eba.eba_file_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eba.sector?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Mutation to assign existing EBA
  const assignExistingMutation = useMutation({
    mutationFn: async (ebaId: string) => {
      const { error } = await supabase
        .from('company_eba_records')
        .update({ employer_id: employer.id })
        .eq('id', ebaId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "EBA Assigned",
        description: "The EBA has been successfully assigned to this employer.",
      });
      queryClient.invalidateQueries({ queryKey: ['employers'] });
      queryClient.invalidateQueries({ queryKey: ['employer-analytics'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to assign EBA. Please try again.",
        variant: "destructive",
      });
      console.error('Error assigning EBA:', error);
    },
  });

  // Mutation to create new EBA
  const createNewMutation = useMutation({
    mutationFn: async (ebaData: any) => {
      const insertData = {
        employer_id: employer.id,
        eba_file_number: ebaData.eba_file_number,
        sector: ebaData.sector,
        contact_name: ebaData.contact_name,
        contact_email: ebaData.contact_email,
        contact_phone: ebaData.contact_phone,
        fwc_document_url: ebaData.fwc_document_url,
        fwc_lodgement_number: ebaData.fwc_lodgement_number,
        fwc_matter_number: ebaData.fwc_matter_number,
        comments: ebaData.comments,
        nominal_expiry_date: ebaData.nominal_expiry_date?.toISOString().split('T')[0] || null,
        fwc_certified_date: ebaData.fwc_certified_date?.toISOString().split('T')[0] || null,
      };
      
      const { error } = await supabase
        .from('company_eba_records')
        .insert(insertData);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "EBA Created",
        description: "New EBA has been created and assigned to this employer.",
      });
      queryClient.invalidateQueries({ queryKey: ['employers'] });
      queryClient.invalidateQueries({ queryKey: ['employer-analytics'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create EBA. Please try again.",
        variant: "destructive",
      });
      console.error('Error creating EBA:', error);
    },
  });

  const handleAssignExisting = () => {
    if (selectedEba) {
      assignExistingMutation.mutate(selectedEba);
    }
  };

  const handleCreateNew = () => {
    createNewMutation.mutate(newEbaData);
  };

  const resetForm = () => {
    setSelectedEba(null);
    setSearchTerm("");
    setNewEbaData({});
    setActiveTab("existing");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Assign EBA to {employer.name}
          </DialogTitle>
          <DialogDescription>
            Select an existing EBA from another company or create a new one for this employer.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing">Select Existing EBA</TabsTrigger>
            <TabsTrigger value="new">Create New EBA</TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="space-y-4">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by company name, EBA file number, or sector..."
                  value={searchTerm}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSearchTerm(e.target.value);
                  }}
                  onFocus={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="pl-10"
                />
              </div>

              {isLoading ? (
                <div className="text-center py-8">Loading existing EBAs...</div>
              ) : (
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {filteredEbas.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No available EBAs found
                    </div>
                  ) : (
                    filteredEbas.map((eba) => (
                      <Card 
                        key={eba.id} 
                        className={`cursor-pointer transition-colors ${
                          selectedEba === eba.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEba(eba.id);
                        }}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-sm">{eba.company_name}</CardTitle>
                              {eba.eba_file_number && (
                                <CardDescription className="text-xs">
                                  EBA: {eba.eba_file_number}
                                </CardDescription>
                              )}
                            </div>
                            {eba.sector && (
                              <Badge variant="secondary" className="text-xs">
                                {eba.sector}
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-1 text-xs text-muted-foreground">
                            {eba.contact_name && (
                              <div>Contact: {eba.contact_name}</div>
                            )}
                            {eba.contact_email && (
                              <div>Email: {eba.contact_email}</div>
                            )}
                            {eba.fwc_document_url && (
                              <div className="flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />
                                <span>FWC Document Available</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAssignExisting}
                  disabled={!selectedEba || assignExistingMutation.isPending}
                >
                  {assignExistingMutation.isPending ? "Assigning..." : "Assign Selected EBA"}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-4">
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="eba_file_number">EBA File Number</Label>
                  <Input
                    id="eba_file_number"
                    value={newEbaData.eba_file_number || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewEbaData(prev => ({ ...prev, eba_file_number: e.target.value }));
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Enter EBA file number"
                  />
                </div>
                <div>
                  <Label htmlFor="sector">Sector</Label>
                  <Input
                    id="sector"
                    value={newEbaData.sector || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewEbaData(prev => ({ ...prev, sector: e.target.value }));
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="e.g., Construction, Manufacturing"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nominal_expiry_date">Nominal Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newEbaData.nominal_expiry_date && "text-muted-foreground"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newEbaData.nominal_expiry_date ? (
                          format(newEbaData.nominal_expiry_date, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newEbaData.nominal_expiry_date}
                        onSelect={(date: Date | undefined) => setNewEbaData(prev => ({ ...prev, nominal_expiry_date: date }))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="fwc_certified_date">Approved Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newEbaData.fwc_certified_date && "text-muted-foreground"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newEbaData.fwc_certified_date ? (
                          format(newEbaData.fwc_certified_date, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newEbaData.fwc_certified_date}
                        onSelect={(date: Date | undefined) => setNewEbaData(prev => ({ ...prev, fwc_certified_date: date }))}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fwc_document_url">FWC Document URL</Label>
                  <Input
                    id="fwc_document_url"
                    type="url"
                    value={newEbaData.fwc_document_url || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewEbaData(prev => ({ ...prev, fwc_document_url: e.target.value }));
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="https://..."
                  />
                </div>
                <div className="opacity-0 pointer-events-none">
                  {/* Empty spacer */}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="contact_name">Contact Name</Label>
                  <Input
                    id="contact_name"
                    value={newEbaData.contact_name || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewEbaData(prev => ({ ...prev, contact_name: e.target.value }));
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Contact person name"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_phone">Contact Phone</Label>
                  <Input
                    id="contact_phone"
                    value={newEbaData.contact_phone || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewEbaData(prev => ({ ...prev, contact_phone: e.target.value }));
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Phone number"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={newEbaData.contact_email || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewEbaData(prev => ({ ...prev, contact_email: e.target.value }));
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fwc_lodgement_number">FWC Lodgement Number</Label>
                  <Input
                    id="fwc_lodgement_number"
                    value={newEbaData.fwc_lodgement_number || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewEbaData(prev => ({ ...prev, fwc_lodgement_number: e.target.value }));
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="FWC lodgement number"
                  />
                </div>
                <div>
                  <Label htmlFor="fwc_matter_number">FWC Matter Number</Label>
                  <Input
                    id="fwc_matter_number"
                    value={newEbaData.fwc_matter_number || ""}
                    onChange={(e) => {
                      e.stopPropagation();
                      setNewEbaData(prev => ({ ...prev, fwc_matter_number: e.target.value }));
                    }}
                    onFocus={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="FWC matter number"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  value={newEbaData.comments || ""}
                  onChange={(e) => {
                    e.stopPropagation();
                    setNewEbaData(prev => ({ ...prev, comments: e.target.value }));
                  }}
                  onFocus={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Additional comments or notes"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateNew}
                  disabled={createNewMutation.isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createNewMutation.isPending ? "Creating..." : "Create New EBA"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};