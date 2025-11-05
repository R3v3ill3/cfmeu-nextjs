// Types for Pending Project Review System

export interface PendingProject {
  id: string;
  name: string;
  value: number | null;
  proposed_start_date: string | null;
  proposed_end_date: string | null;
  created_at: string;
  approval_status: 'pending' | 'active' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  review_notes: string | null;
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  currently_reviewed_by: string | null;
  review_started_at: string | null;

  // Project details
  stage_class: string | null;
  project_stage: string | null;
  project_status: string | null;
  development_type: string | null;
  owner_type: string | null;
  funding_type: string | null;

  // External IDs
  bci_project_id: string | null;
  external_project_number: string | null;

  // Relations
  main_job_site_id: string | null;
  main_job_site?: JobSiteDetails | null;
  project_assignments?: ProjectAssignmentDetails[];
  // Deprecated: Use main_job_site?.site_contacts instead
  project_contacts?: ProjectContactDetails[];
  scan?: MappingSheetScanDetails[];
}

export interface JobSiteDetails {
  id: string;
  name: string;
  location: string;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  site_contacts?: SiteContactDetails[];
}

export interface ProjectAssignmentDetails {
  id: string;
  assignment_type: 'builder' | 'subcontractor' | 'other';
  employer_id: string;
  employer?: EmployerDetails | null;
  contractor_role_type_id: string | null;
  contractor_role?: { name: string; code: string } | null;
  trade_type_id: string | null;
  trade_type?: { name: string; code: string } | null;
  created_at: string;
  source: string | null;
}

export interface EmployerDetails {
  id: string;
  name: string;
  employer_type: string | null;
  enterprise_agreement_status: boolean | null;
  eba_status_source: string | null;
  approval_status: 'pending' | 'active' | 'rejected';
  website: string | null;
  phone: string | null;
  email: string | null;
}

export interface ProjectContactDetails {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface SiteContactDetails {
  id: string;
  name: string;
  role: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface MappingSheetScanDetails {
  id: string;
  file_name: string;
  created_at: string;      // When the file was uploaded (scan record created)
  uploaded_by: string | null;
  file_size_bytes: number | null;
  status: string;
  upload_mode: string | null;
  updated_at: string;      // When the scan record was last modified
  uploader?: {
    id: string;
    email: string | null;
    full_name: string | null;
  } | null;
}

export interface ProjectDuplicateMatch {
  id: string;
  name: string;
  approval_status: 'active' | 'pending' | 'rejected';
  value: number | null;
  address: string | null;
  builder_name: string | null;
  created_at: string;
  match_type: 'exact' | 'fuzzy';
  similarity_score?: number;
  stage_class: string | null;
  project_status: string | null;
}

export interface ProjectDuplicateCheckResult {
  has_exact_matches: boolean;
  has_fuzzy_matches: boolean;
  exact_matches: ProjectDuplicateMatch[];
  fuzzy_matches: ProjectDuplicateMatch[];
  searched_name: string;
}

export type ProjectReviewStep = 'details' | 'contacts' | 'employers' | 'duplicates' | 'final';

export interface ProjectReviewWorkflowState {
  currentStep: ProjectReviewStep;
  projectId: string;
  projectData: Partial<PendingProject>;
  duplicateCheck: ProjectDuplicateCheckResult | null;
  changes: Record<string, any>;
  selectedDuplicateId: string | null;
  mergeIntoDuplicate: boolean;
}

export interface ProjectEditableFields {
  name?: string;
  value?: number | null;
  proposed_start_date?: string | null;
  proposed_end_date?: string | null;
  project_stage?: string | null;
  project_status?: string | null;
  development_type?: string | null;
  owner_type?: string | null;
  funding_type?: string | null;
  bci_project_id?: string | null;
  external_project_number?: string | null;
}
