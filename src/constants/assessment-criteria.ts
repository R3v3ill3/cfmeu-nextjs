/**
 * Shared Assessment Criteria Definitions
 * 
 * This file defines all assessment criteria used across the application.
 * Both the main app and public webforms reference these constants to ensure consistency.
 * 
 * When criteria change here, they automatically update everywhere.
 */

export interface AssessmentCriterion {
  id: string;
  name: string;
  description: string;
  weight?: number;
}

// Union Respect Assessment Criteria (5 criteria)
export const UNION_RESPECT_CRITERIA: AssessmentCriterion[] = [
  {
    id: 'right_of_entry',
    name: 'Right of Entry',
    description: 'How well does the employer respect union right of entry to workplaces?',
    weight: 1.0,
  },
  {
    id: 'delegate_accommodation',
    name: 'Delegate Accommodation & Recognition',
    description: 'How well does the employer accommodate and recognize union delegates?',
    weight: 1.0,
  },
  {
    id: 'access_to_information',
    name: 'Access to Information',
    description: 'How well does the employer provide access to workplace information?',
    weight: 1.0,
  },
  {
    id: 'access_to_inductions',
    name: 'Access to Inductions/New Starters',
    description: 'How well does the employer allow union access to new worker inductions?',
    weight: 1.0,
  },
  {
    id: 'eba_status',
    name: 'EBA Status',
    description: "Assessment of the employer's Enterprise Bargaining Agreement status and compliance",
    weight: 1.0,
  },
];

// Safety 4-Point Assessment Criteria (6 criteria)
export const SAFETY_CRITERIA: AssessmentCriterion[] = [
  {
    id: 'safety_management_systems',
    name: 'Safety Management Systems',
    description: 'Quality and effectiveness of documented safety systems and procedures',
    weight: 1.0,
  },
  {
    id: 'incident_reporting',
    name: 'Incident Reporting Culture',
    description: 'Effectiveness of incident reporting and investigation processes',
    weight: 1.0,
  },
  {
    id: 'site_safety_culture',
    name: 'Site Safety Culture',
    description: 'Overall safety attitude and behavior on site',
    weight: 1.0,
  },
  {
    id: 'risk_assessment_processes',
    name: 'Risk Assessment Processes',
    description: 'Quality of risk identification, assessment, and control measures',
    weight: 1.0,
  },
  {
    id: 'emergency_preparedness',
    name: 'Emergency Preparedness',
    description: 'Readiness for emergency situations and response capabilities',
    weight: 1.0,
  },
  {
    id: 'worker_safety_training',
    name: 'Worker Safety Training',
    description: 'Quality and completeness of safety training programs',
    weight: 1.0,
  },
];

// Subcontractor Use Assessment Criteria (3 criteria)
export const SUBCONTRACTOR_CRITERIA: AssessmentCriterion[] = [
  {
    id: 'subcontractor_usage',
    name: 'Subcontractor Usage',
    description: 'Extent and quality of subcontractor employment on projects',
    weight: 1.2, // Higher weight as this is the main factor
  },
  {
    id: 'payment_terms',
    name: 'Payment Terms',
    description: 'Payment speed and terms offered to subcontractors',
    weight: 0.8,
  },
  {
    id: 'treatment_of_subbies',
    name: 'Treatment of Subcontractors',
    description: 'Overall relationship and treatment of subcontractor partners',
    weight: 1.0,
  },
];

// 4-Point Rating Scale
export const FOUR_POINT_SCALE = {
  1: { label: "Good", description: "Exceeds expectations", color: "bg-green-500" },
  2: { label: "Fair", description: "Meets expectations", color: "bg-yellow-500" },
  3: { label: "Poor", description: "Below expectations", color: "bg-orange-500" },
  4: { label: "Terrible", description: "Major concerns", color: "bg-red-500" }
} as const;

