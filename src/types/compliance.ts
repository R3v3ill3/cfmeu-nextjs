export interface ProjectCompliance {
  id: string;
  project_id: string;
  
  // Delegate information
  delegate_identified: boolean;
  delegate_elected: boolean;
  delegate_elected_date: string | null;
  delegate_worker_id: string | null;
  
  // HSR information
  hsr_chair_exists: boolean;
  hsr_is_delegate: boolean;
  hsr_worker_id: string | null;
  
  // ABN worker check
  abn_worker_check_conducted: boolean;
  abn_worker_check_date: string | null;
  
  // Inductions
  inductions_attended: boolean;
  last_induction_date: string | null;
  induction_attendees: string[]; // ['organiser', 'delegate', 'both']
  
  // Site access
  delegate_site_access: 'none' | 'hammertech' | 'other' | null;
  delegate_site_access_other: string | null;
  
  // Reporting settings
  reporting_frequency: 'weekly' | 'fortnightly' | 'monthly' | 'six_weekly' | 'quarterly' | 'ad_hoc';
  next_report_date: string | null;
  
  // History tracking
  version: number;
  is_current: boolean;
  effective_from: string;
  effective_to: string | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  
  // Relations
  delegate_worker?: {
    id: string;
    first_name: string;
    surname: string;
  };
  hsr_worker?: {
    id: string;
    first_name: string;
    surname: string;
  };
}

export interface EmployerComplianceCheck {
  id: string;
  project_id: string;
  employer_id: string;
  
  // CBUS compliance
  cbus_check_conducted: boolean;
  cbus_check_date: string | null;
  cbus_checked_by: string[]; // ['organiser', 'delegate', 'both', 'cbus_officer']
  cbus_payment_status: 'correct' | 'incorrect' | 'uncertain' | null;
  cbus_payment_timing: 'on_time' | 'late' | 'uncertain' | null;
  cbus_worker_count_status: 'correct' | 'incorrect' | null;
  cbus_enforcement_flag: boolean;
  cbus_followup_required: boolean;
  cbus_notes: string | null;
  
  // INCOLINK compliance
  incolink_check_conducted: boolean;
  incolink_check_date: string | null;
  incolink_checked_by: string[]; // ['organiser', 'delegate', 'both', 'incolink_officer']
  incolink_payment_status: 'correct' | 'incorrect' | 'uncertain' | null;
  incolink_payment_timing: 'on_time' | 'late' | 'uncertain' | null;
  incolink_worker_count_status: 'correct' | 'incorrect' | null;
  incolink_enforcement_flag: boolean;
  incolink_followup_required: boolean;
  incolink_notes: string | null;
  
  // Future INCOLINK integration
  incolink_company_id: string | null;
  
  // Site visit integration
  site_visit_id: string | null;
  
  // History tracking
  version: number;
  is_current: boolean;
  effective_from: string;
  effective_to: string | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  
  // Relations
  employers?: {
    id: string;
    name: string;
    enterprise_agreement_status: boolean | null;
  };
}

export interface ComplianceAlert {
  id: string;
  alert_type: 'overdue_check' | 'non_compliance' | 'followup_required' | 'report_due';
  severity: 'info' | 'warning' | 'critical';
  entity_type: 'project' | 'employer';
  entity_id: string;
  project_id: string;
  message: string;
  due_date: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  created_at: string;
}

export type InductionAttendee = 'organiser' | 'delegate' | 'both';
export type ComplianceChecker = 'organiser' | 'delegate' | 'both' | 'cbus_officer' | 'incolink_officer';
export type PaymentStatus = 'correct' | 'incorrect' | 'uncertain';
export type PaymentTiming = 'on_time' | 'late' | 'uncertain';
export type WorkerCountStatus = 'correct' | 'incorrect';
export type DelegateSiteAccess = 'none' | 'hammertech' | 'other';
export type ReportingFrequency = 'weekly' | 'fortnightly' | 'monthly' | 'six_weekly' | 'quarterly' | 'ad_hoc';
