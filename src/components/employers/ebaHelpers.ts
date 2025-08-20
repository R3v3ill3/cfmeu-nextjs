export type EbaStatusInfo = {
  status: string;
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

export type EbaStepStatus = {
  status: 'completed' | 'implied' | 'next' | 'pending';
  hasDate: boolean;
  needsAttention: boolean;
};

export type EbaWorkflowStep = {
  key: string;
  label: string;
  isMilestone: boolean;
  dependsOn?: string[];
};

export function getEbaStatusInfo(ebaRecord: any): EbaStatusInfo {
  // Check for expiry first - this takes precedence
  if (ebaRecord.nominal_expiry_date) {
    const expiryDate = new Date(ebaRecord.nominal_expiry_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for comparison
    expiryDate.setHours(0, 0, 0, 0);
    
    if (expiryDate < today) {
      return {
        status: "expired",
        label: "Expired",
        variant: "destructive"
      };
    }
  }
  
  if (ebaRecord.fwc_certified_date) {
    return {
      status: "certified",
      label: "Certified",
      variant: "default"
    };
  }
  
  if (ebaRecord.date_eba_signed) {
    return {
      status: "signed",
      label: "Signed",
      variant: "secondary"
    };
  }
  
  if (ebaRecord.eba_lodged_fwc) {
    return {
      status: "lodged",
      label: "Lodged with FWC",
      variant: "outline"
    };
  }
  
  if (ebaRecord.eba_data_form_received || ebaRecord.date_draft_signing_sent || ebaRecord.date_barg_docs_sent) {
    return {
      status: "in_progress",
      label: "In Progress",
      variant: "outline"
    };
  }
  
  return {
    status: "no_eba",
    label: "No EBA",
    variant: "destructive"
  };
}

// Define workflow steps with milestone markers and dependencies
export const workflowSteps: EbaWorkflowStep[] = [
  { key: 'eba_data_form_received', label: 'EBA Data Form Received', isMilestone: false },
  { key: 'date_draft_signing_sent', label: 'Draft Signing Sent', isMilestone: false },
  { key: 'followup_phone_call', label: 'Follow-up Phone Call', isMilestone: false },
  { key: 'followup_email_sent', label: 'Follow-up Email Sent', isMilestone: false },
  { key: 'out_of_office_received', label: 'Out of Office Received', isMilestone: false },
  { key: 'docs_prepared', label: 'Documents Prepared', isMilestone: false },
  { key: 'date_barg_docs_sent', label: 'Bargaining Docs Sent', isMilestone: true },
  { key: 'date_eba_signed', label: 'EBA Signed', isMilestone: true },
  { key: 'date_vote_occurred', label: 'Vote Occurred', isMilestone: false },
  { key: 'eba_lodged_fwc', label: 'EBA Lodged with FWC', isMilestone: true },
  { key: 'fwc_certified_date', label: 'FWC Certified', isMilestone: true },
];

// Find the highest completed milestone
export function getHighestMilestone(ebaRecord: any): string | null {
  const milestones = [
    'fwc_certified_date',
    'eba_lodged_fwc', 
    'date_eba_signed',
    'date_barg_docs_sent'
  ];
  
  for (const milestone of milestones) {
    if (ebaRecord[milestone]) {
      return milestone;
    }
  }
  return null;
}

// Calculate smart step status based on milestones
export function getSmartStepStatus(stepKey: string, ebaRecord: any): EbaStepStatus {
  const hasDate = !!ebaRecord[stepKey];
  const highestMilestone = getHighestMilestone(ebaRecord);
  
  if (hasDate) {
    return {
      status: 'completed',
      hasDate: true,
      needsAttention: false
    };
  }
  
  // Check if this step should be implied complete based on milestones
  const stepIndex = workflowSteps.findIndex(s => s.key === stepKey);
  const milestoneIndex = highestMilestone ? workflowSteps.findIndex(s => s.key === highestMilestone) : -1;
  
  if (milestoneIndex >= 0 && stepIndex <= milestoneIndex) {
    return {
      status: 'implied',
      hasDate: false,
      needsAttention: true // Missing date for completed process
    };
  }
  
  // Determine if this is the next logical step
  const isNext = stepIndex === 0 || workflowSteps.slice(0, stepIndex).every(s => {
    const status = getSmartStepStatus(s.key, ebaRecord);
    return status.status === 'completed' || status.status === 'implied';
  });
  
  return {
    status: isNext ? 'next' : 'pending',
    hasDate: false,
    needsAttention: false
  };
}

export function getEbaProgress(ebaRecord: any): { stage: string; percentage: number } {
  const highestMilestone = getHighestMilestone(ebaRecord);
  
  if (!highestMilestone) {
    return {
      stage: 'Not Started',
      percentage: 0
    };
  }
  
  const milestoneLabels = {
    'date_barg_docs_sent': 'Docs Sent',
    'date_eba_signed': 'Signed',
    'eba_lodged_fwc': 'Lodged',
    'fwc_certified_date': 'Certified'
  };
  
  const milestoneOrder = ['date_barg_docs_sent', 'date_eba_signed', 'eba_lodged_fwc', 'fwc_certified_date'];
  const milestoneIndex = milestoneOrder.indexOf(highestMilestone);
  
  return {
    stage: milestoneLabels[highestMilestone as keyof typeof milestoneLabels] || 'In Progress',
    percentage: Math.round(((milestoneIndex + 1) / milestoneOrder.length) * 100)
  };
}

// New simplified categorisation used for employer listing and engagement checks
export type EbaCategoryInfo = {
  category: 'active' | 'lodged' | 'pending' | 'no';
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
};

export function getEbaCategory(ebaRecord: any): EbaCategoryInfo {
  const today = new Date();

  const getDate = (d?: string | null): Date | null => {
    if (!d) return null;
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const withinMonths = (date: Date | null, months: number): boolean => {
    if (!date) return false;
    const cutoff = new Date(today);
    cutoff.setMonth(cutoff.getMonth() - months);
    return date >= cutoff;
  };

  const withinYears = (date: Date | null, years: number): boolean => withinMonths(date, years * 12);

  const certifiedDate = getDate(ebaRecord.fwc_certified_date);
  const lodgedDate = getDate(ebaRecord.eba_lodged_fwc);
  // Support both potential spellings for safety
  const voteOccurredDate = getDate(ebaRecord.date_vote_occurred ?? ebaRecord.date_vote_occured);
  const signedDate = getDate(ebaRecord.date_eba_signed);

  if (withinYears(certifiedDate, 4)) {
    return { category: 'active', label: 'Active', variant: 'default' };
  }

  if (withinYears(lodgedDate, 1)) {
    return { category: 'lodged', label: 'Lodged', variant: 'outline' };
  }

  if (withinMonths(voteOccurredDate, 6) || withinMonths(signedDate, 6)) {
    return { category: 'pending', label: 'Pending', variant: 'secondary' };
  }

  return { category: 'no', label: 'No EBA', variant: 'destructive' };
}