// Types for Pending Employer Review System

export interface PendingEmployer {
  id: string;
  name: string;
  employer_type: string | null;
  website: string | null;
  created_at: string;
  approval_status: 'pending' | 'active' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  merged_from_pending_ids: string[];
  auto_merged: boolean;
  review_notes: string | null;
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  currently_reviewed_by: string | null;
  review_started_at: string | null;
  // Additional fields that may be present
  address_line_1?: string | null;
  address_line_2?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  phone?: string | null;
  email?: string | null;
  abn?: string | null;
  primary_contact_name?: string | null;
}

export interface DuplicateGroup {
  canonical_id: string;
  canonical_name: string;
  members: DuplicateMember[];
  member_count: number;
  min_similarity: number;
  max_similarity: number;
}

export interface DuplicateMember {
  id: string;
  name: string;
  employer_type: string | null;
  website: string | null;
  created_at: string;
  auto_merged: boolean;
  merged_from_pending_ids: string[];
  similarity: number;
}

export interface DuplicateDetectionResult {
  success: boolean;
  groups: DuplicateGroup[];
  total_groups: number;
  total_pending: number;
  error?: string;
}

export interface MergeResult {
  success: boolean;
  canonical_employer_id: string;
  merged_count: number;
  merged_ids: string[];
  merge_log_id: string;
  projects_transferred: number;
  trades_transferred: number;
  error?: string;
}

export interface UndoMergeResult {
  success: boolean;
  restored_count: number;
  restored_ids: string[];
  error?: string;
}

export interface ConflictResolution {
  employer_type?: string;
  name?: string;
  website?: string;
  phone?: string;
  email?: string;
  address_line_1?: string;
  [key: string]: string | undefined;
}

export interface MergeLog {
  id: string;
  canonical_employer_id: string | null;
  merged_employer_ids: string[];
  similarity_scores: Record<string, number>;
  conflict_resolutions: ConflictResolution;
  merged_by: string | null;
  merged_at: string;
  undone_at: string | null;
  undone_by: string | null;
  undo_reason: string | null;
  created_at: string;
}

export type ReviewStep = 'match_search' | 'edit_employer' | 'final_decision';

export interface ReviewWorkflowState {
  currentStep: ReviewStep;
  employerId: string;
  employerData: Partial<PendingEmployer>;
  matchedEmployerId: string | null;
  mergeIntoExisting: boolean;
  changes: Record<string, any>;
}

export type EmployerMatchType = 'canonical_name' | 'alias' | 'external_id' | 'abn';

export interface EmployerAliasRecord {
  id: string;
  alias: string;
  alias_normalized: string;
  is_authoritative: boolean;
  source_system: string | null;
  source_identifier: string | null;
  collected_at: string | null;
}

export interface MatchSearchResult {
  id: string;
  name: string;
  employer_type: string | null;
  address_line_1: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  enterprise_agreement_status: boolean | null;
  matchType: EmployerMatchType;
  matchedAlias?: string | null;
  externalIdMatch?: 'bci' | 'incolink' | null;
  searchScore: number;
  aliases?: EmployerAliasRecord[];
  matchDetails?: Record<string, any> | null;
}

export interface MergeIntoExistingParams {
  pendingEmployerId: string;
  existingEmployerId: string;
  transferJobsites?: boolean;
  transferProjects?: boolean;
  transferTrades?: boolean;
  createAlias?: boolean;
}

export interface MergeIntoExistingResult {
  success: boolean;
  existing_employer_id: string;
  pending_employer_id: string;
  jobsites_transferred: number;
  projects_transferred: number;
  trades_transferred: number;
  alias_created: boolean;
  error?: string;
}


