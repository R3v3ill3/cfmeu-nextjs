"use client"

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ChevronRight, Search, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useEmployerCompliance } from "./hooks/useEmployerCompliance";
import { useMappingSheetData } from "@/hooks/useMappingSheetData";
import { EmployerComplianceDetailMobile } from "./EmployerComplianceDetailMobile";
import { format } from "date-fns";
import { EmployerComplianceCheck } from "@/types/compliance";
import { useKeyContractorTradesSet } from "@/hooks/useKeyContractorTrades";

interface EmployerComplianceMobileProps {
  projectId: string;
}

interface UnifiedEmployer {
  employerId: string;
  employerName: string;
  roleOrTrade: string;
  hasEba: boolean;
  isKeyContractor: boolean;
}

export function EmployerComplianceMobile({ projectId }: EmployerComplianceMobileProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'checked' | 'pending' | 'issues'>('all');

  const { data: compliance = [] } = useEmployerCompliance(projectId);
  const { data: mappingData, isLoading } = useMappingSheetData(projectId);
  
  // Fetch key trades dynamically from database (replaces hard-coded list)
  const { tradeSet: KEY_CONTRACTOR_TRADES } = useKeyContractorTradesSet();

  // Combine all contractors from mapping data into a unified list
  const contractors = useMemo(() => {
    if (!mappingData) return [];
    
    const employerMap = new Map<string, UnifiedEmployer>();
    
    // Add contractor roles
    mappingData.contractorRoles.forEach(role => {
      const existing = employerMap.get(role.employerId);
      if (!existing || role.role === 'builder' || role.role === 'head_contractor') {
        employerMap.set(role.employerId, {
          employerId: role.employerId,
          employerName: role.employerName,
          roleOrTrade: role.roleLabel,
          hasEba: role.ebaStatus || false,
          isKeyContractor: role.role === 'builder' || role.role === 'head_contractor'
        });
      }
    });
    
    // Add trade contractors
    mappingData.tradeContractors.forEach(trade => {
      if (!employerMap.has(trade.employerId)) {
        employerMap.set(trade.employerId, {
          employerId: trade.employerId,
          employerName: trade.employerName,
          roleOrTrade: trade.tradeLabel,
          hasEba: trade.ebaStatus || false,
          isKeyContractor: KEY_CONTRACTOR_TRADES.has(trade.tradeType)
        });
      }
    });
    
    return Array.from(employerMap.values());
  }, [mappingData, KEY_CONTRACTOR_TRADES]);

  // Create compliance map
  const complianceMap = new Map<string, EmployerComplianceCheck>();
  compliance.forEach(c => {
    if (c.employer_id) complianceMap.set(c.employer_id, c);
  });

  // Filter contractors
  const filteredContractors = contractors.filter(contractor => {
    const matchesSearch = contractor.employerName.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    const comp = complianceMap.get(contractor.employerId);
    
    switch (filterStatus) {
      case 'checked':
        return comp && (comp.cbus_check_conducted || comp.incolink_check_conducted);
      case 'issues':
        return comp && (comp.cbus_enforcement_flag || comp.incolink_enforcement_flag);
      case 'pending':
        return !comp || (!comp.cbus_check_conducted && !comp.incolink_check_conducted);
      default:
        return true;
    }
  });

  const getStatusIcon = (comp: EmployerComplianceCheck | undefined) => {
    if (!comp || (!comp.cbus_check_conducted && !comp.incolink_check_conducted)) {
      return <Clock className="h-4 w-4 text-gray-400" />;
    }
    if (comp.cbus_enforcement_flag || comp.incolink_enforcement_flag) {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };

  const getLastCheckDate = (comp: EmployerComplianceCheck | undefined) => {
    if (!comp) return null;
    const dates = [comp.cbus_check_date, comp.incolink_check_date].filter(Boolean);
    if (dates.length === 0) return null;
    const latestDate = dates.sort().reverse()[0];
    return latestDate ? format(new Date(latestDate), 'dd/MM/yy') : null;
  };

  // Show detail view if employer selected
  if (selectedEmployerId) {
    const employer = contractors.find(c => c.employerId === selectedEmployerId);
    if (employer) {
      return (
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedEmployerId(null)}
            className="mb-2"
          >
            ← Back to list
          </Button>
          <EmployerComplianceDetailMobile
            projectId={projectId}
            employerId={selectedEmployerId}
            employerName={employer.employerName}
          />
        </div>
      );
    }
  }

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading employer data...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={filterStatus === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('all')}
          className="whitespace-nowrap h-11"
        >
          All ({contractors.length})
        </Button>
        <Button
          variant={filterStatus === 'checked' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('checked')}
          className="whitespace-nowrap h-11"
        >
          Checked
        </Button>
        <Button
          variant={filterStatus === 'issues' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('issues')}
          className="whitespace-nowrap h-11"
        >
          Issues
        </Button>
        <Button
          variant={filterStatus === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilterStatus('pending')}
          className="whitespace-nowrap h-11"
        >
          Pending
        </Button>
      </div>

      {/* Employer List */}
      <div className="space-y-2">
        {filteredContractors.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No employers found
            </CardContent>
          </Card>
        ) : (
          filteredContractors.map(contractor => {
            const comp = complianceMap.get(contractor.employerId);
            const lastCheck = getLastCheckDate(comp);

            return (
              <Card
                key={contractor.employerId}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setSelectedEmployerId(contractor.employerId)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-1">
                      <div className="font-medium">{contractor.employerName}</div>
                      <div className="text-sm text-muted-foreground">
                        {contractor.roleOrTrade}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant={contractor.hasEba ? 'default' : 'secondary'} className="text-xs">
                          {contractor.hasEba ? 'EBA' : 'No EBA'}
                        </Badge>
                        {lastCheck && (
                          <span className="text-muted-foreground">
                            Last: {lastCheck}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(comp)}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
