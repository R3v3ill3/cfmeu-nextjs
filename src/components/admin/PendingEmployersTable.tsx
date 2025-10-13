'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Check, X } from 'lucide-react'

interface PendingEmployer {
  id: string
  name: string
  employer_type: string | null
  website: string | null
  created_at: string
}

interface PendingEmployersTableProps {
  employers: PendingEmployer[]
  onApprove: (employerId: string, notes?: string) => Promise<void>
  onReject: (employerId: string, reason: string) => Promise<void>
}

export function PendingEmployersTable({
  employers,
  onApprove,
  onReject,
}: PendingEmployersTableProps) {
  if (employers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending employers
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Website</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employers.map((employer) => (
          <TableRow key={employer.id}>
            <TableCell className="font-medium">{employer.name}</TableCell>
            <TableCell>
              {employer.employer_type ? (
                <Badge variant="outline">{employer.employer_type}</Badge>
              ) : (
                'N/A'
              )}
            </TableCell>
            <TableCell>
              {employer.website ? (
                <a
                  href={employer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {employer.website}
                </a>
              ) : (
                'N/A'
              )}
            </TableCell>
            <TableCell>
              {format(new Date(employer.created_at), 'MMM d, yyyy')}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    window.confirm('Reject this employer?') &&
                    onReject(
                      employer.id,
                      prompt('Rejection reason:') || 'No reason provided'
                    )
                  }
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onApprove(employer.id)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
