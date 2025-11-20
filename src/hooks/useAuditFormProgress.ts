/**
 * Custom hook for managing audit form progress and state
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  saveProgress, 
  loadProgress, 
  saveDraft, 
  loadDraft, 
  clearDraft,
  hasDraft,
  getDraftCount,
  AuditFormProgress 
} from '@/lib/auditFormDraftManager';

export type EmployerSubmissionStatus = 'not_started' | 'in_progress' | 'completed';

export interface UseAuditFormProgressProps {
  token: string;
  employers: Array<{ id: string; name: string }>;
  submittedEmployers: string[]; // From API
}

export function useAuditFormProgress({ token, employers, submittedEmployers }: UseAuditFormProgressProps) {
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);
  const [inProgressEmployers, setInProgressEmployers] = useState<Set<string>>(new Set());

  // Initialize in-progress state from localStorage
  useEffect(() => {
    const progress = loadProgress(token);
    if (progress) {
      setInProgressEmployers(new Set(progress.inProgressEmployers));
      // Optionally restore selected employer
      // setSelectedEmployerId(progress.selectedEmployerId);
    }
  }, [token]);

  // Save progress to localStorage when it changes
  useEffect(() => {
    const progress: AuditFormProgress = {
      selectedEmployerId,
      inProgressEmployers: Array.from(inProgressEmployers),
      lastUpdated: new Date().toISOString(),
    };
    saveProgress(token, progress);
  }, [token, selectedEmployerId, inProgressEmployers]);

  // Mark employer as in-progress when selected
  const selectEmployer = useCallback((employerId: string) => {
    setSelectedEmployerId(employerId);
    setInProgressEmployers(prev => new Set([...prev, employerId]));
  }, []);

  // Return to dashboard
  const deselectEmployer = useCallback(() => {
    setSelectedEmployerId(null);
  }, []);

  // Get status for an employer
  const getEmployerStatus = useCallback((employerId: string): EmployerSubmissionStatus => {
    if (submittedEmployers.includes(employerId)) {
      return 'completed';
    }
    if (inProgressEmployers.has(employerId) || hasDraft(token, employerId)) {
      return 'in_progress';
    }
    return 'not_started';
  }, [submittedEmployers, inProgressEmployers, token]);

  // Get employers by status
  const getEmployersByStatus = useCallback((status: EmployerSubmissionStatus) => {
    return employers.filter(emp => getEmployerStatus(emp.id) === status);
  }, [employers, getEmployerStatus]);

  // Get next incomplete employer (for "Submit & Next" functionality)
  const getNextIncompleteEmployer = useCallback((): string | null => {
    // First, try to find not_started employers
    const notStarted = employers.find(emp => getEmployerStatus(emp.id) === 'not_started');
    if (notStarted) return notStarted.id;
    
    // Then, try in_progress employers
    const inProgress = employers.find(emp => getEmployerStatus(emp.id) === 'in_progress');
    if (inProgress) return inProgress.id;
    
    // All complete
    return null;
  }, [employers, getEmployerStatus]);

  // Calculate completion statistics
  const completedCount = submittedEmployers.length;
  const totalCount = employers.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const allComplete = completedCount === totalCount && totalCount > 0;

  // Get draft count
  const draftCount = getDraftCount(token);

  return {
    // State
    selectedEmployerId,
    inProgressEmployers,
    
    // Actions
    selectEmployer,
    deselectEmployer,
    
    // Status helpers
    getEmployerStatus,
    getEmployersByStatus,
    getNextIncompleteEmployer,
    
    // Stats
    completedCount,
    totalCount,
    completionPercentage,
    allComplete,
    draftCount,
  };
}







