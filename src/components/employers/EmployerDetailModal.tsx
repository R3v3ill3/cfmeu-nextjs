"use client";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  AlertCircle,
  Tag,
  Edit,
  Trash2,
  CheckCircle,
  X,
} from "lucide-react";
import { getEbaStatusInfo } from "./ebaHelpers";
import { EmployerWorkersList } from "../workers/EmployerWorkersList";
import EmployerEditForm from "./EmployerEditForm";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import Link from "next/link";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WorkerForm } from "@/components/workers/WorkerForm";
import { FwcEbaSearchModal } from "./FwcEbaSearchModal";
import { IncolinkActionModal } from "./IncolinkActionModal";
import { useToast } from "@/hooks/use-toast";
import { EmployerCategoriesEditor } from "./EmployerCategoriesEditor";
import { withTimeout, QUERY_TIMEOUTS } from "@/lib/withTimeout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrafficLightRatingTab } from "./TrafficLightRatingTab";
import { TrafficLightRatingDisplay } from "./TrafficLightRatingDisplay";
import { useRouter } from "next/navigation";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";

const AGENT_DEBUG_INGEST_URL =
  "http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2";
const AGENT_DEBUG_RUN_ID = "pre-fix";

function agentDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const url = new URL(window.location.href);
    const enabledByParam = url.searchParams.get("__agent_debug") === "1";
    if (enabledByParam) {
      try {
        sessionStorage.setItem("__agent_debug", "1");
      } catch {}
      return true;
    }
    try {
      return sessionStorage.getItem("__agent_debug") === "1";
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

function userIdSuffix(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return userId.slice(-6);
}

type EmployerSite = {
  id: string;
  name: string;
  project_id: string;
  project_name: string;
  address?: string;
  patch_names?: string[];
  organiser_names?: string[];
  compliance_check_conducted?: boolean;
  compliance_rating?: 'green' | 'amber' | 'yellow' | 'red' | 'unknown' | null;
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
  enterprise_agreement_status: boolean | null;
  eba_status_source: string | null;
  eba_status_updated_at: string | null;
  eba_status_notes: string | null;
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

// Worksite Card Component
function WorksiteCard({ site, employerId }: { site: EmployerSite; employerId: string }) {
  const router = useRouter();
  const { startNavigation } = useNavigationLoading();

  const handleClick = () => {
    // Navigate to project with mapping sheet tab focused
    const href = `/projects/${site.project_id}?tab=mappingsheets`;
    startNavigation(href);
    setTimeout(() => {
      router.push(href);
    }, 50);
  };

  const handleComplianceBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    // Navigate to project with audit & compliance tab focused
    const href = `/projects/${site.project_id}?tab=audit-compliance`;
    startNavigation(href);
    setTimeout(() => {
      router.push(href);
    }, 50);
  };

  return (
    <div
      onClick={handleClick}
      className="border rounded-lg px-4 py-3 cursor-pointer hover:bg-accent/50 hover:shadow-md transition-all duration-200 group"
    >
      <div className="space-y-2">
        {/* Header with project name and badges */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base truncate flex-1 group-hover:text-primary transition-colors">
            {site.project_name || site.name}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Compliance check badge - show tick if conducted, cross if not */}
            {site.compliance_check_conducted ? (
              <Badge 
                variant="outline" 
                className="bg-green-50 text-green-700 border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                onClick={handleComplianceBadgeClick}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Checked
              </Badge>
            ) : (
              <Badge 
                variant="outline" 
                className="bg-gray-50 text-gray-600 border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={handleComplianceBadgeClick}
              >
                <X className="h-3 w-3 mr-1" />
                Not checked
              </Badge>
            )}
            {/* Traffic light rating badge - only show if compliance check was conducted */}
            {site.compliance_check_conducted && site.compliance_rating && site.compliance_rating !== 'unknown' && (
              <div onClick={handleComplianceBadgeClick} className="cursor-pointer hover:opacity-80 transition-opacity">
                <TrafficLightRatingDisplay
                  rating={site.compliance_rating as 'green' | 'amber' | 'yellow' | 'red'}
                  size="sm"
                  className="flex-shrink-0"
                />
              </div>
            )}
          </div>
        </div>

        {/* Address (replaces old subheading) */}
        {site.address && (
          <div className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{site.address}</span>
          </div>
        )}

        {/* Patch and Organiser info */}
        {((site.patch_names?.length ?? 0) > 0 || (site.organiser_names?.length ?? 0) > 0) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1">
            {(site.patch_names?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                <span>{site.patch_names?.join(', ') ?? ''}</span>
              </div>
            )}
            {(site.organiser_names?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                <span>{site.organiser_names?.join(', ') ?? ''}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface EmployerDetailModalProps {
  employerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "overview" | "eba" | "sites" | "workers" | "categories" | "aliases" | "ratings";
  onEmployerUpdated?: () => void;
  mode?: 'active' | 'pending_review'; // NEW: Support pending review mode
  onPendingReviewClose?: () => void; // NEW: Called when closing from pending review
}

export const EmployerDetailModal = ({ 
  employerId, 
  isOpen, 
  onClose, 
  initialTab = "overview", 
  onEmployerUpdated,
  mode = 'active',
  onPendingReviewClose
}: EmployerDetailModalProps) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isEditing, setIsEditing] = useState(false);
  const [isManualWorkerOpen, setIsManualWorkerOpen] = useState(false);
  const [isImportingIncolink, setIsImportingIncolink] = useState(false);
  const [isFwcSearchOpen, setIsFwcSearchOpen] = useState(false);
  const [isIncolinkModalOpen, setIsIncolinkModalOpen] = useState(false);
  const [isAliasDialogOpen, setIsAliasDialogOpen] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [editingAlias, setEditingAlias] = useState<{id: string, alias: string} | null>(null);
  const queryClient = useQueryClient();
  const { loading: authLoading } = useAuth();
  const { role: currentUserRole } = useUserProfile();
  const { toast } = useToast();
  const modalInstanceId = useState(() => `empmodal-${Math.random().toString(36).slice(2, 8)}`)[0];
  
  const isPendingReview = mode === 'pending_review';

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen, employerId]);

  const canEdit = ["admin", "organiser", "lead_organiser", "delegate"].includes(currentUserRole || "");

  const { data: employer, isLoading, error: employerError, refetch: refetchEmployer } = useQuery({
    queryKey: ["employer-detail", employerId],
    queryFn: async () => {
      if (!employerId) {
        console.log('[EmployerDetailModal] No employerId provided, returning null');
        return null;
      }

      if (agentDebugEnabled()) {
        // #region agent log - employer detail query start
        fetch(AGENT_DEBUG_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,location:"src/components/employers/EmployerDetailModal.tsx:employer-detail:start",message:"employer_detail_query_start",data:{modalInstanceId,employerId,activeTab,isOpen,authLoading,currentUserRole},runId:AGENT_DEBUG_RUN_ID,hypothesisId:"H7",timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      
      const startTime = Date.now();
      console.log('[EmployerDetailModal] Fetching employer details', {
        employerId,
        timestamp: new Date().toISOString(),
      });
      
      const supabase = getSupabaseBrowserClient();
      try {
        const res = await withTimeout<any>(
          supabase
            .from("employers")
            .select(
              `
                id, name, abn, employer_type, address_line_1, address_line_2, suburb, state, postcode, phone, email, website, primary_contact_name, incolink_id, incolink_last_matched, estimated_worker_count,
                enterprise_agreement_status, eba_status_source, eba_status_updated_at, eba_status_notes,
              company_eba_records (*)
            `
            )
            .eq("id", employerId)
            .single(),
          QUERY_TIMEOUTS.COMPLEX,
          "fetch employer details"
        );
        if (res.error) {
          // Log and fall back to separate queries; some rows may fail due to relationship issues or RLS
          const errorDuration = Date.now() - startTime;
          console.error("[EmployerDetailModal] Employer relational fetch failed, falling back:", {
            employerId,
            error: res.error,
            errorCode: res.error.code,
            errorMessage: res.error.message,
            duration: errorDuration,
            timestamp: new Date().toISOString(),
          });

          // Base employer (no nested relations)
          const base = await withTimeout<any>(
            supabase
              .from("employers")
              .select(
                `
                id, name, abn, employer_type, address_line_1, address_line_2, suburb, state, postcode, phone, email, website, primary_contact_name, incolink_id, incolink_last_matched, estimated_worker_count,
                enterprise_agreement_status, eba_status_source, eba_status_updated_at, eba_status_notes
              `
              )
              .eq("id", employerId)
              .single(),
            QUERY_TIMEOUTS.MEDIUM,
            "fetch employer base"
          );
          if (base.error) throw base.error;

          // Company EBA records separately (best-effort)
          let ebaRecords: any[] = [];
          try {
            const eba = await withTimeout<any>(
              supabase
                .from("company_eba_records")
                .select(`
                  id,
                  contact_name,
                  contact_phone,
                  contact_email,
                  eba_file_number,
                  fwc_lodgement_number,
                  fwc_matter_number,
                  eba_lodged_fwc,
                  date_eba_signed,
                  fwc_certified_date,
                  fwc_document_url,
                  sector,
                  comments
                `)
                .eq("employer_id", employerId)
                .order("fwc_certified_date", { ascending: false }),
              QUERY_TIMEOUTS.MEDIUM,
              "fetch employer eba records"
            );
            if (!eba.error) {
              ebaRecords = Array.isArray(eba.data) ? eba.data : [];
            }
          } catch (e) {
            // Ignore EBA errors; not critical for base rendering
          }

          const fallbackDuration = Date.now() - startTime;
          console.log('[EmployerDetailModal] Fallback fetch completed', {
            employerId,
            duration: fallbackDuration,
            hasBaseData: !!base.data,
            ebaRecordsCount: ebaRecords.length,
          });
          return {
            ...base.data,
            company_eba_records: ebaRecords,
          } as EmployerWithEba;
        }
        const duration = Date.now() - startTime;
        console.log('[EmployerDetailModal] Employer details fetched successfully', {
          employerId,
          duration,
          hasEbaRecords: !!(res.data as any)?.company_eba_records?.length,
        });
        return res.data as EmployerWithEba;
      } catch (err: any) {
        const duration = Date.now() - startTime;
        console.error('[EmployerDetailModal] Exception fetching employer details:', {
          employerId,
          error: err,
          errorCode: err?.code,
          errorMessage: err instanceof Error ? err.message : String(err),
          duration,
          timestamp: new Date().toISOString(),
        });
        if (agentDebugEnabled()) {
          // #region agent log - employer detail query exception
          fetch(AGENT_DEBUG_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,location:"src/components/employers/EmployerDetailModal.tsx:employer-detail:error",message:"employer_detail_query_exception",data:{modalInstanceId,employerId,activeTab,isOpen,authLoading,currentUserRole,errorCode:err?.code??null,errorMessage:err instanceof Error?err.message:String(err),isTimeout:(err as any)?.code==="ETIMEDOUT"||String(err instanceof Error?err.message:err).includes("timed out")},runId:AGENT_DEBUG_RUN_ID,hypothesisId:"H7",timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }
        // Don't reset Supabase client on timeout - it destroys auth state
        throw err;
      }
    },
    onError: (error) => {
      console.error('[EmployerDetailModal] Query error:', {
        employerId,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    },
    enabled: !!employerId && isOpen && !authLoading,
    retry: 1,
  });

  const { data: workerCount } = useQuery({
    queryKey: ["employer-worker-count", employerId],
    queryFn: async () => {
      if (!employerId) return 0;
      const supabase = getSupabaseBrowserClient();
      if (agentDebugEnabled()) {
        // #region agent log - worker count query start
        fetch(AGENT_DEBUG_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,location:"src/components/employers/EmployerDetailModal.tsx:worker-count:start",message:"employer_worker_count_query_start",data:{modalInstanceId,employerId,activeTab,isOpen,authLoading},runId:AGENT_DEBUG_RUN_ID,hypothesisId:"H7",timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      try {
        const res = await withTimeout<any>(
          supabase.rpc("get_employer_worker_count", { p_employer_id: employerId }),
          15000,
          "fetch employer worker count"
        );
        if (res.error) {
          console.error("Error fetching worker count:", res.error);
          return 0;
        }
        return res.data ?? 0;
      } catch (err: any) {
        if (agentDebugEnabled()) {
          // #region agent log - worker count query exception
          fetch(AGENT_DEBUG_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,location:"src/components/employers/EmployerDetailModal.tsx:worker-count:error",message:"employer_worker_count_query_exception",data:{modalInstanceId,employerId,activeTab,isOpen,authLoading,errorCode:err?.code??null,errorMessage:err instanceof Error?err.message:String(err),isTimeout:(err as any)?.code==="ETIMEDOUT"||String(err instanceof Error?err.message:err).includes("timed out")},runId:AGENT_DEBUG_RUN_ID,hypothesisId:"H7",timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }
        // Don't reset Supabase client on timeout - it destroys auth state
        throw err;
      }
    },
    enabled: !!employerId && isOpen && !authLoading,
    retry: 1,
  });

  const invalidateEmployerData = useCallback(async () => {
    if (!employerId) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["employer-detail", employerId] }),
      queryClient.invalidateQueries({ queryKey: ["employer-worker-count", employerId] }),
      queryClient.invalidateQueries({ queryKey: ["employer-workers", employerId] }),
      queryClient.invalidateQueries({ queryKey: ["employer-aliases", employerId] }),
      queryClient.invalidateQueries({ queryKey: ["employers-server-side"] }),
      queryClient.invalidateQueries({ queryKey: ["employers-list"] }),
      queryClient.invalidateQueries({ queryKey: ["employers"] }),
    ]);
    onEmployerUpdated?.();
  }, [queryClient, employerId, onEmployerUpdated]);

  // Alias management functions
  const handleAddAlias = async () => {
    if (!newAlias.trim() || !employerId) return;

    try {
      const res = await fetch(`/api/employers/${employerId}/aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: newAlias.trim() }),
      });

      if (!res.ok) throw new Error(await res.text());

      setNewAlias("");
      setIsAliasDialogOpen(false);
      await refetchAliases();
      toast({
        title: "Alias added",
        description: `"${newAlias.trim()}" has been added as an alias.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add alias",
        variant: "destructive",
      });
    }
  };

  const handleEditAlias = async () => {
    if (!editingAlias || !employerId) return;

    try {
      const res = await fetch(`/api/employers/${employerId}/aliases/${editingAlias.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: editingAlias.alias.trim() }),
      });

      if (!res.ok) throw new Error(await res.text());

      setEditingAlias(null);
      setIsAliasDialogOpen(false);
      await refetchAliases();
      toast({
        title: "Alias updated",
        description: "The alias has been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update alias",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAlias = async (aliasId: string, aliasValue: string) => {
    if (!employerId) return;

    try {
      const res = await fetch(`/api/employers/${employerId}/aliases/${aliasId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error(await res.text());

      await refetchAliases();
      toast({
        title: "Alias deleted",
        description: `"${aliasValue}" has been removed from the aliases.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete alias",
        variant: "destructive",
      });
    }
  };

  const openAddAliasDialog = () => {
    setNewAlias("");
    setEditingAlias(null);
    setIsAliasDialogOpen(true);
  };

  const openEditAliasDialog = (alias: {id: string, alias: string}) => {
    setEditingAlias(alias);
    setNewAlias("");
    setIsAliasDialogOpen(true);
  };

  // Worksites for this employer, across all projects
  const { data: employerSites = [], isFetching: isFetchingSites } = useQuery({
    queryKey: ["employer-sites", employerId],
    enabled: !!employerId && isOpen && !authLoading,
    queryFn: async () => {
      if (!employerId) return [];
      const supabase = getSupabaseBrowserClient();
      if (agentDebugEnabled()) {
        // #region agent log - employer sites query start
        fetch(AGENT_DEBUG_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,location:"src/components/employers/EmployerDetailModal.tsx:sites:start",message:"employer_sites_query_start",data:{modalInstanceId,employerId,activeTab,isOpen,authLoading},runId:AGENT_DEBUG_RUN_ID,hypothesisId:"H7",timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      }
      try {
        const res = await withTimeout<any>(
          supabase.rpc("get_employer_sites", { p_employer_id: employerId }),
          20000,
          "fetch employer sites"
        );
        if (res.error) {
          console.error("Error fetching employer sites:", res.error);
          return [];
        }
        // Debug: Log the raw data to see what we're getting
        console.log("Employer sites data:", res.data);
        res.data?.forEach((site: any, idx: number) => {
          console.log(`Site ${idx}:`, {
            name: site.name,
            project_name: site.project_name,
            patch_names: site.patch_names,
            organiser_names: site.organiser_names,
            address: site.address,
          });
        });
        return res.data;
      } catch (err: any) {
        if (agentDebugEnabled()) {
          // #region agent log - employer sites query exception
          fetch(AGENT_DEBUG_INGEST_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:`log_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,location:"src/components/employers/EmployerDetailModal.tsx:sites:error",message:"employer_sites_query_exception",data:{modalInstanceId,employerId,activeTab,isOpen,authLoading,errorCode:err?.code??null,errorMessage:err instanceof Error?err.message:String(err),isTimeout:(err as any)?.code==="ETIMEDOUT"||String(err instanceof Error?err.message:err).includes("timed out")},runId:AGENT_DEBUG_RUN_ID,hypothesisId:"H7",timestamp:Date.now()})}).catch(()=>{});
          // #endregion
        }
        // Don't reset Supabase client on timeout - it destroys auth state
        throw err;
      }
    },
    retry: 1,
  });

  // Fetch employer aliases
  const { data: aliasesData = [], refetch: refetchAliases } = useQuery({
    queryKey: ["employer-aliases", employerId],
    enabled: !!employerId && isOpen && !authLoading,
    queryFn: async () => {
      if (!employerId) return [];
      try {
        const res = await fetch(`/api/employers/${employerId}/aliases`);
        if (!res.ok) throw new Error(await res.text());
        const json = await res.json();
        return json.data || [];
      } catch (err: any) {
        console.error("Error fetching employer aliases:", err);
        return [];
      }
    },
    retry: 1,
  });

  // Stabilize callbacks to prevent infinite re-renders
  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleEditSaved = useCallback(async (updated?: { id: string; name: string; employer_type: string }) => {
    try {
      setIsEditing(false);
      await invalidateEmployerData();
    } catch (error) {
      console.error('Error invalidating employer data after save:', error);
      // Still exit edit mode even if invalidation fails
      setIsEditing(false);
    }
  }, [invalidateEmployerData]);

  if (!isOpen) return null;

  const ebaStatus = employer?.company_eba_records?.[0] ? getEbaStatusInfo(employer.company_eba_records[0]) : null;
  const hasManualOverride = employer?.enterprise_agreement_status === true && employer?.eba_status_source === 'manual';

  const handleClose = () => {
    if (isPendingReview && onPendingReviewClose) {
      // Trigger final decision step instead of directly closing
      onPendingReviewClose();
    } else {
      onClose();
    }
  };

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      if (isEditing) {
        // If in edit mode, just exit edit mode, don't close the dialog
        setIsEditing(false);
      } else {
        handleClose();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogContent
        data-testid="employer-detail-modal"
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        aria-describedby="employer-dialog-description"
      >
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
            {employer && canEdit && !isPendingReview && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Pending Review Banner */}
        {isPendingReview && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900">Pending Employer Review</h4>
              <p className="text-sm text-blue-700">
                This employer is under review. You can edit all fields, run FWC/Incolink searches, and verify details before making a final decision.
              </p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center flex items-center justify-center gap-2"><img src="/spinner.gif" alt="Loading" className="h-4 w-4" /> Loading employer details...</div>
        ) : employerError ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-red-600">Failed to load employer details. {String((employerError as any)?.message || '')}</p>
            <div className="flex items-center justify-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => refetchEmployer()}>Try again</Button>
            </div>
          </div>
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
            <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as "overview" | "eba" | "sites" | "workers" | "categories" | "aliases" | "ratings")} className="space-y-6">
              {/* Mobile: Horizontally scrollable tabs */}
              <div className="w-full overflow-x-auto -mx-1 px-1 scrollbar-hide">
                <TabsList className="inline-flex h-auto min-w-max gap-1 p-1 bg-muted rounded-lg">
                  <TabsTrigger 
                    value="overview" 
                    className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[36px] sm:min-h-[40px]"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger 
                    value="eba" 
                    className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[36px] sm:min-h-[40px]"
                  >
                    <span className="sm:hidden">EBA</span>
                    <span className="hidden sm:inline">EBA Details</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="categories" 
                    className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[36px] sm:min-h-[40px]"
                  >
                    <span className="sm:hidden">Cats</span>
                    <span className="hidden sm:inline">Categories</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="sites" 
                    className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[36px] sm:min-h-[40px]"
                  >
                    <span className="sm:hidden">Sites</span>
                    <span className="hidden sm:inline">Worksites</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="workers" 
                    className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[36px] sm:min-h-[40px]"
                  >
                    Workers
                  </TabsTrigger>
                  <TabsTrigger 
                    value="aliases" 
                    className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[36px] sm:min-h-[40px]"
                  >
                    Aliases
                  </TabsTrigger>
                  <TabsTrigger 
                    value="ratings" 
                    className="px-3 py-2 text-xs sm:text-sm whitespace-nowrap min-h-[36px] sm:min-h-[40px]"
                  >
                    <span className="sm:hidden">Rating</span>
                    <span className="hidden sm:inline">Traffic Light</span>
                  </TabsTrigger>
                </TabsList>
              </div>

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
                        <p className="capitalize">{employer.employer_type ? employer.employer_type.replace(/_/g, " ") : "—"}</p>
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

                {hasManualOverride && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Badge variant="outline">Manual Override</Badge>
                        EBA Status
                      </CardTitle>
                      <CardDescription>
                        This employer was manually marked as having an active EBA. Downgrading will require confirmation and a note.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {employer.eba_status_notes && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Override Notes</label>
                          <p className="text-sm bg-muted p-3 rounded-md">{employer.eba_status_notes}</p>
                        </div>
                      )}
                      {employer.eba_status_updated_at && (
                        <div className="text-xs text-muted-foreground">
                          Last updated {new Date(employer.eba_status_updated_at).toLocaleString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {hasManualOverride && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Badge variant="outline">Manual Override</Badge>
                        EBA Status
                      </CardTitle>
                      <CardDescription>
                        This employer was manually marked as having an active EBA. Downgrading will require confirmation and notes.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {employer.eba_status_notes && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">Override Notes</label>
                          <p className="text-sm bg-muted p-3 rounded-md">{employer.eba_status_notes}</p>
                        </div>
                      )}
                      {employer.eba_status_updated_at && (
                        <div className="text-xs text-muted-foreground">
                          Last updated {new Date(employer.eba_status_updated_at).toLocaleString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

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

              <TabsContent value="categories" className="space-y-4">
                {employer && (
                  <EmployerCategoriesEditor employerId={employer.id} />
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {employerSites.map((s: EmployerSite) => (
                          <WorksiteCard key={s.id} site={s} employerId={employerId || ''} />
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
              setIsImportingIncolink(true)
              try {
                const res = await fetch('/api/scraper-jobs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jobType: 'incolink_sync',
                    payload: {
                      employerIds: [employerId],
                    },
                    priority: 5,
                    progressTotal: 1,
                  }),
                })

                if (!res.ok) {
                  throw new Error(await res.text())
                }

                toast({
                  title: 'Import queued',
                  description: 'Background import will refresh worker data shortly.',
                })
                await invalidateEmployerData()
              } catch (e) {
                toast({
                  title: 'Import failed',
                  description: e instanceof Error ? e.message : 'Failed to queue Incolink import.',
                  variant: 'destructive',
                })
              } finally {
                setIsImportingIncolink(false)
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
        onSuccess={async () => {
          setIsManualWorkerOpen(false);
          await invalidateEmployerData();
        }}
      />
    </DialogContent>
  </Dialog>
 </TabsContent>

              <TabsContent value="aliases" className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="h-5 w-5" />
                        <CardTitle>Employer Aliases</CardTitle>
                      </div>
                      {canEdit && (
                        <Button size="sm" onClick={openAddAliasDialog}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Alias
                        </Button>
                      )}
                    </div>
                    <CardDescription>
                      Alternative names or abbreviations used to identify this employer (e.g., "ESS" for "Erect Safe Scaffolding").
                      These aliases help with employer matching and search functionality.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {aliasesData.length > 0 ? (
                      <div className="space-y-3">
                        {aliasesData.map((alias: any) => (
                          <div key={alias.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <Badge variant="secondary" className="text-sm">
                                {alias.alias}
                              </Badge>
                              {alias.created_at && (
                                <span className="text-xs text-muted-foreground">
                                  Added {new Date(alias.created_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditAliasDialog(alias)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleDeleteAlias(alias.id, alias.alias)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Tag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Aliases</h3>
                        <p className="text-muted-foreground mb-4">
                          This employer doesn't have any aliases yet. Aliases help with matching employer names in different formats.
                        </p>
                        {canEdit && (
                          <Button size="sm" onClick={openAddAliasDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add First Alias
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ratings" className="space-y-4">
                {employer && (
                  <TrafficLightRatingTab
                    employerId={employer.id}
                    employerName={employer.name}
                  />
                )}
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
                    await invalidateEmployerData();
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
                  onUpdate={invalidateEmployerData}
                />
              )}

              {/* Alias Management Dialog */}
              <Dialog open={isAliasDialogOpen} onOpenChange={setIsAliasDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {editingAlias ? "Edit Alias" : "Add New Alias"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingAlias
                        ? "Update the employer alias name."
                        : "Add an alternative name or abbreviation for this employer."
                      }
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="alias">Alias Name</Label>
                      <Input
                        id="alias"
                        value={editingAlias ? editingAlias.alias : newAlias}
                        onChange={(e) => editingAlias
                          ? setEditingAlias({...editingAlias, alias: e.target.value})
                          : setNewAlias(e.target.value)
                        }
                        placeholder="e.g., ESS, Erect Safe Scaffolding"
                        maxLength={100}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAliasDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={editingAlias ? handleEditAlias : handleAddAlias}
                      disabled={!editingAlias ? !newAlias.trim() : !editingAlias.alias.trim()}
                    >
                      {editingAlias ? "Update Alias" : "Add Alias"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
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
