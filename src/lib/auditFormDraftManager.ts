/**
 * Audit Form Draft Manager
 * 
 * Manages localStorage persistence of audit form drafts to prevent data loss.
 * Drafts are stored per-token and per-employer.
 */

export interface AuditFormDraft {
  employerId: string;
  employerName: string;
  data: any;
  lastSaved: string;
  version: number; // For future schema migrations
}

export interface AuditFormProgress {
  selectedEmployerId: string | null;
  inProgressEmployers: string[]; // Employers that have been opened
  lastUpdated: string;
}

const DRAFT_PREFIX = 'audit_draft_';
const PROGRESS_PREFIX = 'audit_progress_';
const CURRENT_VERSION = 1;

/**
 * Save a draft for a specific employer
 */
export function saveDraft(token: string, employerId: string, employerName: string, data: any): void {
  try {
    const draft: AuditFormDraft = {
      employerId,
      employerName,
      data,
      lastSaved: new Date().toISOString(),
      version: CURRENT_VERSION,
    };
    
    const key = `${DRAFT_PREFIX}${token}_${employerId}`;
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.error('Failed to save draft:', error);
    // Fail silently - localStorage might be disabled
  }
}

/**
 * Load a draft for a specific employer
 */
export function loadDraft(token: string, employerId: string): AuditFormDraft | null {
  try {
    const key = `${DRAFT_PREFIX}${token}_${employerId}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;
    
    const draft: AuditFormDraft = JSON.parse(stored);
    
    // Check version compatibility
    if (draft.version !== CURRENT_VERSION) {
      console.warn('Draft version mismatch, ignoring');
      return null;
    }
    
    return draft;
  } catch (error) {
    console.error('Failed to load draft:', error);
    return null;
  }
}

/**
 * Clear a draft for a specific employer (after successful submission)
 */
export function clearDraft(token: string, employerId: string): void {
  try {
    const key = `${DRAFT_PREFIX}${token}_${employerId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear draft:', error);
  }
}

/**
 * Get all drafts for a token
 */
export function getAllDrafts(token: string): Record<string, AuditFormDraft> {
  const drafts: Record<string, AuditFormDraft> = {};
  
  try {
    const prefix = `${DRAFT_PREFIX}${token}_`;
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const employerId = key.substring(prefix.length);
        const draft = loadDraft(token, employerId);
        if (draft) {
          drafts[employerId] = draft;
        }
      }
    }
  } catch (error) {
    console.error('Failed to get all drafts:', error);
  }
  
  return drafts;
}

/**
 * Clear all drafts for a token (after final submission)
 */
export function clearAllDrafts(token: string): void {
  try {
    const prefix = `${DRAFT_PREFIX}${token}_`;
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear all drafts:', error);
  }
}

/**
 * Save progress (which employer is selected, which are in progress)
 */
export function saveProgress(token: string, progress: AuditFormProgress): void {
  try {
    const key = `${PROGRESS_PREFIX}${token}`;
    localStorage.setItem(key, JSON.stringify(progress));
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
}

/**
 * Load progress
 */
export function loadProgress(token: string): AuditFormProgress | null {
  try {
    const key = `${PROGRESS_PREFIX}${token}`;
    const stored = localStorage.getItem(key);
    
    if (!stored) return null;
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load progress:', error);
    return null;
  }
}

/**
 * Clear progress (after final submission)
 */
export function clearProgress(token: string): void {
  try {
    const key = `${PROGRESS_PREFIX}${token}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear progress:', error);
  }
}

/**
 * Check if an employer has unsaved changes
 */
export function hasDraft(token: string, employerId: string): boolean {
  return loadDraft(token, employerId) !== null;
}

/**
 * Get draft count for a token
 */
export function getDraftCount(token: string): number {
  return Object.keys(getAllDrafts(token)).length;
}


