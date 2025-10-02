"use client"

import { useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Search, AlertCircle, CheckCircle, Clock, Filter } from "lucide-react";
import { useEmployerCompliance } from "./hooks/useEmployerCompliance";
import { useMappingSheetData } from "@/hooks/useMappingSheetData";
import { EmployerComplianceDetail } from "./EmployerComplianceDetail";
import { format } from "date-fns";
import { EmployerComplianceCheck } from "@/types/compliance";

// Define key contractor trades for filtering
const KEY_CONTRACTOR_TRADES = new Set([
  'demolition',
  'piling',
  'concrete',
  'concreting',
  'scaffolding',
  'scaffold',
  'form_work',
  'formwork',
  'tower_crane',
  'mobile_crane',
  'crane',
  'labour_hire',
  'earthworks',
  'traffic_control'
]);

interface EmployerComplianceTableProps {
  projectId: string;
}

interface UnifiedEmployer {
  employerId: string;
  employerName: string;
  roleOrTrade: string;
  hasEba: boolean;
  isKeyContractor: boolean;
}

export function EmployerComplianceTable({ projectId }: EmployerComplianceTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployerIds, setSelectedEmployerIds] = useState<string[]>([]);
  const [expandedEmployerId, setExpandedEmployerId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'compliant' | 'non-compliant' | 'pending'>('all');
  const [showKeyContractorsOnly, setShowKeyContractorsOnly] = useState(true);

  const { data: compliance = [] } = useEmployerCompliance(projectId);
  const { data: mappingData, isLoading } = useMappingSheetData(projectId);

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
  }, [mappingData]);

  // Create a map of compliance by employer ID for quick lookup
  const complianceMap = new Map<string, EmployerComplianceCheck>();
  compliance.forEach(c => {
    if (c.employer_id) complianceMap.set(c.employer_id, c);
  });

  // Filter contractors based on search, compliance status, and key contractor filter
  const filteredContractors = contractors.filter(contractor => {
    // Apply key contractor filter if enabled
    if (showKeyContractorsOnly && !contractor.isKeyContractor) {
      return false;
    }
    
    const matchesSearch = contractor.employerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    const employerCompliance = complianceMap.get(contractor.employerId);
    
    switch (filterStatus) {
      case 'compliant':
        return employerCompliance && 
               (employerCompliance.cbus_check_conducted || employerCompliance.incolink_check_conducted) &&
               !employerCompliance.cbus_enforcement_flag && 
               !employerCompliance.incolink_enforcement_flag;
      case 'non-compliant':
        return employerCompliance && 
               (employerCompliance.cbus_enforcement_flag || employerCompliance.incolink_enforcement_flag);
      case 'pending':
        return !employerCompliance || 
               (!employerCompliance.cbus_check_conducted && !employerCompliance.incolink_check_conducted);
      default:
        return true;
    }
  });

  const getComplianceStatus = (employerId: string) => {
    const comp = complianceMap.get(employerId);
    if (!comp) return { status: 'pending', label: 'Not Checked', variant: 'secondary' as const };
    
    if (comp.cbus_enforcement_flag || comp.incolink_enforcement_flag) {
      return { status: 'non-compliant', label: 'Non-Compliant', variant: 'destructive' as const };
    }
    
    if (comp.cbus_followup_required || comp.incolink_followup_required) {
      return { status: 'followup', label: 'Follow-up Required', variant: 'outline' as const };
    }
    
    if (comp.cbus_check_conducted || comp.incolink_check_conducted) {
      return { status: 'compliant', label: 'Checked', variant: 'default' as const };
    }
    
    return { status: 'pending', label: 'Not Checked', variant: 'secondary' as const };
  };

  const getLastCheckDate = (comp: EmployerComplianceCheck | undefined) => {
    if (!comp) return null;
    
    const dates = [comp.cbus_check_date, comp.incolink_check_date].filter(Boolean);
    if (dates.length === 0) return null;
    
    const latestDate = dates.sort().reverse()[0];
    return latestDate ? format(new Date(latestDate), 'dd/MM/yyyy') : null;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedEmployerIds(filteredContractors.map(c => c.employerId));
    } else {
      setSelectedEmployerIds([]);
    }
  };

  const handleSelectEmployer = (employerId: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployerIds([...selectedEmployerIds, employerId]);
    } else {
      setSelectedEmployerIds(selectedEmployerIds.filter(id => id !== employerId));
    }
  };

  const toggleExpanded = (employerId: string) => {
    setExpandedEmployerId(expandedEmployerId === employerId ? null : employerId);
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search employers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={filterStatus === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('all')}
            >
              All ({contractors.length})
            </Button>
            <Button
              variant={filterStatus === 'compliant' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('compliant')}
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Compliant
            </Button>
            <Button
              variant={filterStatus === 'non-compliant' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('non-compliant')}
            >
              <AlertCircle className="h-4 w-4 mr-1" />
              Issues
            </Button>
            <Button
              variant={filterStatus === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterStatus('pending')}
            >
              <Clock className="h-4 w-4 mr-1" />
              Pending
            </Button>
          </div>
        </div>
        
        {/* Key Contractors Filter */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="key-contractors"
            checked={showKeyContractorsOnly}
            onCheckedChange={setShowKeyContractorsOnly as any}
          />
          <label
            htmlFor="key-contractors"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            Show key contractors only
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedEmployerIds.length === filteredContractors.length && filteredContractors.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead>Employer</TableHead>
              <TableHead>Role/Trade</TableHead>
              <TableHead>EBA Status</TableHead>
              <TableHead>CBUS</TableHead>
              <TableHead>INCOLINK</TableHead>
              <TableHead>Last Check</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContractors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  No employers found
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredContractors.map((contractor) => {
                  const comp = complianceMap.get(contractor.employerId);
                  const status = getComplianceStatus(contractor.employerId);
                  const lastCheck = getLastCheckDate(comp);
                  const isExpanded = expandedEmployerId === contractor.employerId;

                  return (
                    <>
                      <TableRow key={contractor.employerId} className="cursor-pointer hover:bg-muted/50">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedEmployerIds.includes(contractor.employerId)}
                            onCheckedChange={(checked) => handleSelectEmployer(contractor.employerId, !!checked)}
                          />
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(contractor.employerId)}>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(contractor.employerId)}>
                          <div className="font-medium">{contractor.employerName}</div>
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(contractor.employerId)}>
                          {contractor.roleOrTrade}
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(contractor.employerId)}>
                          <Badge variant={contractor.hasEba ? 'default' : 'secondary'}>
                            {contractor.hasEba ? 'Active' : 'No EBA'}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(contractor.employerId)}>
                          {comp?.cbus_check_conducted ? (
                            <Badge variant={comp.cbus_payment_status === 'correct' ? 'default' : 'destructive'}>
                              {comp.cbus_payment_status || 'Checked'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(contractor.employerId)}>
                          {comp?.incolink_check_conducted ? (
                            <Badge variant={comp.incolink_payment_status === 'correct' ? 'default' : 'destructive'}>
                              {comp.incolink_payment_status || 'Checked'}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(contractor.employerId)}>
                          {lastCheck || '—'}
                        </TableCell>
                        <TableCell onClick={() => toggleExpanded(contractor.employerId)}>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={9} className="p-0">
                            <div className="p-4 bg-muted/20">
                              <EmployerComplianceDetail
                                projectId={projectId}
                                employerId={contractor.employerId}
                                employerName={contractor.employerName}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary */}
      {selectedEmployerIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <p className="text-sm">
            {selectedEmployerIds.length} employer{selectedEmployerIds.length > 1 ? 's' : ''} selected
          </p>
          <Button variant="outline" size="sm" onClick={() => setSelectedEmployerIds([])}>
            Clear Selection
          </Button>
        </div>
      )}
    </div>
  );
}
