'use client';

import { useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Building2,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { useProjectDuplicateDetection } from '@/hooks/useProjectDuplicateDetection';
import type { PendingProject } from '@/types/pendingProjectReview';
import Link from 'next/link';
import { format } from 'date-fns';

interface DuplicatesTabProps {
  project: PendingProject;
  onLinkToProject?: (projectId: string) => void;
}

export function DuplicatesTab({ project, onLinkToProject }: DuplicatesTabProps) {
  const { result, isChecking, error, checkDuplicates } = useProjectDuplicateDetection();

  useEffect(() => {
    if (project.name) {
      checkDuplicates(project.name, project.id);
    }
  }, [project.name, project.id, checkDuplicates]);

  const formatValue = (value: number | null) => {
    if (!value) return 'N/A';
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (date: string) => {
    try {
      return format(new Date(date), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  if (isChecking) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Checking for duplicates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error checking duplicates</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!result) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Unable to check for duplicates. Please try refreshing.
        </AlertDescription>
      </Alert>
    );
  }

  const allMatches = [...result.exact_matches, ...result.fuzzy_matches];

  if (allMatches.length === 0) {
    return (
      <Alert className="border-green-500 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900">No duplicates found</AlertTitle>
        <AlertDescription className="text-green-800">
          This project name appears to be unique. No exact or similar matches were found in
          the system.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Alert */}
      <Alert
        className={
          result.has_exact_matches
            ? 'border-red-500 bg-red-50'
            : 'border-orange-500 bg-orange-50'
        }
      >
        <AlertTriangle
          className={`h-4 w-4 ${
            result.has_exact_matches ? 'text-red-600' : 'text-orange-600'
          }`}
        />
        <AlertTitle
          className={result.has_exact_matches ? 'text-red-900' : 'text-orange-900'}
        >
          {result.has_exact_matches ? 'Exact Match Found' : 'Similar Projects Found'}
        </AlertTitle>
        <AlertDescription
          className={result.has_exact_matches ? 'text-red-800' : 'text-orange-800'}
        >
          {result.has_exact_matches ? (
            <>
              {result.exact_matches.length} project{result.exact_matches.length > 1 ? 's' : ''}{' '}
              with this exact name already exist{result.exact_matches.length === 1 ? 's' : ''}.
              Please review carefully to avoid creating a duplicate.
            </>
          ) : (
            <>
              Found {result.fuzzy_matches.length} similar project
              {result.fuzzy_matches.length > 1 ? 's' : ''}. Review to ensure this is not a
              duplicate.
            </>
          )}
        </AlertDescription>
      </Alert>

      {/* Exact Matches */}
      {result.exact_matches.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            Exact Matches ({result.exact_matches.length})
          </h3>
          {result.exact_matches.map((match) => (
            <Card key={match.id} className="border-2 border-red-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{match.name}</h4>
                      <Badge
                        variant={
                          match.approval_status === 'active'
                            ? 'default'
                            : match.approval_status === 'pending'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {match.approval_status}
                      </Badge>
                      <Badge variant="destructive">Exact Match</Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      {match.value && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>Value: {formatValue(match.value)}</span>
                        </div>
                      )}
                      {match.builder_name && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span>Builder: {match.builder_name}</span>
                        </div>
                      )}
                      {match.address && (
                        <div className="col-span-full">Address: {match.address}</div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Created: {formatDate(match.created_at)}</span>
                      </div>
                      {match.stage_class && (
                        <div>
                          <Badge variant="outline" className="text-xs">
                            {match.stage_class}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/projects/${match.id}`} target="_blank">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </Link>
                    {onLinkToProject && match.approval_status === 'active' && (
                      <Button size="sm" onClick={() => onLinkToProject(match.id)}>
                        Link to This
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Fuzzy Matches */}
      {result.fuzzy_matches.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            Similar Matches ({result.fuzzy_matches.length})
          </h3>
          {result.fuzzy_matches.map((match) => (
            <Card key={match.id} className="border-2 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold">{match.name}</h4>
                      <Badge
                        variant={
                          match.approval_status === 'active'
                            ? 'default'
                            : match.approval_status === 'pending'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {match.approval_status}
                      </Badge>
                      {match.similarity_score && (
                        <Badge variant="outline">
                          {Math.round(match.similarity_score * 100)}% match
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      {match.value && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          <span>Value: {formatValue(match.value)}</span>
                        </div>
                      )}
                      {match.builder_name && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span>Builder: {match.builder_name}</span>
                        </div>
                      )}
                      {match.address && (
                        <div className="col-span-full">Address: {match.address}</div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Created: {formatDate(match.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/projects/${match.id}`} target="_blank">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </Link>
                    {onLinkToProject && match.approval_status === 'active' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onLinkToProject(match.id)}
                      >
                        Link to This
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
