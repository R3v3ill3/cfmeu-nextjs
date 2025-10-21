import { useState, useCallback } from 'react';
import type { ReviewStep, ReviewWorkflowState, PendingEmployer } from '@/types/pendingEmployerReview';

interface UsePendingEmployerReviewOptions {
  onComplete?: (decision: 'approved' | 'rejected' | 'merged') => void;
  onCancel?: () => void;
}

export function usePendingEmployerReview(options: UsePendingEmployerReviewOptions = {}) {
  const { onComplete, onCancel } = options;

  const [workflowState, setWorkflowState] = useState<ReviewWorkflowState | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  // Start review workflow
  const startReview = useCallback((employer: PendingEmployer) => {
    setWorkflowState({
      currentStep: 'match_search',
      employerId: employer.id,
      employerData: employer,
      matchedEmployerId: null,
      mergeIntoExisting: false,
      changes: {},
    });
    setIsReviewing(true);
  }, []);

  // Move to next step
  const nextStep = useCallback(() => {
    if (!workflowState) return;

    const stepOrder: ReviewStep[] = ['match_search', 'edit_employer', 'final_decision'];
    const currentIndex = stepOrder.indexOf(workflowState.currentStep);
    
    if (currentIndex < stepOrder.length - 1) {
      setWorkflowState({
        ...workflowState,
        currentStep: stepOrder[currentIndex + 1],
      });
    }
  }, [workflowState]);

  // Move to previous step
  const previousStep = useCallback(() => {
    if (!workflowState) return;

    const stepOrder: ReviewStep[] = ['match_search', 'edit_employer', 'final_decision'];
    const currentIndex = stepOrder.indexOf(workflowState.currentStep);
    
    if (currentIndex > 0) {
      setWorkflowState({
        ...workflowState,
        currentStep: stepOrder[currentIndex - 1],
      });
    }
  }, [workflowState]);

  // Go to specific step
  const goToStep = useCallback((step: ReviewStep) => {
    if (!workflowState) return;
    
    setWorkflowState({
      ...workflowState,
      currentStep: step,
    });
  }, [workflowState]);

  // Set matched employer (from search step)
  const setMatchedEmployer = useCallback((employerId: string | null, mergeIntoExisting: boolean = false) => {
    if (!workflowState) return;

    setWorkflowState({
      ...workflowState,
      matchedEmployerId: employerId,
      mergeIntoExisting,
    });
  }, [workflowState]);

  // Update employer data (from edit step)
  const updateEmployerData = useCallback((updates: Partial<PendingEmployer>) => {
    if (!workflowState) return;

    setWorkflowState({
      ...workflowState,
      employerData: {
        ...workflowState.employerData,
        ...updates,
      },
      changes: {
        ...workflowState.changes,
        ...updates,
      },
    });
  }, [workflowState]);

  // Complete review with decision
  const completeReview = useCallback((decision: 'approved' | 'rejected' | 'merged') => {
    setIsReviewing(false);
    setWorkflowState(null);
    onComplete?.(decision);
  }, [onComplete]);

  // Cancel review
  const cancelReview = useCallback(() => {
    setIsReviewing(false);
    setWorkflowState(null);
    onCancel?.();
  }, [onCancel]);

  // Reset to beginning
  const resetReview = useCallback(() => {
    if (!workflowState) return;

    setWorkflowState({
      ...workflowState,
      currentStep: 'match_search',
      matchedEmployerId: null,
      mergeIntoExisting: false,
      changes: {},
    });
  }, [workflowState]);

  return {
    // State
    workflowState,
    isReviewing,
    currentStep: workflowState?.currentStep || null,
    employerData: workflowState?.employerData || null,
    matchedEmployerId: workflowState?.matchedEmployerId || null,
    mergeIntoExisting: workflowState?.mergeIntoExisting || false,
    hasChanges: workflowState ? Object.keys(workflowState.changes).length > 0 : false,
    
    // Actions
    startReview,
    nextStep,
    previousStep,
    goToStep,
    setMatchedEmployer,
    updateEmployerData,
    completeReview,
    cancelReview,
    resetReview,
  };
}


