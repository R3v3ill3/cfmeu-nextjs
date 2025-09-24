export type ProjectColorScheme = 'tier' | 'organising_universe' | 'stage' | 'builder_eba' | 'default';

// Color schemes for different project attributes
export const PROJECT_COLOR_SCHEMES = {
  tier: {
    tier_1: '#ef4444', // red - highest tier
    tier_2: '#f97316', // orange - medium tier  
    tier_3: '#3b82f6', // blue - lowest tier
    null: '#6b7280',   // gray - no tier
    undefined: '#6b7280'
  },
  organising_universe: {
    active: '#22c55e',     // green - active organizing
    potential: '#eab308',  // yellow - potential organizing
    excluded: '#ef4444',   // red - excluded from organizing
    null: '#6b7280',       // gray - not classified
    undefined: '#6b7280'
  },
  stage: {
    future: '#8b5cf6',           // purple - future projects
    pre_construction: '#f59e0b', // amber - pre-construction
    construction: '#10b981',     // emerald - active construction
    archived: '#6b7280',         // gray - archived projects
    null: '#6b7280',             // gray - not classified
    undefined: '#6b7280'
  },
  builder_eba: {
    active_builder: '#16a34a', // green
    inactive_builder: '#f97316', // orange
    unknown_builder: '#6b7280', // gray
    null: '#6b7280',
    undefined: '#6b7280'
  },
  default: '#3b82f6' // default blue for all projects
};

// Labels for the color schemes
export const COLOR_SCHEME_LABELS = {
  tier: {
    tier_1: 'Tier 1 ($500M+)',
    tier_2: 'Tier 2 ($100M-$500M)', 
    tier_3: 'Tier 3 (<$100M)',
    null: 'No Tier',
    undefined: 'No Tier'
  },
  organising_universe: {
    active: 'Active',
    potential: 'Potential',
    excluded: 'Excluded',
    null: 'Not Classified',
    undefined: 'Not Classified'
  },
  stage: {
    future: 'Future',
    pre_construction: 'Pre-Construction',
    construction: 'Construction',
    archived: 'Archived',
    null: 'Not Classified',
    undefined: 'Not Classified'
  },
  builder_eba: {
    active_builder: 'Builder = EBA active employer',
    inactive_builder: 'Builder = known employer (EBA not active)',
    unknown_builder: 'Builder not known',
    null: 'Builder not known',
    undefined: 'Builder not known'
  }
};

export function getProjectColor(
  colorScheme: ProjectColorScheme,
  project: {
    tier?: string | null;
    organising_universe?: string | null;
    stage_class?: string | null;
    builder_status?: 'active_builder' | 'inactive_builder' | 'unknown_builder' | null;
  }
): string {
  if (colorScheme === 'default') {
    return PROJECT_COLOR_SCHEMES.default;
  }

  const schemes = PROJECT_COLOR_SCHEMES[colorScheme];
  if (!schemes || typeof schemes === 'string') {
    return PROJECT_COLOR_SCHEMES.default;
  }

  let value: string | null | undefined;
  switch (colorScheme) {
    case 'tier':
      value = project.tier;
      break;
    case 'organising_universe':
      value = project.organising_universe;
      break;
    case 'stage':
      value = project.stage_class;
      break;
    case 'builder_eba':
      value = project.builder_status;
      break;
    default:
      return PROJECT_COLOR_SCHEMES.default;
  }

  // Handle null/undefined values
  const key = value ?? 'null';
  return schemes[key as keyof typeof schemes] || schemes['null'] || PROJECT_COLOR_SCHEMES.default;
}

export function getColorSchemeLegend(colorScheme: ProjectColorScheme): Array<{label: string, color: string}> {
  if (colorScheme === 'default') {
    return [{ label: 'All Projects', color: PROJECT_COLOR_SCHEMES.default }];
  }

  const colors = PROJECT_COLOR_SCHEMES[colorScheme];
  const labels = COLOR_SCHEME_LABELS[colorScheme];
  
  if (!colors || !labels || typeof colors === 'string') {
    return [{ label: 'All Projects', color: PROJECT_COLOR_SCHEMES.default }];
  }

  return Object.entries(colors)
    .filter(([key]) => key !== 'null' && key !== 'undefined') // Show main categories
    .map(([key, color]) => ({
      label: labels[key as keyof typeof labels] || key,
      color
    }));
}
