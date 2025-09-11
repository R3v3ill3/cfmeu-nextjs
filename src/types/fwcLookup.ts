// Re-export from existing interface to maintain compatibility
export interface ImportResults {
  successful: Array<{ employer_id: string; company_name: string; [key: string]: any }>;
  failed: number;
  duplicates: number;
  updated: number;
  errors: string[];
  unmatchedEmployers: any[];
  matchingStats: any;
}

export interface FWCSearchResult {
  title: string;
  agreementType: string;
  status: string;
  approvedDate?: string;
  expiryDate?: string;
  lodgementNumber?: string;
  documentUrl?: string;
  summaryUrl?: string;
  downloadToken?: string;
}

export interface FwcLookupJob {
  id: string;
  employerIds: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high';
  progress: {
    completed: number;
    total: number;
    currentEmployer?: string;
  };
  results: FwcLookupResult[];
  errors: FwcLookupError[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration?: number; // in seconds
  batchSize: number;
}

export interface FwcLookupResult {
  employerId: string;
  employerName: string;
  success: boolean;
  fwcResults: FWCSearchResult[];
  selectedResult?: FWCSearchResult;
  processingTime: number; // in milliseconds
  error?: string;
}

export interface FwcLookupError {
  employerId: string;
  employerName: string;
  error: string;
  timestamp: Date;
  retryable: boolean;
}

export interface FwcLookupJobOptions {
  priority?: 'low' | 'normal' | 'high';
  batchSize?: number;
  concurrency?: number;
  retryAttempts?: number;
  skipExisting?: boolean; // Skip employers that already have FWC data
  autoSelectBest?: boolean; // Automatically select the best matching result
}

export interface FwcLookupJobSummary {
  jobId: string;
  totalEmployers: number;
  processedEmployers: number;
  successfulLookups: number;
  failedLookups: number;
  skippedEmployers: number;
  averageProcessingTime: number;
  totalDuration: number;
  status: FwcLookupJob['status'];
}

// Database types for job persistence
export interface FwcLookupJobRecord {
  id: string;
  employer_ids: string[];
  status: string;
  priority: string;
  progress_completed: number;
  progress_total: number;
  current_employer?: string;
  batch_size: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  estimated_duration?: number;
  options: Record<string, any>;
}

export interface FwcLookupResultRecord {
  id: string;
  job_id: string;
  employer_id: string;
  employer_name: string;
  success: boolean;
  fwc_results: FWCSearchResult[];
  selected_result?: FWCSearchResult;
  processing_time: number;
  error?: string;
  created_at: string;
}

// Supabase client import (will be replaced by actual import in components)
declare const supabase: any;
