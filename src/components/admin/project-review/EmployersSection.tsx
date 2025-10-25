'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, Wrench, UserCheck, ExternalLink, Edit, Trash } from 'lucide-react';
import type { ProjectAssignmentDetails } from '@/types/pendingProjectReview';
import Link from 'next/link';

interface EmployersSectionProps {
  assignments: ProjectAssignmentDetails[];
  onEdit?: (assignment: ProjectAssignmentDetails) => void;
  onDelete?: (assignmentId: string) => void;
  onAdd?: () => void;
  readOnly?: boolean;
}

export function EmployersSection({
  assignments,
  onEdit,
  onDelete,
  onAdd,
  readOnly = false,
}: EmployersSectionProps) {
  const builders = assignments?.filter((a) => a.assignment_type === 'builder') || [];
  const subcontractors = assignments?.filter((a) => a.assignment_type === 'subcontractor') || [];
  const others = assignments?.filter((a) => a.assignment_type === 'other') || [];

  const renderEmployerBadge = (employer: any) => {
    if (!employer) return null;

    if (employer.approval_status === 'pending') {
      return <Badge variant="secondary">Pending Approval</Badge>;
    }

    if (employer.enterprise_agreement_status) {
      return (
        <Badge variant="default" className="bg-green-600 flex items-center gap-1">
          <UserCheck className="h-3 w-3" />
          EBA Active
        </Badge>
      );
    }

    return null;
  };

  const renderAssignmentRow = (assignment: ProjectAssignmentDetails) => (
    <TableRow key={assignment.id}>
      <TableCell>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {assignment.employer?.name || 'Unknown Employer'}
            </span>
            {renderEmployerBadge(assignment.employer)}
          </div>
          {assignment.employer?.employer_type && (
            <div className="text-xs text-muted-foreground">
              {assignment.employer.employer_type.replace(/_/g, ' ')}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="capitalize">
          {assignment.assignment_type}
        </Badge>
      </TableCell>
      <TableCell>
        {assignment.contractor_role?.name || assignment.trade_type?.name ? (
          <div className="space-y-1">
            {assignment.contractor_role && (
              <Badge variant="secondary" className="mr-1">
                {assignment.contractor_role.name}
              </Badge>
            )}
            {assignment.trade_type && (
              <Badge variant="outline" className="flex items-center gap-1 w-fit">
                <Wrench className="h-3 w-3" />
                {assignment.trade_type.name}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </TableCell>
      <TableCell>
        {assignment.source ? (
          <Badge variant="secondary" className="text-xs">
            {assignment.source}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">Unknown</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {assignment.employer?.id && assignment.employer.approval_status === 'active' && (
            <Link href={`/employers/${assignment.employer.id}`} target="_blank">
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          )}
          {!readOnly && onEdit && (
            <Button variant="ghost" size="sm" onClick={() => onEdit(assignment)}>
              <Edit className="h-3 w-3" />
            </Button>
          )}
          {!readOnly && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(assignment.id)}
            >
              <Trash className="h-3 w-3 text-destructive" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );

  if (!assignments || assignments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Employers & Subcontractors</CardTitle>
            {!readOnly && onAdd && (
              <Button variant="outline" size="sm" onClick={onAdd}>
                Add Assignment
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No employer assignments have been added to this project
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">
              Employers & Subcontractors ({assignments.length})
            </CardTitle>
          </div>
          {!readOnly && onAdd && (
            <Button variant="outline" size="sm" onClick={onAdd}>
              Add Assignment
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {builders.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Builders ({builders.length})
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Role/Trade</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{builders.map(renderAssignmentRow)}</TableBody>
            </Table>
          </div>
        )}

        {subcontractors.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Subcontractors ({subcontractors.length})
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Role/Trade</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{subcontractors.map(renderAssignmentRow)}</TableBody>
            </Table>
          </div>
        )}

        {others.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3">Other ({others.length})</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Role/Trade</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{others.map(renderAssignmentRow)}</TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
