"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Building, Hammer, Users, Truck, Phone, Mail, ExternalLink, Upload, Award, TrendingUp, FileText, Calendar, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getEbaStatusInfo } from "./ebaHelpers";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EbaAssignmentModal } from "./EbaAssignmentModal";
import { getProgressIndicatorClass } from "@/utils/densityColors";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { WorkerForm } from "@/components/workers/WorkerForm";

type EmployerWithEba = {
  id: string;
  name: string;
  abn: string | null;
  employer_type: string;
  enterprise_agreement_status: boolean | null;
  estimated_worker_count?: number;
  company_eba_records: {
    id: string;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    eba_file_number: string | null;
    fwc_document_url: string | null;
    eba_lodged_fwc: string | null;
    date_eba_signed: string | null;
    fwc_certified_date: string | null;
    nominal_expiry_date: string | null;
    sector: string | null;
  }[];
};

interface EmployerAnalytics {
  employer_id: string;
  employer_name: string;
  estimated_worker_count: number;
  current_worker_count: number;
  member_count: number;
  workers_with_job_site: number;
  workers_without_job_site: number;
  member_density_percent: number;
  estimated_density_percent: number;
}

interface EmployerCardProps {
  employer: EmployerWithEba;
  onClick: () => void;
}

export const EmployerCard = ({ employer, onClick }: EmployerCardProps) => {
  const router = useRouter();
  const [showEbaModal, setShowEbaModal] = useState(false);
  const [isManualWorkerOpen, setIsManualWorkerOpen] = useState(false);

  // Fetch employer analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['employer-analytics', employer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employer_analytics')
        .select('*')
        .eq('employer_id', employer.id)
        .maybeSingle();
      
        if (error) throw error;
      return data as EmployerAnalytics | null;
    },
  });

  const getEmployerTypeIcon = (type: string) => {
    switch (type) {
      case "builder": return <Hammer className="h-4 w-4" />;
      case "principal_contractor": return <Building className="h-4 w-4" />;
      case "large_contractor": return <Users className="h-4 w-4" />;
      case "small_contractor": return <Users className="h-4 w-4" />;
      case "individual": return <Truck className="h-4 w-4" />;
      default: return <Building className="h-4 w-4" />;
    }
  };

  const getEmployerTypeBadge = (type: string) => {
    const variants = {
      builder: "default",
      principal_contractor: "secondary", 
      large_contractor: "outline",
      small_contractor: "outline",
      individual: "destructive",
    } as const;

    const labels = {
      builder: "Builder",
      principal_contractor: "Principal Contractor",
      large_contractor: "Large Contractor", 
      small_contractor: "Small Contractor",
      individual: "Individual",
    };
    
    return (
      <Badge variant={variants[type as keyof typeof variants] || "secondary"}>
        {labels[type as keyof typeof labels] || type}
      </Badge>
    );
  };

  const ebaStatus = employer.company_eba_records?.[0] ? getEbaStatusInfo(employer.company_eba_records[0]) : null;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            {getEmployerTypeIcon(employer.employer_type)}
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg truncate">{employer.name}</CardTitle>
              {employer.abn && (
                <CardDescription className="text-sm">
                  ABN: {employer.abn}
                </CardDescription>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-0 space-y-3">
        <div className="flex items-center justify-between">
          {getEmployerTypeBadge(employer.employer_type)}
          {ebaStatus && (
            <Badge 
              variant={ebaStatus.variant} 
              className={`text-xs ${ebaStatus.status === 'expired' ? 'bg-destructive text-destructive-foreground animate-pulse font-bold' : ''}`}
            >
              {ebaStatus.status === 'expired' && <AlertTriangle className="h-3 w-3 mr-1" />}
              {ebaStatus.label}
            </Badge>
          )}
        </div>

        {/* Analytics Section */}
        {analytics && !analyticsLoading && (
          <div className="space-y-3 p-3 bg-secondary/20 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp size={14} />
              <span>Worker Analytics</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Users size={12} className="text-muted-foreground" />
                <span className="text-muted-foreground">Workers:</span>
                <Badge variant="secondary" className="text-xs">
                  {analytics.current_worker_count}
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <Award size={12} className="text-muted-foreground" />
                <span className="text-muted-foreground">Members:</span>
                <Badge variant="default" className="text-xs">
                  {analytics.member_count}
                </Badge>
              </div>
            </div>

            {analytics.current_worker_count > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Member Density</span>
                  <span>{analytics.member_density_percent}%</span>
                </div>
                <Progress value={analytics.member_density_percent} className="h-2" indicatorClassName={getProgressIndicatorClass(analytics.member_density_percent)} />
              </div>
            )}

            {analytics.estimated_worker_count > 0 && analytics.estimated_worker_count !== analytics.current_worker_count && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Est. Density ({analytics.estimated_worker_count} total)</span>
                  <span>{analytics.estimated_density_percent}%</span>
                </div>
                <Progress value={analytics.estimated_worker_count} className="h-2" indicatorClassName={getProgressIndicatorClass(analytics.estimated_density_percent)} />
              </div>
            )}

            {analytics.workers_without_job_site > 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400">
                {analytics.workers_without_job_site} worker(s) unassigned to job sites
              </div>
            )}
          </div>
        )}

        {employer.company_eba_records?.[0] && (
          <div className="space-y-2">
            {employer.company_eba_records[0].eba_file_number && (
              <div className="text-xs text-muted-foreground">
                EBA: {employer.company_eba_records[0].eba_file_number}
              </div>
            )}
            
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {employer.company_eba_records[0].contact_phone && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span className="truncate">{employer.company_eba_records[0].contact_phone}</span>
                </div>
              )}
              
              {employer.company_eba_records[0].contact_email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{employer.company_eba_records[0].contact_email}</span>
                </div>
              )}
            </div>
            
            {employer.company_eba_records[0].nominal_expiry_date && (
              <div className="text-xs">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span className={new Date(employer.company_eba_records[0].nominal_expiry_date) < new Date() ? "text-destructive font-medium" : "text-muted-foreground"}>
                    Expires: {new Date(employer.company_eba_records[0].nominal_expiry_date).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {employer.company_eba_records[0].fwc_document_url && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(employer.company_eba_records![0].fwc_document_url!, '_blank');
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View Document
                </Button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="flex-1 text-xs"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Upload Workers
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={() => setIsManualWorkerOpen(true)}>
                    Manually enter worker details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/upload?employerId=${employer.id}&employerName=${encodeURIComponent(employer.name)}`)}>
                    Upload list
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
        
        {!employer.company_eba_records?.[0] && (
          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-xs"
              onClick={(e) => {
                e.stopPropagation();
                setShowEbaModal(true);
              }}
            >
              <FileText className="h-3 w-3 mr-1" />
              Add EBA
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Upload Workers
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => setIsManualWorkerOpen(true)}>
                  Manually enter worker details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push(`/upload?employerId=${employer.id}&employerName=${encodeURIComponent(employer.name)}`)}>
                  Upload list
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </CardContent>
      
      <EbaAssignmentModal 
        isOpen={showEbaModal}
        onClose={() => setShowEbaModal(false)}
        employer={{ id: employer.id, name: employer.name }}
      />
      <Dialog open={isManualWorkerOpen} onOpenChange={setIsManualWorkerOpen}>
        <DialogContent className="max-w-2xl" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
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
    </Card>
  );
};