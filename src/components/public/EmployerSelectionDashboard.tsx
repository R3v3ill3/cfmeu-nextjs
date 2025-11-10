/**
 * Employer Selection Dashboard for Multi-Employer Audit Forms
 * 
 * Shows all employers with status indicators, search, and filters
 */

import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Clock, CheckCircle } from "lucide-react";
import { EmployerStatusCard } from "./EmployerStatusCard";
import { AuditFormProgressBar } from "./AuditFormProgressBar";
import { EmployerSubmissionStatus } from "@/hooks/useAuditFormProgress";
import { hasDraft } from "@/lib/auditFormDraftManager";

interface Employer {
  id: string;
  name: string;
  roleOrTrade?: string;
}

interface EmployerSelectionDashboardProps {
  token: string;
  employers: Employer[];
  submittedEmployers: string[];
  inProgressEmployers: Set<string>;
  onSelectEmployer: (employerId: string) => void;
  onFinalize: () => void;
  draftCount: number;
}

type FilterOption = 'all' | 'pending' | 'in_progress' | 'completed';

export function EmployerSelectionDashboard({
  token,
  employers,
  submittedEmployers,
  inProgressEmployers,
  onSelectEmployer,
  onFinalize,
  draftCount,
}: EmployerSelectionDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterOption>('all');

  // Get status for an employer
  const getEmployerStatus = (employerId: string): EmployerSubmissionStatus => {
    if (submittedEmployers.includes(employerId)) {
      return 'completed';
    }
    if (inProgressEmployers.has(employerId) || hasDraft(token, employerId)) {
      return 'in_progress';
    }
    return 'not_started';
  };

  // Filter and search employers
  const filteredEmployers = useMemo(() => {
    return employers.filter(employer => {
      // Search filter
      const matchesSearch = employer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           employer.roleOrTrade?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;

      // Status filter
      const status = getEmployerStatus(employer.id);
      
      switch (filterStatus) {
        case 'pending':
          return status === 'not_started';
        case 'in_progress':
          return status === 'in_progress';
        case 'completed':
          return status === 'completed';
        default:
          return true;
      }
    });
  }, [employers, searchTerm, filterStatus, submittedEmployers, inProgressEmployers, token]);

  // Calculate stats
  const completedCount = submittedEmployers.length;
  const inProgressCount = Array.from(inProgressEmployers).filter(
    id => !submittedEmployers.includes(id)
  ).length;
  const notStartedCount = employers.length - completedCount - inProgressCount;
  const allComplete = completedCount === employers.length && employers.length > 0;

  return (
    <div className="space-y-6">
      {/* Progress Section */}
      <Card>
        <CardContent className="pt-6">
          <AuditFormProgressBar
            completedCount={completedCount}
            totalCount={employers.length}
            draftCount={draftCount}
            showDetails
          />
        </CardContent>
      </Card>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
          <Input
            placeholder="Search employers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 max-lg:pl-10 max-lg:pr-4"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('all')}
            className="whitespace-nowrap flex-shrink-0 h-9 px-3 text-xs sm:text-sm"
          >
            All ({employers.length})
          </Button>
          <Button
            variant={filterStatus === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('pending')}
            className="whitespace-nowrap flex-shrink-0 h-9 px-3 text-xs sm:text-sm"
          >
            <Filter className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Pending</span> ({notStartedCount})
          </Button>
          <Button
            variant={filterStatus === 'in_progress' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('in_progress')}
            className="whitespace-nowrap flex-shrink-0 h-9 px-3 text-xs sm:text-sm"
          >
            <Clock className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">In Progress</span> ({inProgressCount})
          </Button>
          <Button
            variant={filterStatus === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus('completed')}
            className="whitespace-nowrap flex-shrink-0 h-9 px-3 text-xs sm:text-sm"
          >
            <CheckCircle className="h-3 w-3 sm:mr-1" />
            <span className="hidden sm:inline">Completed</span> ({completedCount})
          </Button>
        </div>
      </div>

      {/* Employer Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEmployers.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center text-muted-foreground">
              {searchTerm ? 'No employers match your search' : 'No employers found'}
            </CardContent>
          </Card>
        ) : (
          filteredEmployers.map(employer => (
            <EmployerStatusCard
              key={employer.id}
              employer={employer}
              status={getEmployerStatus(employer.id)}
              hasDraft={hasDraft(token, employer.id)}
              onClick={() => onSelectEmployer(employer.id)}
            />
          ))
        )}
      </div>

      {/* Final Submit Button */}
      {allComplete && (
        <Card className="border-green-500 bg-green-50">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <CheckCircle className="h-6 w-6" />
                  <h3 className="text-lg font-semibold">All Employers Assessed!</h3>
                </div>
                <p className="text-sm text-green-600">
                  You've completed assessments for all {employers.length} employers. 
                  Click below to finalize and close this audit form.
                </p>
              </div>
              <Button 
                onClick={onFinalize}
                size="lg"
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
              >
                Finish & Close Form
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

