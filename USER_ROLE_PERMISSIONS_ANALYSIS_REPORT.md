# CFMEU Organiser Database - User Role & Permissions Analysis Report

## Executive Summary

This comprehensive analysis examines the application of user roles and permissions across all pages and components from an organiser's perspective. The system demonstrates sophisticated role-based access control with robust authentication infrastructure, but reveals critical gaps in default filtering behavior that impact user experience for field organisers.

**Key Finding**: The system has excellent security infrastructure but inconsistent application of organiser-centric default filtering across different functional areas.

## Analysis Scope & Methodology

Multiple specialized agents analyzed:
- Authentication & role management system
- Dashboard pages and filtering logic
- Projects pages and patch-based filtering
- Employers pages and access patterns
- EBA Employers and universal access
- Map component geographic filtering
- Mobile-first responsiveness across all components

## Current State Analysis

### ✅ **AREAS WORKING CORRECTLY**

#### 1. Authentication & Role Management
- **Sophisticated 5-tier role hierarchy**: admin > lead_organiser > organiser > delegate > viewer
- **Robust patch assignment system** with temporal effectiveness tracking
- **Database-level Row Level Security (RLS)** preventing unauthorized data access
- **Pending user activation system** with automated role assignment
- **Hierarchical team visibility** (organisers can see peers under same lead)

#### 2. Dashboard Filtering
- **Properly defaults to organiser's assigned patches**
- **Three-tier permission structure** enforced at database level
- **Mobile-optimized experience** with dedicated components
- **Real-time metrics** with immediate updates for user-entered data
- **Team data visibility** appropriately restricted based on hierarchy

#### 3. Mobile Experience
- **Industry-leading mobile implementation** (9/10 maturity score)
- **Comprehensive iPhone support** with Dynamic Island optimization
- **Safe area handling** and touch-optimized interfaces
- **Offline functionality** for construction site environments
- **Field workflow optimization** with camera and GPS integration

#### 4. EBA Employers Access
- **Correctly implements requirement** - everyone sees everything
- **No geographic restrictions** as specified
- **Consistent across mobile and desktop** interfaces

### ❌ **CRITICAL GAPS IDENTIFIED**

#### 1. Projects Pages
**Issue**: No default patch filtering for organisers
- **Projects list** shows ALL projects regardless of organiser assignments
- **Individual project pages** accessible regardless of patch boundaries
- **Security concern**: Organisers can access projects outside their geographic areas

**Impact**: Field organisers see irrelevant data from across NSW rather than focusing on their assigned areas

#### 2. Employers Pages
**Issue**: Missing default patch filtering with full access capability
- **Shows all employers by default** instead of organiser's assigned patches
- **Requirement conflict**: Should default to patch-filtered but allow full access
- **Current implementation**: Full access without default filtering

**Impact**: Organisers miss relevant employers in their patches while seeing potentially irrelevant employers across the state

#### 3. Map Component
**Issue**: No automatic geographic filtering
- **Shows all NSW patches by default** instead of user's assigned area
- **No auto-focus** on organiser's geographic area
- **Requires manual patch selection** for relevant viewing

**Impact**: Poor user experience requiring manual filtering to see relevant geographic data

## Detailed Requirements vs Current State

| Component | Requirement | Current State | Gap |
|-----------|-------------|---------------|-----|
| **Dashboard** | Default to organiser patches | ✅ Implemented | None |
| **Projects** | Default to organiser patches | ❌ Shows all projects | Critical |
| **Employers** | Default to patches, allow all access | ❌ Shows all by default | Critical |
| **EBA Employers** | Everyone sees everything | ✅ Implemented | None |
| **Map** | Default to organiser patches | ❌ Shows all patches | Critical |

## Technical Infrastructure Assessment

### **Strengths**
1. **Robust Patch Assignment System**: Temporal patch assignments with proper hierarchy
2. **Database-Level Security**: RLS policies enforce access control
3. **Performance Optimization**: Materialized views and efficient queries
4. **Mobile Architecture**: Dedicated mobile components with advanced device support
5. **Authentication Flow**: Secure PKCE implementation with role management

### **Weaknesses**
1. **Inconsistent Default Filtering**: Security model not reflected in UI defaults
2. **Component Fragmentation**: Mixed use of mobile vs responsive patterns
3. **Access Control Gaps**: URL-based access bypasses intended restrictions

## Implementation Recommendations

### **Phase 1: Critical Security & UX Fixes (Immediate)**

#### 1. Projects Default Filtering
**Priority**: Critical
**Implementation**:
```typescript
// src/app/(app)/projects/page.tsx
const { data: userPatches } = useAccessiblePatches(user.id);
const defaultPatchIds = userPatches?.map(p => p.id) || [];

// Apply default filtering unless URL overrides
const patchIds = searchParams.get('patch')
  ? searchParams.get('patch').split(',')
  : defaultPatchIds;
```

**API Enhancement**:
- Add permission checks to individual project pages
- Implement patch-based access control for project details
- Add audit logging for cross-patch access

#### 2. Employers Default Filtering
**Priority**: Critical
**Implementation**:
```typescript
// src/app/api/employers/route.ts
// Add default patch filtering logic
const { patches: userPatches, role } = await getUserAccessiblePatches(supabase, user.id);
const patchIds = showAll ? [] : userPatches.map(p => p.id);

// Filter employers via project relationships
if (patchIds.length > 0) {
  const projectIds = await getProjectIdsForPatches(supabase, patchIds);
  query = query.in('project_ids', projectIds);
}
```

**UI Enhancement**:
- Add "Show All Employers" toggle for organiser flexibility
- Display filter context: "Showing employers in My Patches (3)"
- Maintain search and filtering capabilities

#### 3. Map Default Filtering
**Priority**: High
**Implementation**:
```typescript
// src/components/map/InteractiveMap.tsx & MobileMap.tsx
const { data: userPatches } = useAccessiblePatches(userId);
const defaultPatchIds = userPatches?.map(p => p.id) || [];

const selectedPatchIds = useMemo(() => {
  const urlPatchIds = getPatchIdsFromURL();
  return urlPatchIds.length > 0 ? urlPatchIds : defaultPatchIds;
}, [defaultPatchIds]);
```

**Enhancement**:
- Auto-focus map on user's assigned patches
- Add "View All Patches" toggle
- Implement geographic bounds calculation for auto-zoom

### **Phase 2: User Experience Enhancement (Short-term)**

#### 1. Consistent Filter Indicators
- **Filter Context Display**: Always show current filtering scope
- **Filter Persistence**: Remember user's filter preferences
- **Visual Feedback**: Clear indication of default vs expanded views

#### 2. Team Data Visibility
- **Peer Access Toggle**: Allow organisers to view team data when needed
- **Lead Dashboard Enhancement**: Better visibility into team member activities
- **Permission Escalation**: Temporary access requests with approval workflow

#### 3. Mobile Workflow Optimization
- **Quick Actions**: Add common tasks to mobile dashboards
- **Offline Enhancement**: Better data caching for field use
- **Touch Optimization**: Ensure all interactive elements meet 44px minimum

### **Phase 3: Advanced Features (Medium-term)**

#### 1. Intelligent Recommendations
- **Suggested Projects**: Recommend projects in organiser's area needing attention
- **Employer Insights**: Highlight employers in patches requiring engagement
- **Compliance Focus**: Direct attention to compliance issues in assigned areas

#### 2. Advanced Analytics
- **Patch Performance Metrics**: Comparative analysis across patches
- **Team Productivity**: Lead organiser visibility into team effectiveness
- **Geographic Heatmaps**: Visual representation of activities by area

#### 3. Integration Enhancements
- **External Data Sync**: Better integration with FWC and Incolink data
- **Automated Alerts**: Notify organisers of relevant changes in their patches
- **Workflow Automation**: Streamline common organising tasks

## Security & Compliance Considerations

### **Data Access Principles**
1. **Default to Least Privilege**: Organisers see only their assigned data by default
2. **Explicit Override**: Users must explicitly choose to see expanded data
3. **Audit Trail**: Log all access to data outside user's assigned patches
4. **Role Enforcement**: Maintain database-level security regardless of UI changes

### **Privacy Requirements**
- **Geographic Data**: Protect location information for sensitive projects
- **Worker Information**: Maintain appropriate access controls for personal data
- **Organiser Privacy**: Balance transparency with privacy for team members

## Implementation Roadmap

### **Week 1-2: Critical Fixes**
- [ ] Projects default patch filtering
- [ ] Individual project access control
- [ ] Employers default filtering with show-all toggle
- [ ] Map auto-focus on user patches

### **Week 3-4: UX Enhancement**
- [ ] Filter context indicators
- [ ] Mobile workflow improvements
- [ ] Team visibility features
- [ ] Filter persistence

### **Month 2: Advanced Features**
- [ ] Recommendation engine
- [ ] Analytics dashboard
- [ ] Integration improvements
- [ ] Performance optimization

### **Month 3: Polish & Testing**
- [ ] Comprehensive testing across all roles
- [ ] Mobile device testing
- [ ] Performance validation
- [ ] User training materials

## Success Metrics

### **User Experience Metrics**
- **Reduced Time to Relevant Data**: Organisers find their projects/employers faster
- **Increased Mobile Engagement**: Higher usage of mobile features in field
- **Improved Task Completion**: Better completion rates for core workflows

### **System Metrics**
- **Reduced Data Load**: Default filtering reduces initial payload sizes
- **Improved Performance**: Faster page loads with filtered datasets
- **Enhanced Security**: Proper access control across all components

### **Business Impact**
- **Field Efficiency**: Organisers spend more time on organising, less on navigation
- **Data Quality**: Better focus on relevant geographic areas improves data accuracy
- **Team Collaboration**: Improved visibility into team activities and outcomes

## Conclusion

The CFMEU organiser database demonstrates sophisticated technical architecture with excellent mobile optimization and robust security infrastructure. However, critical gaps in default filtering behavior create poor user experience for field organisers and potential security concerns.

**Key Takeaway**: The system has all necessary infrastructure for proper organiser-centric filtering but lacks consistent implementation across different functional areas.

**Immediate Action Required**: Implement default patch filtering for Projects, Employers, and Map components to align with the organiser-centric design philosophy and improve field user experience.

**Long-term Vision**: Create a seamless organiser experience where relevant geographic data is presented by default, with optional expansion to broader datasets when needed, all while maintaining the excellent mobile-first design and security posture already established.

---

*Analysis conducted using multiple specialized agents examining authentication, filtering logic, mobile responsiveness, and user experience patterns across the entire CFMEU organiser database system.*