export interface Project {
  id: string;
  name: string;
  value: number | null;
  tier: string | null;
  organising_universe?: 'active' | 'potential' | 'excluded' | null;
  stage_class?: 'future' | 'pre_construction' | 'construction' | 'archived' | null;
  proposed_start_date: string | null;
  proposed_finish_date: string | null;
  roe_email: string | null;
  project_type: string | null;
  state_funding: number;
  federal_funding: number;
  builder_id: string | null;
  main_job_site_id: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectTier = 'tier_1' | 'tier_2' | 'tier_3';

export const PROJECT_TIER_LABELS: Record<ProjectTier, string> = {
  tier_1: 'Tier 1 ($500M+)',
  tier_2: 'Tier 2 ($100M-$500M)',
  tier_3: 'Tier 3 (<$100M)'
};

export const PROJECT_TIER_COLORS: Record<ProjectTier, string> = {
  tier_1: 'red',
  tier_2: 'orange', 
  tier_3: 'blue'
};

export const calculateProjectTier = (value: number | null): ProjectTier | null => {
  if (value === null) return null;
  if (value >= 500000000) return 'tier_1';
  if (value >= 100000000) return 'tier_2';
  return 'tier_3';
};
