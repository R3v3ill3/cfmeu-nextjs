"use client";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building,
  Phone,
  Mail,
  FileText,
  ExternalLink,
  MapPin,
  Users,
  Briefcase,
  Upload as UploadIcon,
  Download,
  Database,
  Search,
  Plus,
} from "lucide-react";
import { getEbaStatusInfo } from "./ebaHelpers";
import { EmployerWorkersList } from "../workers/EmployerWorkersList";
import EmployerEditForm from "./EmployerEditForm";
import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WorkerForm } from "@/components/workers/WorkerForm";
import { FwcEbaSearchModal } from "./FwcEbaSearchModal";
import { IncolinkActionModal } from "./IncolinkActionModal";

type EmployerSite = {
  id: string;
  name: string;
  project_id: string;
  project_name: string;
};

type EmployerWithEba = {
  id: string;
  name: string;
  abn: string | null;
  employer_type: string;
  address_line_1: string | null;
  address_line_2: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  primary_contact_name: string | null;
  incolink_id: string | null;
  incolink_last_matched: string | null;
  estimated_worker_count: number | null;
  company_eba_records: {
    id: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    eba_file_number: string | null;
    fwc_lodgement_number: string | null;
    fwc_matter_number: string | null;
    eba_lodged_fwc: string | null;
    date_eba_signed: string | null;
    fwc_certified_date: string | null;
    fwc_document_url: string | null;
    sector: string | null;
    comments: string | null;
  }[];
};

interface EmployerDetailModalProps {
  employerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "overview" | "eba" | "sites" | "workers";
}

export const EmployerDetailModal = ({ employerId, isOpen, onClose, initialTab = "overview" }: EmployerDetailModalProps) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditing, setIsEditing] = useState(false);
  const [isManualWorkerOpen, setIsManualWorkerOpen] = useState(false);
  const [isImportingIncolink, setIsImportingIncolink] = useState(false);
  const [isFwcSearchOpen, setIsFwcSearchOpen] = useState(false);
  const [isIncolinkModalOpen, setIsIncolinkModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen, employerId]);

  const { data: myRole } = useQuery({
    queryKey: ["my-role", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as string) ?? null;
    },
    enabled: !!user?.id,
  });

  const canEdit = ["admin", "organiser", "lead_organiser", "delegate"].includes(myRole || "");

  const { data: employer, isLoading } = useQuery({
    queryKey: ["employer-detail", employerId],
    queryFn: async () => {
      if (!employerId) return null;
      const { data, error } = await supabase
        .from("employers")
        .select(
          `
          id, name, abn, employer_type, address_line_1, address_line_2, suburb, state, postcode, phone, email, website, primary_contact_name, incolink_id, incolink_last_matched, estimated_worker_count,
          company_eba_records (*)
        `
        )
        .eq("id", employerId)
        .single();

      if (error) throw error;
      return data as EmployerWithEba;
    },
    enabled: !!employerId && isOpen,
  });

  const { data: workerCount } = useQuery({
    queryKey: ["employer-worker-count", employerId],
    queryFn: async () => {
      if (!employerId) return 0;
      const { data, error } = await supabase.rpc("get_employer_worker_count", { p_employer_id: employerId });
      if (error) {
        console.error("Error fetching worker count:", error);
        return 0;
      }
      return data ?? 0;
    },
    enabled: !!employerId && isOpen,
  });

  // Worksites for this employer, across all projects
  const { data: employerSites = [], isFetching: isFetchingSites } = useQuery({
    queryKey: ["employer-sites", employerId],
    enabled: !!employerId && isOpen,
    queryFn: async () => {
      if (!employerId) return [];
      const { data, error } = await supabase.rpc("get_employer_sites", { p_employer_id: employerId });
      if (error) {
        console.error("Error fetching employer sites:", error);
        return [];
      }
      return data;
    },
  });

  // Stabilize callbacks to prevent infinite re-renders
  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleEditSaved = useCallback(() => {
    setIsEditing(false);
    queryClient.invalidateQueries({ queryKey: ["employers"] });
    queryClient.invalidateQueries({ queryKey: ["employer-detail", employerId] });
  }, [queryClient, employerId]);

  if (!isOpen) return null;

  const ebaStatus = employer?.company_eba_records?.[0] ? getEbaStatusInfo(employer.company_eba_records[0]) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="employer-dialog-description">
        <DialogDescription id="employer-dialog-description" className="sr-only">
          View and edit employer details, including company info, EBA, worksites, and workers.
        </DialogDescription>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Building className="h-6 w-6" />
              <div>
                <DialogTitle className="text-xl">{employer?.name || (<span className="inline-flex items-center gap-2"><img src="/spinner.gif" alt="Loading" className="h-4 w-4" /> Loading...</span>)}</DialogTitle>
                {employer?.abn && (
                  <p className="text-sm text-muted-foreground">ABN: {employer.abn}</p>
                )}
              </div>
            </div>
            {employer && canEdit && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center flex items-center justify-center gap-2"><img src="/spinner.gif" alt="Loading" className="h-4 w-4" /> Loading employer details...</div>
        ) : employer ? (
          isEditing ? (
            <div className="space-y-6">
              <EmployerEditForm
                employer={employer}
                onCancel={handleEditCancel}
                onSaved={handleEditSaved}
              />
            </div>
          ) : (
            <>
            <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as "overview" | "eba" | "sites" | "workers")} className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="eba">EBA Details</TabsTrigger>
                <TabsTrigger value="sites">Worksites</TabsTrigger>
                <TabsTrigger value="workers">Workers</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Company Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Employer Type</label>
                        <p className="capitalize">{employer.employer_type.replace(/_/g, " ")}</p>
                      </div>

                      {typeof workerCount === "number" && workerCount > 0 && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Known workers</label>
                          <p>{workerCount}</p>
                        </div>
                      )}

                      {(employer.address_line_1 || employer.suburb) && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            Address
                          </label>
                          <div className="text-sm">
                            {employer.address_line_1 && <p>{employer.address_line_1}</p>}
                            {employer.address_line_2 && <p>{employer.address_line_2}</p>}
                            {(employer.suburb || employer.state || employer.postcode) && (
                              <p>
                                {[employer.suburb, employer.state, employer.postcode].filter(Boolean).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {employer.website && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Website</label>
                          <a
                            href={employer.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {employer.website}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {employer.primary_contact_name && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Primary Contact</label>
                          <p>{employer.primary_contact_name}</p>
                        </div>
                      )}

                      {employer.phone && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Phone</label>
                          <a href={`tel:${employer.phone}`} className="text-primary hover:underline">
                            {employer.phone}
                          </a>
                        </div>
                      )}

                      {employer.email && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Email</label>
                          <a href={`mailto:${employer.email}`} className="text-primary hover:underline">
                            {employer.email}
                          </a>
                        </div>
                      )}

                      {employer.company_eba_records?.[0] && (
                        <>
                          {employer.company_eba_records[0].contact_name && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">EBA Contact</label>
                              <p>{employer.company_eba_records[0].contact_name}</p>
                            </div>
                          )}

                          {employer.company_eba_records[0].contact_phone && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">EBA Phone</label>
                              <a href={`tel:${employer.company_eba_records[0].contact_phone}`} className="text-primary hover:underline">
                                {employer.company_eba_records[0].contact_phone}
                              </a>
                            </div>
                          )}

                          {employer.company_eba_records[0].contact_email && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">EBA Email</label>
                              <a href={`mailto:${employer.company_eba_records[0].contact_email}`} className="text-primary hover:underline">
                                {employer.company_eba_records[0].contact_email}
                              </a>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      Incolink Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {employer.incolink_id ? (
                      <>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Incolink Employer ID</label>
                          <p>{employer.incolink_id}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Last Payment Date</label>
                          <p>
                            {employer.incolink_last_matched
                              ? new Date(employer.incolink_last_matched).toLocaleDateString()
                              : "N/A"}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" disabled>
                          Sync Incolink
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => setIsIncolinkModalOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Incolink ID
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {ebaStatus && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        EBA Status Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4">
                        <Badge variant={ebaStatus.variant} className="text-sm px-3 py-1">
                          {ebaStatus.label}
                        </Badge>
                        {employer.company_eba_records?.[0]?.sector && (
                          <Badge variant="outline">
                            {employer.company_eba_records[0].sector}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="eba" className="space-y-4">
                {employer.company_eba_records?.[0] ? (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            EBA Information
                          </div>
                          {employer.company_eba_records[0].fwc_document_url && (
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={employer.company_eba_records[0].fwc_document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View FWC Document
                              </a>
                            </Button>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {employer.company_eba_records[0].eba_file_number && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">EBA File Number</label>
                              <p className="font-mono text-sm">{employer.company_eba_records[0].eba_file_number}</p>
                            </div>
                          )}

                          {employer.company_eba_records[0].fwc_lodgement_number && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">FWC Lodgement Number</label>
                              <p className="font-mono text-sm">{employer.company_eba_records[0].fwc_lodgement_number}</p>
                            </div>
                          )}

                          {employer.company_eba_records[0].fwc_matter_number && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">FWC Matter Number</label>
                              <p className="font-mono text-sm">{employer.company_eba_records[0].fwc_matter_number}</p>
                            </div>
                          )}

                          {employer.company_eba_records[0].eba_lodged_fwc && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">Lodged with FWC</label>
                              <p>{new Date(employer.company_eba_records[0].eba_lodged_fwc).toLocaleDateString()}</p>
                            </div>
                          )}

                          {employer.company_eba_records[0].date_eba_signed && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">EBA Signed</label>
                              <p>{new Date(employer.company_eba_records[0].date_eba_signed).toLocaleDateString()}</p>
                            </div>
                          )}

                          {employer.company_eba_records[0].fwc_certified_date && (
                            <div>
                              <label className="text-sm font-medium text-muted-foreground">FWC Certified</label>
                              <p>{new Date(employer.company_eba_records[0].fwc_certified_date).toLocaleDateString()}</p>
                            </div>
                          )}
                        </div>

                        {employer.company_eba_records[0].comments && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Comments</label>
                            <p className="text-sm bg-muted p-3 rounded-md">{employer.company_eba_records[0].comments}</p>
                          </div>
                        )}

                        {!employer.company_eba_records[0].fwc_document_url && canEdit && (
                          <div className="md:col-span-2 pt-4 border-t">
                            <Button variant="secondary" size="sm" onClick={() => setIsFwcSearchOpen(true)}>
                              <Search className="mr-2 h-4 w-4" />
                              Find EBA on FWC to complete details
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No EBA Information</h3>
                      <p className="text-muted-foreground text-center">
                        No Enterprise Bargaining Agreement information is available for this employer.
                      </p>
                      {canEdit && (
                        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setIsFwcSearchOpen(true)}>
                          <Search className="mr-2 h-4 w-4" />
                          Search FWC for EBA
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="sites" className="space-y-4">
                {isFetchingSites ? (
                  <Card>
                    <CardContent className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><img src="/spinner.gif" alt="Loading" className="h-4 w-4" /> Loading worksites…</CardContent>
                  </Card>
                ) : employerSites.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Briefcase className="h-5 w-5" />
                        Worksites
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {employerSites.map((s: EmployerSite) => (
                          <div key={s.id} className="flex items-center justify-between border rounded px-3 py-2">
                            <div className="truncate mr-3">
                              <div className="font-medium truncate">{s.name}</div>
                              {s.project_name && (
                                <div className="text-xs text-muted-foreground truncate">{s.project_name}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No Worksites</h3>
                      <p className="text-muted-foreground text-center">
                        This employer has not been assigned to any worksites.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

<TabsContent value="workers" className="space-y-4">
  {employer && canEdit && (
    <div className="flex items-center justify-between">
      <div />
      <div className="flex items-center gap-2">
        {!!(employer as any).incolink_id && (
          <Button
            size="sm"
            variant="secondary"
                          disabled={isImportingIncolink}
                          aria-busy={isImportingIncolink}
            onClick={async () => {
                            setIsImportingIncolink(true);
              try {
                const res = await fetch('/api/incolink/import-workers', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ employerId })
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data?.error || 'Import failed')
                queryClient.invalidateQueries({ queryKey: ["employer-workers", employerId] })
                queryClient.invalidateQueries({ queryKey: ["employer-detail", employerId] })
                alert(`Imported from Incolink invoice ${data.invoiceNumber}. Created ${data.counts.createdWorkers}, matched ${data.counts.matchedWorkers}, placements ${data.counts.placementsCreated}/${data.counts.totalParsed}`)
              } catch (e) {
                alert(`Incolink import failed: ${(e as Error).message}`)
                            } finally {
                              setIsImportingIncolink(false);
              }
            }}
            title="Import workers from Incolink invoice using employer Incolink ID"
          >
                          {isImportingIncolink ? (
                            <span className="inline-flex items-center">
                              <img src="/spinner.gif" alt="Loading" className="h-4 w-4 mr-2" />
                              Importing...
                            </span>
                          ) : (
                            <span className="inline-flex items-center">
                              <Download className="h-4 w-4 mr-2" />
                              Import from Incolink
                            </span>
                          )}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm">
              <UploadIcon className="h-4 w-4 mr-2" />
              Upload workers
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsManualWorkerOpen(true)}>
              Manually enter worker details
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`/upload?employerId=${employer.id}&employerName=${encodeURIComponent(employer.name)}`}>
                Upload list
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )}
                {isImportingIncolink && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <img src="/spinner.gif" alt="Loading" className="h-4 w-4" />
                    Importing from Incolink… this may take up to a minute.
                  </div>
                )}
  <EmployerWorkersList employerId={employerId!} />
  <Dialog open={isManualWorkerOpen} onOpenChange={setIsManualWorkerOpen}>
    <DialogContent className="max-w-2xl" aria-describedby="manual-worker-description">
      <DialogDescription id="manual-worker-description" className="sr-only">
        Add a new worker manually to this employer.
      </DialogDescription>
      <DialogHeader>
        <DialogTitle>Add New Worker</DialogTitle>
      </DialogHeader>
      <WorkerForm
        onSuccess={() => {
          setIsManualWorkerOpen(false);
        }}
      />
    </DialogContent>
  </Dialog>
 </TabsContent>
              </Tabs>
              {isFwcSearchOpen && employer && (
                <FwcEbaSearchModal
                  isOpen={isFwcSearchOpen}
                  onClose={() => setIsFwcSearchOpen(false)}
                  employerId={employer.id}
                  employerName={employer.name}
                  abn={employer.abn ?? undefined}
                  onLinkEba={async () => {
                    await queryClient.invalidateQueries({ queryKey: ["employer-detail", employerId] });
                    setIsFwcSearchOpen(false);
                  }}
                />
              )}
              {employer && (
                <IncolinkActionModal
                  isOpen={isIncolinkModalOpen}
                  onClose={() => setIsIncolinkModalOpen(false)}
                  employerId={employer.id}
                  employerName={employer.name}
                  currentIncolinkId={employer.incolink_id}
                />
              )}
            </>
          )
        ) : (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Employer not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};