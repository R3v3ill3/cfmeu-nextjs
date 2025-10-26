/**
 * Test data fixtures for mobile testing of CFMEU Next.js application
 */

export const testUsers = {
  admin: {
    email: 'admin@cfmeu-test.com',
    password: 'TestAdmin123!',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  },
  organizer: {
    email: 'organizer@cfmeu-test.com',
    password: 'TestOrganizer123!',
    firstName: 'Organizer',
    lastName: 'User',
    role: 'organizer'
  },
  member: {
    email: 'member@cfmeu-test.com',
    password: 'TestMember123!',
    firstName: 'Member',
    lastName: 'User',
    role: 'member'
  }
};

export const testEmployers = [
  {
    id: 1,
    name: 'Construction Solutions Ltd',
    abn: '12345678901',
    address: '123 Construction St, Melbourne VIC 3000',
    phone: '03-1234-5678',
    email: 'contact@construction-solutions.com',
    website: 'https://construction-solutions.com'
  },
  {
    id: 2,
    name: 'BuildRight Contractors',
    abn: '98765432109',
    address: '456 Builder Ave, Sydney NSW 2000',
    phone: '02-9876-5432',
    email: 'info@buildright.com.au',
    website: 'https://buildright.com.au'
  },
  {
    id: 3,
    name: 'Heritage Construction',
    abn: '45678901234',
    address: '789 Heritage Rd, Brisbane QLD 4000',
    phone: '07-4567-8901',
    email: 'projects@heritage-construction.com.au',
    website: 'https://heritage-construction.com.au'
  }
];

export const testProjects = [
  {
    id: 1,
    name: 'Melbourne Office Tower',
    address: '50 Bourke St, Melbourne VIC 3000',
    client: 'Construction Solutions Ltd',
    status: 'active',
    startDate: '2024-01-15',
    expectedCompletion: '2024-12-15',
    description: 'Commercial office building project with 20 floors'
  },
  {
    id: 2,
    name: 'Sydney Residential Complex',
    address: '200 George St, Sydney NSW 2000',
    client: 'BuildRight Contractors',
    status: 'planning',
    startDate: '2024-03-01',
    expectedCompletion: '2025-06-30',
    description: 'Mixed-use residential development with 150 units'
  },
  {
    id: 3,
    name: 'Brisbane Hospital Extension',
    address: '1 Hospital Rd, Brisbane QLD 4000',
    client: 'Heritage Construction',
    status: 'completed',
    startDate: '2023-06-01',
    expectedCompletion: '2024-02-28',
    description: 'Hospital expansion with new emergency ward'
  }
];

export const testScans = [
  {
    id: 1,
    projectId: 1,
    fileName: 'melbourne-tower-scan.pdf',
    uploadDate: '2024-01-20',
    status: 'processed',
    totalRows: 150,
    matchedRows: 120,
    unmatchedRows: 30
  },
  {
    id: 2,
    projectId: 2,
    fileName: 'sydney-complex-scan.xlsx',
    uploadDate: '2024-02-15',
    status: 'processing',
    totalRows: 200,
    matchedRows: 0,
    unmatchedRows: 200
  },
  {
    id: 3,
    projectId: 3,
    fileName: 'brisbane-hospital-scan.csv',
    uploadDate: '2023-12-10',
    status: 'reviewed',
    totalRows: 75,
    matchedRows: 70,
    unmatchedRows: 5
  }
];

export const testEmployerAliases = [
  {
    id: 1,
    employerId: 1,
    aliasName: 'Constructions Solutions PTY',
    isPrimary: false
  },
  {
    id: 2,
    employerId: 1,
    aliasName: 'CSL Construction',
    isPrimary: false
  },
  {
    id: 3,
    employerId: 2,
    aliasName: 'Build Right Pty Ltd',
    isPrimary: false
  }
];

export const mobileTestRoutes = [
  { path: '/', name: 'Home', description: 'Main dashboard/homepage' },
  { path: '/employers', name: 'Employers', description: 'Employer management page' },
  { path: '/projects', name: 'Projects', description: 'Projects listing page' },
  { path: '/map', name: 'Map', description: 'Interactive map view' },
  { path: '/activities', name: 'Activities', description: 'Activities and events page' },
  { path: '/campaigns', name: 'Campaigns', description: 'Campaign management' },
  { path: '/workers', name: 'Workers', description: 'Worker management page' },
  { path: '/site-visits', name: 'Site Visits', description: 'Site visit scheduling' },
  { path: '/lead', name: 'Lead Management', description: 'Lead tracking system' },
  { path: '/eba-tracking', name: 'EBA Tracking', description: 'Enterprise agreement tracking' },
  { path: '/patch', name: 'Patch Management', description: 'Patch management system' },
  { path: '/settings', name: 'Settings', description: 'Application settings' }
];

export const projectDetailRoutes = testProjects.map(project => ({
  path: `/projects/${project.id}`,
  name: project.name,
  projectId: project.id
}));

export const scanReviewRoutes = testScans.map(scan => ({
  path: `/projects/${scan.projectId}/scan-review/${scan.id}`,
  name: `Scan Review: ${scan.fileName}`,
  projectId: scan.projectId,
  scanId: scan.id
}));

export const touchTargetTests = [
  {
    selector: 'button, [role="button"]',
    name: 'Buttons',
    minSize: 44,
    description: 'All buttons should have minimum 44x44px touch targets'
  },
  {
    selector: 'a[href]',
    name: 'Links',
    minSize: 44,
    description: 'All links should have minimum 44x44px touch targets'
  },
  {
    selector: 'input, textarea, select',
    name: 'Form Inputs',
    minSize: 48,
    description: 'Form inputs should have minimum 48x48px touch targets'
  },
  {
    selector: '[data-testid="mobile-nav-item"]',
    name: 'Navigation Items',
    minSize: 44,
    description: 'Mobile navigation items should be easily tappable'
  }
];

export const accessibilityTests = [
  {
    name: 'Color Contrast',
    description: 'Text should have sufficient color contrast',
    test: 'contrast'
  },
  {
    name: 'Alt Text',
    description: 'Images should have descriptive alt text',
    test: 'alt-text'
  },
  {
    name: 'Form Labels',
    description: 'Form inputs should have proper labels',
    test: 'form-labels'
  },
  {
    name: 'Heading Structure',
    description: 'Proper heading hierarchy should be maintained',
    test: 'headings'
  },
  {
    name: 'Focus Management',
    description: 'Keyboard navigation should be logical',
    test: 'focus-order'
  }
];

export const performanceMetrics = {
  loadTime: {
    good: 2000,
    needsImprovement: 4000,
    poor: 6000
  },
  firstContentfulPaint: {
    good: 1000,
    needsImprovement: 2500,
    poor: 4000
  },
  largestContentfulPaint: {
    good: 2500,
    needsImprovement: 4000,
    poor: 6000
  }
};

export const networkConditions = {
  'slow3g': {
    downloadThroughput: 500 * 1024 / 8, // 500 Kbps
    uploadThroughput: 500 * 1024 / 8,   // 500 Kbps
    latency: 400,
    description: 'Simulates slow 3G network conditions'
  },
  'fast3g': {
    downloadThroughput: 1.6 * 1024 * 1024 / 8, // 1.6 Mbps
    uploadThroughput: 750 * 1024 / 8,           // 750 Kbps
    latency: 150,
    description: 'Simulates fast 3G network conditions'
  },
  '4g': {
    downloadThroughput: 9 * 1024 * 1024 / 8,    // 9 Mbps
    uploadThroughput: 1.5 * 1024 * 1024 / 8,    // 1.5 Mbps
    latency: 20,
    description: 'Simulates 4G network conditions'
  }
};

export const testFormData = {
  employer: {
    name: 'Test Construction Company',
    abn: '12345678901',
    address: '123 Test Street, Melbourne VIC 3000',
    phone: '03-1234-5678',
    email: 'test@construction.com',
    website: 'https://test-construction.com'
  },
  project: {
    name: 'Mobile Test Project',
    address: '456 Test Ave, Sydney NSW 2000',
    client: 'Test Construction Company',
    description: 'Test project for mobile testing',
    startDate: '2024-03-01',
    expectedCompletion: '2024-12-01'
  },
  scan: {
    file: 'test-spreadsheet.xlsx',
    description: 'Test scan file for mobile testing'
  }
};

export const mobileBreakpoints = {
  'iphone-se': { width: 375, height: 667 },
  'iphone-12': { width: 390, height: 844 },
  'iphone-12-pro-max': { width: 428, height: 926 },
  'iphone-14': { width: 390, height: 844 },
  'iphone-14-pro': { width: 393, height: 852 },
  'iphone-14-pro-max': { width: 430, height: 932 },
  'iphone-15': { width: 393, height: 852 },
  'iphone-15-plus': { width: 430, height: 932 },
  'iphone-15-pro': { width: 393, height: 852 },
  'iphone-15-pro-max': { width: 430, height: 932 }
};