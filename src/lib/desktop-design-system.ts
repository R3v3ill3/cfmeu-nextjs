/**
 * Desktop Design System Utilities
 * 
 * This file provides desktop-specific design tokens and helper functions
 * that create a Salesforce-inspired experience while preserving mobile functionality.
 * 
 * Usage: Import these utilities in desktop-specific components to override
 * mobile styling with enhanced desktop layouts and visual hierarchy.
 */

// Desktop-specific color tokens with improved contrast
export const desktopColors = {
  background: 'var(--desktop-background)',
  foreground: 'var(--desktop-foreground)',
  card: 'var(--desktop-card-background)',
  border: 'var(--desktop-border)',
  accent: 'var(--desktop-accent)',
  primary: 'var(--desktop-primary)',
  primaryForeground: 'var(--desktop-primary-foreground)',
  secondary: 'var(--desktop-secondary)',
  muted: 'var(--desktop-muted)',
  accentForeground: 'var(--desktop-accent-foreground)',
} as const;

// Desktop-specific spacing tokens
export const desktopSpacing = {
  xs: 'var(--desktop-spacing-xs)',
  sm: 'var(--desktop-spacing-sm)',
  md: 'var(--desktop-spacing-md)',
  lg: 'var(--desktop-spacing-lg)',
  xl: 'var(--desktop-spacing-xl)',
  '2xl': 'var(--desktop-spacing-2xl)',
} as const;

// Desktop-specific typography tokens
export const desktopTypography = {
  xs: 'var(--desktop-text-xs)',
  sm: 'var(--desktop-text-sm)',
  base: 'var(--desktop-text-base)',
  lg: 'var(--desktop-text-lg)',
  xl: 'var(--desktop-text-xl)',
  '2xl': 'var(--desktop-text-2xl)',
  '3xl': 'var(--desktop-text-3xl)',
} as const;

// Desktop-specific shadow tokens with enhanced depth
export const desktopShadows = {
  sm: 'var(--desktop-shadow-sm)',
  md: 'var(--desktop-shadow-md)',
  lg: 'var(--desktop-shadow-lg)',
  xl: 'var(--desktop-shadow-xl)',
} as const;

// Desktop-specific layout utilities
export const desktopLayout = {
  // Container widths optimized for desktop
  container: 'max-w-7xl mx-auto px-6',
  containerWide: 'max-w-full mx-auto px-8',
  containerNarrow: 'max-w-4xl mx-auto px-6',
  
  // Grid layouts optimized for desktop
  gridCols: {
    '2': 'grid-cols-1 lg:grid-cols-2',
    '3': 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3',
    '4': 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-4',
    '5': 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5',
    '6': 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6',
  },
  
  // Sidebar and main content layout
  sidebarLayout: 'flex min-h-screen',
  sidebarWidth: 'w-64 flex-shrink-0',
  sidebarWidthCollapsed: 'w-16 flex-shrink-0',
  mainContent: 'flex-1 min-w-0',
  
  // Card layouts optimized for desktop
  cardGrid: 'grid gap-6',
  cardGridTight: 'grid gap-4',
  cardGridWide: 'grid gap-8',
} as const;

// Desktop-specific component variants with improved contrast
export const desktopComponents = {
  // Enhanced card styling for desktop with better contrast
  card: {
    base: 'bg-white border border-gray-300 rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200',
    elevated: 'bg-white border border-gray-300 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-200',
    interactive: 'bg-white border border-gray-300 rounded-lg shadow-md hover:shadow-lg hover:border-gray-400 transition-all duration-200 cursor-pointer',
  },
  
  // Enhanced button styling for desktop
  button: {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-md transition-colors duration-200',
    secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900 font-medium px-4 py-2 rounded-md transition-colors duration-200',
    outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-md transition-colors duration-200',
  },
  
  // Enhanced table styling for desktop with better contrast
  table: {
    container: 'bg-white border border-gray-300 rounded-lg shadow-md overflow-hidden',
    header: 'bg-gray-100 border-b border-gray-300 px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider',
    row: 'border-b border-gray-200 hover:bg-gray-50 transition-colors duration-150',
    cell: 'px-6 py-4 text-sm text-gray-900',
  },
  
  // Enhanced navigation styling for desktop
  nav: {
    item: 'flex items-center px-3 py-2 text-sm font-medium text-gray-800 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors duration-150',
    itemActive: 'flex items-center px-3 py-2 text-sm font-medium text-blue-800 bg-blue-100 rounded-md border border-blue-300 shadow-md',
    group: 'space-y-1',
    groupLabel: 'px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wider',
  },
} as const;

// Utility function to apply desktop-specific classes
export function desktopClass(baseClass: string, desktopClass: string): string {
  return `${baseClass} lg:${desktopClass}`;
}

// Utility function to create responsive desktop layouts
export function createDesktopLayout(mobileClasses: string, desktopClasses: string): string {
  return `${mobileClasses} lg:${desktopClasses}`;
}

// Utility function to apply desktop-specific styles conditionally
export function getDesktopStyles(isDesktop: boolean, desktopStyles: string, mobileStyles: string): string {
  return isDesktop ? desktopStyles : mobileStyles;
}

// Desktop-specific breakpoint utilities
export const desktopBreakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px', // Desktop starts here
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Export all utilities as a single object for easy importing
export const desktopDesignSystem = {
  colors: desktopColors,
  spacing: desktopSpacing,
  typography: desktopTypography,
  shadows: desktopShadows,
  layout: desktopLayout,
  components: desktopComponents,
  breakpoints: desktopBreakpoints,
  utilities: {
    desktopClass,
    createDesktopLayout,
    getDesktopStyles,
  },
} as const;
