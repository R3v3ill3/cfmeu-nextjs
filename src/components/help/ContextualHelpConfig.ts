import type { HelpTooltipConfig } from './ContextualHelpTooltip'

/**
 * Centralized configuration for all contextual help tooltips and content
 * This file maps specific pages, forms, and features to their help content
 */

export const CONTEXTUAL_HELP_CONFIGS: Record<string, HelpTooltipConfig[]> = {

  // Site Visit Wizard Help Configurations
  'site-visit-wizard': [
    {
      id: 'site-visit-wizard-overview',
      type: 'help',
      title: 'Site Visit Wizard Guide',
      content: 'The Site Visit Wizard guides you through comprehensive site assessments step by step.',
      detailedContent: 'This wizard combines multiple workflows into one seamless experience: project selection, contact mapping, compliance auditing, employer ratings, and data collection. Each step is designed to capture critical information efficiently while on site.',
      examples: [
        'Start by selecting the project you\'re visiting',
        'Add or update site contacts and delegates',
        'Complete compliance assessment using traffic light system',
        'Rate employers based on your expertise and observations',
        'Document workforce composition and conditions'
      ],
      relatedLinks: [
        { label: 'Complete Site Visit Guide', url: '/help/site-visit-workflow' },
        { label: 'Compliance Assessment', url: '/help/compliance-auditing' }
      ],
      context: { page: '/site-visit-wizard', section: 'overview' }
    },
    {
      id: 'project-selection-help',
      type: 'info',
      title: 'Project Selection',
      content: 'Choose the construction project you\'re visiting from your assigned patches.',
      detailedContent: 'Projects are filtered based on your geographic patch assignments. You can search by project name, address, or employer. The map shows project locations relative to your current position.',
      examples: [
        'Use the search bar to find specific projects',
        'Click "Closest to me" to see nearest projects first',
        'Check project status before selection (active, pending, archived)'
      ],
      context: { page: '/site-visit-wizard', section: 'project-selection' }
    }
  ],

  // Mobile Ratings System Help Configurations
  'mobile-ratings-wizard': [
    {
      id: 'rating-confidence-score',
      type: 'info',
      title: 'Confidence Score',
      content: 'How confident are you in this assessment based on your knowledge and available evidence?',
      detailedContent: 'Confidence scores help other organisers understand the reliability of ratings. High confidence requires direct experience or verified information. Low confidence indicates limited or second-hand information.',
      examples: [
        'Very High: Direct experience with this employer, multiple recent interactions',
        'High: Regular contact, solid understanding of their operations',
        'Medium: Some experience, mixed observations',
        'Low: Limited information, hearsay, or outdated knowledge'
      ],
      context: { page: '/mobile/ratings/wizard', section: 'confidence' }
    },
    {
      id: 'sham-contracting-detection',
      type: 'warning',
      title: 'Sham Contracting Indicators',
      content: 'Identify potential sham contracting arrangements that undermine worker rights.',
      detailedContent: 'Sham contracting involves employers misclassifying employees as independent contractors to avoid obligations like superannuation, workers compensation, and award conditions. Look for these warning signs during site visits.',
      examples: [
        'Workers required to have their own ABN and insurance',
        'Workers providing their own tools and equipment',
        'No employee benefits like leave entitlements',
        'Workers paid per job rather than regular wages',
        'Invoice-based payment system instead of PAYG'
      ],
      relatedLinks: [
        { label: 'Fair Work Ombudsman Guide', url: 'https://www.fairwork.gov.au/leave/annual-leave' }
      ],
      context: { page: '/mobile/ratings/wizard', section: 'sham-contracting' }
    },
    {
      id: 'rating-track-selection',
      type: 'help',
      title: 'Rating Tracks',
      content: 'Choose the appropriate track for this rating based on how you know this employer.',
      detailedContent: 'Different tracks require different evidence and considerations. Project Data ratings are based on formal project records, while Organiser Expertise ratings come from your professional experience and interactions.',
      examples: [
        'Project Data: Based on formal records, compliance reports, documented incidents',
        'Organiser Expertise: Based on personal experience, site observations, relationship quality',
        'Worker Feedback: Based on reports from union members and delegates'
      ],
      context: { page: '/mobile/ratings/wizard', section: 'track-selection' }
    }
  ],

  // GPS and Map Discovery Help Configurations
  'mobile-map-discovery': [
    {
      id: 'gps-permission-request',
      type: 'info',
      title: 'Location Permission Required',
      content: 'Enable location services to find projects near you and get turn-by-turn directions.',
      detailedContent: 'Your location is used only to show nearby projects and provide navigation. We don\'t track your movements or store your location history. You can deny permission and still use the map manually.',
      examples: [
        'Projects are sorted by distance from your current location',
        'Get accurate walking/driving directions to sites',
        "See which projects are 'Closest to me'"
      ],
      context: { page: '/mobile/map/discovery', section: 'gps-permission' }
    },
    {
      id: 'geofencing-setup',
      type: 'help',
      title: 'Geofencing Boundaries',
      content: 'Set up virtual boundaries around construction sites for automated monitoring.',
      detailedContent: 'Geofencing creates invisible boundaries around project locations. When you enter or leave these areas, the app can automatically prompt you to record site visits or update project status.',
      examples: [
        'Automatic site visit logging when entering project boundaries',
        'Reminders when approaching projects with pending tasks',
        'Time tracking for compliance purposes'
      ],
      context: { page: '/mobile/map/discovery', section: 'geofencing' }
    },
    {
      id: 'closest-to-me-feature',
      type: 'tip',
      title: '"Closest to Me" Sorting',
      content: 'Quickly find the nearest construction project to your current location.',
      detailedContent: 'This feature calculates real-time distances using GPS to help you efficiently plan your route between multiple sites. Perfect for organizers managing several projects in the same area.',
      examples: [
        'Tap "Closest to me" to re-sort project list by distance',
        'See estimated travel time to each project',
        'Optimize your daily site visit schedule'
      ],
      context: { page: '/mobile/map/discovery', section: 'closest-sorting' }
    }
  ],

  // Mobile PWA Features Help Configurations
  'mobile-pwa-features': [
    {
      id: 'pwa-installation-prompt',
      type: 'tip',
      title: 'Install CFMEU Mobile App',
      content: 'Add this app to your home screen for quick access and offline functionality.',
      detailedContent: 'Installing as a Progressive Web App (PWA) provides a native app experience with offline capabilities, push notifications, and faster loading. Works on both iOS and Android devices.',
      examples: [
        'iOS: Tap Share button → "Add to Home Screen"',
        'Android: Tap menu button → "Install app" or "Add to Home screen"',
        'Get full-screen app experience without app store'
      ],
      relatedLinks: [
        { label: 'PWA Installation Guide', url: '/help/pwa-installation' }
      ],
      context: { page: '/mobile', section: 'pwa-install' }
    },
    {
      id: 'offline-sync-indicator',
      type: 'info',
      title: 'Offline Sync Status',
      content: 'Shows your connection status and data synchronization progress.',
      detailedContent: 'When offline, your data is saved locally and will sync automatically when you reconnect. The indicator shows what\'s queued for sync and any potential conflicts that need attention.',
      examples: [
        'Green: Online and synced',
        'Amber: Online, syncing changes',
        'Red: Offline or sync errors',
        'Blue: Changes pending sync'
      ],
      context: { page: '/mobile', section: 'offline-status' }
    }
  ],

  // Project Mapping Workflow Help Configurations
  'project-mapping': [
    {
      id: 'workforce-composition',
      type: 'help',
      title: 'Workforce Composition',
      content: 'Record the total number of workers and union membership percentage.',
      detailedContent: 'Accurate workforce data helps track union density and identify organizing opportunities. Count all workers on site including contractors and subcontractors. Union membership includes all financial members regardless of trade.',
      examples: [
        'Total workers: Everyone physically present on site',
        'Union members: CFMEU financial members only',
        'Delegates: Elected union representatives',
        'Note down any anti-union behavior observed'
      ],
      context: { page: '/projects/[projectId]/mapping', section: 'workforce' }
    },
    {
      id: 'site-photography-guidelines',
      type: 'tip',
      title: 'Site Photography Best Practices',
      content: 'Capture effective photos that document site conditions and compliance issues.',
      detailedContent: 'Good photos provide evidence for compliance cases and help track site progress. Focus on safety, conditions, and organizing opportunities. Always respect privacy and safety when taking photos.',
      examples: [
        'Site entrance and safety signage',
        'Worker facilities and amenities',
        'Construction progress and conditions',
        'Safety hazards or compliance issues',
        'Union delegate visibility and activities'
      ],
      context: { page: '/projects/[projectId]/mapping', section: 'photos' }
    }
  ],

  // Compliance Auditing Help Configurations
  'compliance-auditing': [
    {
      id: 'traffic-light-system',
      type: 'info',
      title: 'Traffic Light Compliance System',
      content: 'Rate site compliance using standardized traffic light indicators.',
      detailedContent: 'The traffic light system provides consistent assessment across all sites. Green indicates good compliance, amber shows areas needing attention, and red identifies serious issues requiring immediate action.',
      examples: [
        'Green: Meeting all requirements, minimal concerns',
        'Amber: Some issues, improvement needed, monitor closely',
        'Red: Serious breaches, immediate action required, report to officials'
      ],
      context: { page: '/projects/[projectId]/compliance', section: 'traffic-lights' }
    },
    {
      id: 'delegate-task-assignment',
      type: 'help',
      title: 'Delegate Task Assignment',
      content: 'Assign specific tasks to union delegates for ongoing site monitoring.',
      detailedContent: 'Delegates are your eyes and ears on site between visits. Assign them concrete, actionable tasks with clear deadlines. Provide context about why each task matters and what to look for.',
      examples: [
        'Monitor daily toolbox talks',
        'Check amenity facilities weekly',
        'Document any new subcontractors',
        'Report safety incidents immediately',
        'Track workforce changes monthly'
      ],
      relatedLinks: [
        { label: 'Delegate Task Webform', url: '/delegate-tasks/create' }
      ],
      context: { page: '/projects/[projectId]/compliance', section: 'delegate-tasks' }
    }
  ],

  // Enhanced Form Field Specific Help Configurations
  'form-fields': [
    {
      id: 'abn-validation',
      type: 'info',
      title: 'Australian Business Number (ABN)',
      content: 'Enter the 11-digit ABN without spaces or formatting.',
      detailedContent: 'The ABN is a unique identifier for Australian businesses. We validate ABNs in real-time to ensure accuracy. If an ABN fails validation, double-check the number or contact the employer for confirmation.',
      examples: [
        'Correct format: 12345678901',
        'Incorrect: 123 456 789 01 or 12-345-678-901',
        'New businesses may have recently issued ABNs'
      ],
      context: { page: 'various', section: 'abn-field' }
    },
    {
      id: 'phone-format',
      type: 'help',
      title: 'Phone Number Format',
      content: 'Enter mobile numbers with Australian format for best results.',
      detailedContent: 'Standard Australian mobile format ensures SMS delivery and click-to-call functionality works correctly. Include the area code for landlines. International numbers should include country codes.',
      examples: [
        'Mobile: 0412 345 678',
        'Landline: (02) 9876 5432',
        'International: +61 412 345 678'
      ],
      context: { page: 'various', section: 'phone-field' }
    },
    {
      id: 'confidence-score-selection',
      type: 'help',
      title: 'Rating Confidence Score',
      content: 'How confident are you in this assessment based on your knowledge and available evidence?',
      detailedContent: 'Confidence scores help other organizers understand the reliability of ratings. High confidence requires direct experience or verified information. Low confidence indicates limited or second-hand information.',
      examples: [
        'Very High: Direct experience with this employer, multiple recent interactions',
        'High: Regular contact, solid understanding of their operations',
        'Medium: Some experience, mixed observations',
        'Low: Limited information, hearsay, or outdated knowledge'
      ],
      context: { page: 'various', section: 'confidence-field' }
    },
    {
      id: 'traffic-light-rating',
      type: 'info',
      title: 'Traffic Light Compliance Rating',
      content: 'Rate site compliance using standardized traffic light indicators.',
      detailedContent: 'The traffic light system provides consistent assessment across all sites. Green indicates good compliance, amber shows areas needing attention, and red identifies serious issues requiring immediate action.',
      examples: [
        'Green: Meeting all requirements, minimal concerns',
        'Amber: Some issues, improvement needed, monitor closely',
        'Red: Serious breaches, immediate action required, report to officials'
      ],
      context: { page: 'various', section: 'traffic-light-field' }
    }
  ],

  // Project Overview and Management
  'project-overview': [
    {
      id: 'project-dashboard-navigation',
      type: 'help',
      title: 'Project Dashboard Navigation',
      content: 'Quick access to key project information and actions.',
      detailedContent: 'The project dashboard provides a centralized view of all project-related information including compliance status, contacts, workforce data, and recent activities. Use the tabs to navigate between different aspects of project management.',
      examples: [
        'Click the Map tab to see project location and nearby sites',
        'Use Compliance tab to view traffic light ratings and issues',
        'Access Mapping tab for contact and workforce information',
        'Check Activity feed for recent updates and changes'
      ],
      relatedLinks: [
        { label: 'Site Visit Workflow Guide', url: '/guides/site-visit-workflow.md' }
      ],
      context: { page: '/projects', section: 'dashboard' }
    },
    {
      id: 'project-status-indicators',
      type: 'info',
      title: 'Project Status Indicators',
      content: 'Understanding project status and priority indicators.',
      detailedContent: 'Projects are color-coded and tagged to indicate their current status, priority level, and organizing requirements. These indicators help you prioritize your organizing activities and allocate resources effectively.',
      examples: [
        'Red border: High priority or serious compliance issues',
        'Amber border: Medium priority or monitoring required',
        'Green border: Good compliance, regular monitoring',
        'Blue border: New project or recently updated'
      ],
      context: { page: '/projects', section: 'status' }
    }
  ],

  // Employer Management
  'employer-management': [
    {
      id: 'employer-profile-overview',
      type: 'help',
      title: 'Employer Profile Overview',
      content: 'Comprehensive view of employer performance and compliance history.',
      detailedContent: 'Employer profiles aggregate data from all projects where the employer is active, including compliance ratings, payment history, safety records, and organizing intelligence. This holistic view helps identify patterns and plan strategic interventions.',
      examples: [
        'Review historical compliance trends across multiple projects',
        'Compare performance against industry benchmarks',
        'Identify organizing opportunities and risks',
        'Access contact information and key personnel details'
      ],
      relatedLinks: [
        { label: 'Employer Ratings System Guide', url: '/guides/ratings-system-v2.md' }
      ],
      context: { page: '/employers', section: 'profile' }
    },
    {
      id: 'multi-project-tracking',
      type: 'info',
      title: 'Multi-Project Employer Tracking',
      content: 'Monitoring employer performance across multiple active projects.',
      detailedContent: 'Large employers often work across multiple projects simultaneously. The system aggregates employer data across all projects to provide a comprehensive view of their overall performance and compliance patterns.',
      examples: [
        'Track compliance issues that repeat across projects',
        'Identify systemic problems versus project-specific issues',
        'Monitor workforce movement between employer projects',
        'Assess overall employer behavior and patterns'
      ],
      context: { page: '/employers', section: 'multi-project' }
    }
  ],

  // Delegate Management
  'delegate-management': [
    {
      id: 'delegate-task-assignment',
      type: 'help',
      title: 'Delegate Task Assignment',
      content: 'Assign specific monitoring tasks to union delegates for ongoing site oversight.',
      detailedContent: 'Delegates serve as the eyes and ears of the union between organizer visits. Assign them concrete, actionable tasks with clear deadlines and context. Provide proper training and support to ensure task completion.',
      examples: [
        'Monitor daily toolbox talks and safety briefings',
        'Check amenity facilities weekly and report issues',
        'Document new subcontractors and workforce changes',
        'Report safety incidents immediately',
        'Track workforce composition monthly'
      ],
      relatedLinks: [
        { label: 'Delegate Task Webform', url: '/delegate-tasks/create' },
        { label: 'Delegate Resources', url: '/guides/delegate-resources.md' }
      ],
      context: { page: '/delegate-tasks', section: 'assignment' }
    },
    {
      id: 'delegate-performance-tracking',
      type: 'info',
      title: 'Delegate Performance Tracking',
      content: 'Monitor and support delegate effectiveness in their assigned roles.',
      detailedContent: 'Regular assessment of delegate performance helps identify training needs, provide additional support, and recognize effective delegates. Track task completion rates, quality of reports, and engagement levels.',
      examples: [
        'Review task completion rates and timeliness',
        'Assess quality and detail of delegate reports',
        'Monitor delegate engagement and communication',
        'Identify delegates needing additional training or support',
        'Recognize and reward high-performing delegates'
      ],
      context: { page: '/delegate-tasks', section: 'performance' }
    }
  ],

  // Campaign Management
  'campaign-management': [
    {
      id: 'organizing-campaign-setup',
      type: 'help',
      title: 'Organizing Campaign Setup',
      content: 'Create and manage targeted organizing campaigns for specific employers or projects.',
      detailedContent: 'Campaigns provide structure for sustained organizing efforts across multiple employers, projects, or geographic areas. Set clear objectives, timelines, and success metrics to track campaign progress and effectiveness.',
      examples: [
        'Define campaign scope: employer, project, or geographic focus',
        'Set specific, measurable objectives and timelines',
        'Identify key targets and organizing opportunities',
        'Allocate resources and assign responsibilities',
        'Establish success metrics and tracking methods'
      ],
      context: { page: '/campaigns', section: 'setup' }
    },
    {
      id: 'campaign-progress-tracking',
      type: 'info',
      title: 'Campaign Progress Tracking',
      content: 'Monitor campaign advancement and measure organizing effectiveness.',
      detailedContent: 'Track key metrics including membership growth, delegate recruitment, compliance improvements, and strategic victories. Use progress data to adjust tactics and demonstrate campaign value to stakeholders.',
      examples: [
        'Monitor membership growth and recruitment rates',
        'Track delegate appointments and training completion',
        'Measure compliance improvements and violations addressed',
        'Document industrial actions and strategic victories',
        'Calculate return on investment for campaign resources'
      ],
      context: { page: '/campaigns', section: 'progress' }
    }
  ],

  // Administrative Functions
  'administrative-functions': [
    {
      id: 'user-role-management',
      type: 'help',
      title: 'User Role Management',
      content: 'Assign and manage user roles and permissions across the platform.',
      detailedContent: 'User roles determine access levels and functional permissions. Assign appropriate roles based on job responsibilities and organizational structure. Regular review of role assignments ensures security and compliance with data access policies.',
      examples: [
        'Admin: Full system access and user management',
        'Lead Organiser: Multi-patch oversight and reporting',
        'Organiser: Assigned patch access and field operations',
        'Delegate: Limited employer access and task management',
        'Viewer: Read-only access for specific data'
      ],
      context: { page: '/admin', section: 'user-roles' }
    },
    {
      id: 'system-analytics-dashboard',
      type: 'info',
      title: 'System Analytics Dashboard',
      content: 'Monitor platform usage, performance metrics, and organizing effectiveness.',
      detailedContent: 'Analytics provide insights into system utilization, user engagement, and organizing outcomes. Use this data to identify training needs, optimize workflows, and demonstrate platform value to leadership and stakeholders.',
      examples: [
        'Track user engagement and feature adoption rates',
        'Monitor organizing metrics and campaign effectiveness',
        'Analyze system performance and usage patterns',
        'Generate reports for leadership and stakeholder updates',
        'Identify trends and opportunities for improvement'
      ],
      context: { page: '/admin', section: 'analytics' }
    }
  ],

  // Coordinator Console
  'coordinator-console': [
    {
      id: 'multi-patch-oversight',
      type: 'help',
      title: 'Multi-Patch Oversight',
      content: 'Comprehensive view of organizing activities across multiple geographic patches.',
      detailedContent: 'The coordinator console provides aggregated insights from multiple patches, enabling strategic oversight and resource allocation. Monitor performance trends, identify best practices, and coordinate cross-patch initiatives.',
      examples: [
        'Compare organizing metrics across different patches',
        'Identify high-performing areas and successful strategies',
        'Coordinate multi-patch campaigns and initiatives',
        'Allocate resources based on need and opportunity',
        'Monitor organizer performance and workload distribution'
      ],
      context: { page: '/lead', section: 'oversight' }
    },
    {
      id: 'strategic-planning-tools',
      type: 'info',
      title: 'Strategic Planning Tools',
      content: 'Advanced tools for long-term organizing strategy and resource planning.',
      detailedContent: 'Use data-driven insights to develop comprehensive organizing strategies, set realistic targets, and plan resource allocation. Coordinate with other coordinators to align regional and national organizing objectives.',
      examples: [
        'Analyze market trends and organizing opportunities',
        'Develop long-term organizing strategies and timelines',
        'Plan resource allocation and organizer assignments',
        'Coordinate with other regions for consistency',
        'Set performance targets and success metrics'
      ],
      context: { page: '/lead', section: 'planning' }
    }
  ]
}

/**
 * Get help configurations for a specific page/section
 */
export function getHelpConfigurations(pageKey: string, section?: string): HelpTooltipConfig[] {
  const pageConfigs = CONTEXTUAL_HELP_CONFIGS[pageKey] || []

  if (section) {
    // Filter by section if provided
    return pageConfigs.filter(config =>
      config.context?.section === section || !config.context?.section
    )
  }

  return pageConfigs
}

/**
 * Get specific help configuration by ID
 */
export function getHelpConfigById(id: string): HelpTooltipConfig | undefined {
  for (const pageConfigs of Object.values(CONTEXTUAL_HELP_CONFIGS)) {
    const config = pageConfigs.find(c => c.id === id)
    if (config) return config
  }
  return undefined
}

/**
 * Page key mappings for route-based help lookup
 */
export const PAGE_ROUTE_MAPPINGS: Record<string, string> = {
  '/site-visit-wizard': 'site-visit-wizard',
  '/mobile/ratings/wizard': 'mobile-ratings-wizard',
  '/mobile/ratings': 'mobile-ratings-wizard',
  '/mobile/map/discovery': 'mobile-map-discovery',
  '/mobile': 'mobile-pwa-features',
  '/mobile/dashboard': 'mobile-pwa-features',
  '/mobile/projects': 'mobile-pwa-features',
  '/projects/[projectId]/mapping': 'project-mapping',
  '/projects/[projectId]/compliance': 'compliance-auditing',
  '/projects': 'project-overview',
  '/employers': 'employer-management',
  '/delegate-tasks': 'delegate-management',
  '/campaigns': 'campaign-management',
  '/guide': 'user-guide',
  '/admin': 'administrative-functions',
  '/lead': 'coordinator-console'
}