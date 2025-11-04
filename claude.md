# CFMEU NSW Construction Union Organising Database - Development Guide

## Project Overview

This is a comprehensive organising database for the CFMEU NSW construction union that tracks construction projects, employers, compliance status, and organising activities. The system supports 30-50 users (organisers, lead organisers, and administrators) with a primary focus on mobile-first experience for field organisers.

### Core Purpose
The system helps organisers answer critical questions about their geographic areas:
- What projects are in my geographic area?
- Who is the builder on each project?
- Do they have an EBA (Enterprise Bargaining Agreement)?
- Are they compliant?
- Who are the key trade employers on those projects?
- Are they compliant (tracked through traffic light rating system)?

### Primary User Workflows
1. **Project Mapping** - Identifying employers, delegates, and workers on construction sites
2. **Compliance Auditing** - Recording audit outcomes and tracking compliance status
3. **Delegate Coordination** - Assigning tasks to union delegates for assistance
4. **Geographic Navigation** - Finding and navigating to nearby projects

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS v4
- **Backend**: Next.js serverless functions + Express.js workers
- **Database**: Supabase (PostgreSQL with PostgREST, RLS, spatial data)
- **Mobile**: Responsive design with dedicated mobile routes at `/mobile`
- **Testing**: Playwright E2E testing with comprehensive mobile device coverage
- **Deployment**: Vercel (main app) + Railway.app (background workers)

### Multi-Service Architecture
```
├── Main Next.js App (Vercel)
├── Dashboard Worker (Railway) - Caching & background processing
├── Scraper Worker (Railway) - FWC/Incolink data collection
├── Mapping Sheet Scanner (Railway) - AI PDF processing
└── BCI Import Worker (Railway) - Excel file processing
```

## Critical Development Priorities

### 1. Mobile-First Development (CRITICAL)
- **Primary users**: Organisers using iPhone 13+ models
- **Field use**: Real-world construction site environments
- **Common issues**: Form field overflow, poorly rendering labels, text overlapping screens
- **Navigation challenges**: Complex nested menus make retracing steps difficult

#### Mobile Development Guidelines
- **Always test on actual mobile devices**, not just browser dev tools
- **Use responsive design patterns** (`sm:`, `md:`, `lg:` breakpoints consistently)
- **Implement proper mobile form inputs** (numeric keyboards for numbers, etc.)
- **Add mobile-aware functionality**:
  - Click-to-call phone numbers
  - Direction lookups via Google Maps
  - Geo-location for nearby projects
  - Properly sized touch targets
- **Test form rendering thoroughly** - labels, placeholders, validation messages
- **Ensure navigation breadcrumbs work well** on mobile screens

### 2. Data Consistency & Accuracy (CRITICAL)
The system has complex overlapping data relationships that require careful handling:

#### Key Data Relationships
```
Projects ↔ Job Sites (1:many)
Projects ↔ Employers (via project_employer_roles)
Employers ↔ Job Sites (via site_employers)
Patches ↔ Projects/Job Sites (geographic assignment)
Users ↔ Pending Users (organisers without accounts)
```

#### Data Consistency Rules
- **Real-time updates required** for user-entered data
- **Eventual consistency acceptable** for aggregated data (counts, ratios)
- **Cross-service data sync** must be immediate (e.g., Incolink scrape results)
- **Clear data source hierarchy** when duplicates exist

### 3. Performance with Large Datasets
- **Materialized views** for complex queries (`patch_project_mapping_view`, etc.)
- **Server-side filtering** and pagination
- **Lazy loading** for large employer/project lists
- **Optimized queries** with proper indexing
- **Caching strategy** for dashboard metrics

## Database Schema Deep Dive

### Core Tables & Relationships
```sql
profiles (users) - role: admin|lead_organiser|organiser|delegate|viewer
projects - value, stage, organizing_universe, geographic data
job_sites - specific construction locations with PostGIS geometry
employers - ABN, contact info, Incolink integration
patches - geographic organizing areas with spatial data
project_employer_roles - builder|head_contractor|project_manager roles
site_employers - employer presence at specific sites
```

### User Roles & Permissions (ROW LEVEL SECURITY)
- **admin**: Full system access
- **lead_organiser**: Senior organisers with patch leadership responsibilities
- **organiser**: Field organisers limited to assigned patches
- **delegate**: Union representatives with limited employer access
- **viewer**: Read-only access

#### Critical Permission Logic
- Organisers can only access data in their assigned patches
- Lead organisers can access data from patches they lead
- Admins can access all data
- **Always verify permissions at the database level via RLS policies**

### Key Enums & Business Logic
```sql
project_stage_class: 'future'|'pre_construction'|'construction'|'archived'
project_role: 'head_contractor'|'contractor'|'trade_subcontractor'|'builder'|'project_manager'
traffic_light_rating: 'red'|'amber'|'green'
eba_status: 'yes'|'no'|'pending'
union_membership_status: 'member'|'non_member'|'potential'|'declined'
```

## Development Patterns & Guidelines

### Mobile Development Patterns
```typescript
// ✅ GOOD: Mobile-first responsive design
<div className="space-y-4 px-4 py-4 pb-safe-bottom">
  <Card className="w-full max-w-md mx-auto">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg">Title</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      {/* Form fields with proper spacing */}
    </CardContent>
  </Card>
</div>

// ❌ AVOID: Fixed widths that don't adapt
<div className="w-[600px]">
  {/* This will overflow on mobile */}
</div>
```

### Data Access Patterns
```typescript
// ✅ GOOD: Server-side filtering with user permissions
const { data: projects } = useQuery({
  queryKey: ['user-projects', user.id, patchIds],
  queryFn: () => getProjectsForUser({ userId: user.id, patchIds })
})

// ❌ AVOID: Client-side filtering of large datasets
const allProjects = await getAllProjects() // Bad: loads too much data
const userProjects = allProjects.filter(p => user.patchIds.includes(p.patchId))
```

### Form Handling Patterns
```typescript
// ✅ GOOD: Mobile-optimized forms with proper validation
<form onSubmit={handleSubmit} className="space-y-4">
  <div>
    <Label htmlFor="phone" className="text-sm font-medium">Phone</Label>
    <Input
      id="phone"
      type="tel"
      placeholder="Enter phone number"
      className="w-full"
      {...register('phone', { required: true })}
    />
    {errors.phone && (
      <p className="text-sm text-red-600 mt-1">{errors.phone.message}</p>
    )}
  </div>
</form>
```

## Key Workflows & Critical Components

### 1. Project Mapping Workflow
**Route**: `/projects/[projectId]/mapping`
**Purpose**: Core organising activity - mapping employers, delegates, workers on site
**Mobile Requirements**:
- Easy data entry on construction sites
- Photo upload capabilities
- Offline resilience

### 2. Compliance Auditing Workflow
**Route**: `/projects/[projectId]/compliance`
**Purpose**: Audit compliance and track via traffic light system
**Critical Features**:
- Real-time form submission
- Progress saving
- Delegate task assignment

### 3. Geographic Project Discovery
**Route**: `/dashboard` with map integration
**Purpose**: Find projects in organiser's geographic area
**Mobile Features**:
- GPS integration for nearby projects
- Click-to-navigate functionality
- Offline map caching

### 4. Delegate Task Management
**Route**: Webform sharing system
**Purpose**: Assign audit tasks to union delegates
**Requirements**:
- Simple, intuitive webforms
- Mobile-optimized delegate experience
- Real-time task status updates

## Common Development Pitfalls

### 1. Mobile/Desktop Disconnect
**Problem**: Features work on desktop but fail on mobile
**Solution**:
- Always test on actual mobile devices
- Use Playwright mobile testing scripts
- Implement responsive design from the start

### 2. Data Source Confusion
**Problem**: Unclear which data source to use for overlapping entities
**Solution**:
- Use `job_sites` for specific construction locations
- Use `projects` for overall project management
- Use `site_employers` for employer presence at sites
- Use `project_employer_roles` for formal project roles

### 3. Permission Bypass Issues
**Problem**: Frontend shows data user shouldn't access
**Solution**:
- Always enforce permissions at database level via RLS
- Never rely on frontend permissions alone
- Test with different user roles

### 4. Form Rendering Issues
**Problem**: Labels overflow, text overlaps on mobile
**Solution**:
- Use proper responsive typography
- Test form layouts on smallest target device (iPhone 13)
- Implement proper text wrapping and truncation

## Testing Guidelines

### Mobile Testing Commands
```bash
# Run all mobile tests
npm run test:mobile

# Run specific mobile device tests
npm run test:mobile:iphone

# Debug mobile tests with browser
npm run test:mobile:headed

# Check mobile testing setup
npm run test:mobile:check
```

### Required Mobile Tests
- **Navigation flow**: Can users move between key screens?
- **Form rendering**: Do all forms display properly on mobile?
- **Data entry**: Can users enter data effectively on mobile?
- **Map functionality**: Do location-based features work?

## Environment Setup

### Local Development
```bash
# Start all services (main app + workers)
npm run dev:all          # Linux/Windows
npm run dev:all:mac      # macOS

# Start individual services
npm run dev:app          # Main Next.js app
npm run worker:dashboard:dev    # Dashboard worker
npm run worker:scraper:dev      # Scraper worker
npm run worker:scanner:dev      # PDF scanner worker
```

### Environment Variables
Critical variables for development:
```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Integration Points

### External Systems
- **Incolink**: Member data and payment history
- **FWC**: Enterprise agreement tracking
- **Google Maps**: Project location and navigation
- **AI Services**: PDF processing and data extraction

### Background Workers
- **Dashboard Worker**: Caches metrics and aggregates data
- **Scraper Worker**: Collects data from external APIs
- **Scanner Worker**: Processes uploaded PDF documents
- **BCI Worker**: Normalizes imported Excel files

## User Experience Principles

### For Organisers (Primary Users)
- **Low technical literacy**: Keep interfaces simple and intuitive
- **Field-based work**: Design for outdoor/construction site environments
- **Task-focused**: Optimize for mapping and auditing workflows
- **Real-time expectations**: Immediate updates for user-entered data

### Navigation Best Practices
- Provide clear breadcrumbs for complex workflows
- Minimize nested menus on mobile
- Use consistent navigation patterns
- Enable easy back-and-forth movement between related screens

## Code Style & Patterns

### TypeScript Patterns
- Use strict type checking
- Define interfaces for all API responses
- Leverage database-generated types where possible

### React Patterns
- Use server components for data fetching
- Implement proper error boundaries
- Use React Query for server state management
- Implement proper loading states

### CSS/Tailwind Patterns
- Use responsive utilities consistently
- Implement proper spacing with `space-y-*` classes
- Use semantic color variables
- Follow mobile-first responsive design

## Security Considerations

### Data Access
- **External security**: High - prevent unauthorized access outside user base
- **Internal restrictions**: Medium - limit organisers to their geographic areas
- **Data integrity**: High - validate all user inputs and enforce business rules

### Permission Enforcement
- Always use Row Level Security (RLS) policies
- Validate user permissions in API routes
- Implement proper audit trails for sensitive operations
- Test with different user roles

This guide should be updated as the system evolves and new patterns emerge. Always prioritize the mobile organiser experience and data consistency in development decisions.