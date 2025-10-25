import { useState, useCallback } from 'react';
import type { ProjectDuplicateCheckResult } from '@/types/pendingProjectReview';

interface UseProjectDuplicateDetectionOptions {
  projectId?: string;
  projectName?: string;
}

export function useProjectDuplicateDetection() {
  const [result, setResult] = useState<ProjectDuplicateCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkDuplicates = useCallback(async (projectName: string, projectId?: string) => {
    setIsChecking(true);
    setError(null);

    try {
      const response = await fetch('/api/projects/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          projectId: projectId // Exclude current project from results
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check for duplicates');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      console.error('Error checking duplicates:', err);
      setError(err instanceof Error ? err.message : 'Failed to check duplicates');
      setResult(null);
    } finally {
      setIsChecking(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setIsChecking(false);
  }, []);

  return {
    result,
    isChecking,
    error,
    checkDuplicates,
    clear,
  };
}
