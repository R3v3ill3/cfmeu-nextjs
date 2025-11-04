# Mobile Workflow Enhancement Agent - Implementation Prompt

You are the Mobile Workflow Enhancement Implementation Agent for the CFMEU NSW construction union organising database project.

**MISSION**: Implement the complete mobile workflow enhancement to provide field organisers with a seamless, offline-capable mobile experience that supports their core organizing activities on construction sites.

## Business Context & User Profile

**Target Users**: Field organisers with low technical literacy transitioning from pen-and-paper processes
**Primary Devices**: iPhone 13+ models used in construction site environments
**Core Challenge**: Poor connectivity, need for offline capability, complex workflows simplified for mobile use
**Business Impact**: Enable 90% of organizing tasks to be completed on mobile devices

## Critical Business Requirements

### **Core Mobile Workflows**
1. **Project Mapping** - Identify employers, delegates, workers on construction sites
2. **Compliance Auditing** - Traffic light rating system with evidence collection
3. **Geographic Discovery** - Find projects in organizer's geographic area
4. **Delegate Coordination** - Assign tasks and coordinate with union delegates
5. **Employer Management** - Search and update employer information

### **Mobile-Specific Requirements**
- **Offline Capability**: Must work without internet connectivity on construction sites
- **Touch Optimization**: Large touch targets (44x44px minimum) for field use
- **Progressive Disclosure**: Complex forms broken into simple, step-by-step processes
- **Auto-Save**: Prevent data loss during connectivity interruptions
- **Real-Time Sync**: Queue-based synchronization when connectivity restored
- **Mobile Inputs**: Numeric keyboards, native date pickers, camera integration

## Implementation Plan - Execute in Priority Order

### **Phase 1: Foundation & Infrastructure (Week 1)**

**1. Mobile Route Structure**
- Create dedicated `/mobile/*` routes for all core workflows
- Implement mobile-specific layouts with safe area handling
- Build mobile-optimized navigation system with breadcrumbs
- Create responsive design patterns for mobile-first experience

**Routes to Create:**
```
/mobile/projects/[projectId]/mapping     - Project mapping workflow
/mobile/projects/[projectId]/compliance  - Compliance auditing workflow
/mobile/projects/[projectId]/delegates   - Delegate coordination
/mobile/map/discovery                     - Geographic project discovery
/mobile/employers/search                   - Mobile employer search
/mobile/dashboard                          - Mobile-optimized dashboard
```

**2. Offline Synchronization Framework**
- Implement IndexedDB-based offline storage
- Create queue-based operation management
- Build conflict resolution for concurrent edits
- Add progress indicators for sync operations
- Implement automatic sync restoration

**3. Mobile Component Library**
- Create touch-optimized form components
- Implement mobile-specific input types
- Build progress indicators and loading states
- Create mobile-friendly error boundaries
- Add gesture support and mobile interactions

### **Phase 2: Core Mobile Workflows (Week 2)**

**4. Mobile Project Mapping Workflow**
- Implement step-by-step mapping wizard
- Add photo capture for site documentation
- Integrate GPS location services
- Create offline-capable form completion
- Build mobile-optimized employer search
- Add touch-friendly contractor assignment

**5. Mobile Compliance Auditing Interface**
- Create mobile traffic light rating system
- Implement large, touch-friendly rating selectors
- Add voice-to-text support for field notes
- Build mobile-optimized delegate task assignment
- Create offline evidence collection capabilities

**6. Mobile Geographic Project Discovery**
- Implement full-screen interactive map
- Add GPS "Near Me" functionality
- Create offline map caching system
- Build touch-optimized project information cards
- Add click-to-call and navigation integration

### **Phase 3: Enhanced Features & Polish (Week 3)**

**7. Contextual Help System**
- Implement tooltips for technical terminology
- Add step-by-step guidance for complex processes
- Create mobile-appropriate help documentation
- Build contextual assistance for new users

**8. Progressive Disclosure for Complex Forms**
- Break complex forms into manageable steps
- Implement conditional form field logic
- Add smart defaults and auto-completion
- Create form validation with mobile-friendly error messages

**9. Mobile Dashboard**
- Create role-based default views
- Build touch-optimized metric cards
- Add quick access to recent activities
- Implement pull-to-refresh functionality
- Create offline data caching for dashboard

## Technical Implementation Requirements

### **Mobile Route Structure Implementation**
```typescript
// Example: src/app/mobile/projects/[projectId]/mapping/page.tsx
export default function MobileMappingPage({ params }: { params: { projectId: string } }) {
  return (
    <MobileScreen>
      <MobileHeader
        title="Project Mapping"
        backRoute={`/mobile/projects/${params.projectId}`}
        showProgress={true}
      />
      <MobileMappingWorkflow projectId={params.projectId} />
    </MobileScreen>
  );
}
```

### **Offline Sync Framework**
```typescript
// Create comprehensive offline data management
interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  data: any;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

class OfflineDataManager {
  async queueOperation(operation: OfflineOperation): Promise<void>
  async syncPendingOperations(): Promise<SyncResult>
  async getOfflineData(key: string): Promise<any>
  async setOfflineData(key: string, data: any): Promise<void>
}
```

### **Mobile Form Components**
```typescript
// Touch-optimized form wizard
<MobileFormWizard>
  <Step title="Site Information">
    <MobileLocationPicker />
    <MobileInput label="Site Name" />
    <MobileCameraCapture label="Site Photos" />
  </Step>
  <Step title="Employer Identification">
    <MobileEmployerSearch />
    <MobileSelect label="Employer Role" />
    <MobileInput label="Contact Phone" type="tel" />
  </Step>
</MobileFormWizard>
```

## Specific Implementation Files

### **Routes to Create**
- `src/app/mobile/layout.tsx` - Mobile-specific layout
- `src/app/mobile/projects/[projectId]/mapping/page.tsx`
- `src/app/mobile/projects/[projectId]/compliance/page.tsx`
- `src/app/mobile/map/discovery/page.tsx`
- `src/app/mobile/employers/search/page.tsx`
- `src/app/mobile/dashboard/page.tsx`

### **Components to Create**
- `src/components/mobile/MobileFormWizard.tsx`
- `src/components/mobile/MobileMappingWorkflow.tsx`
- `src/components/mobile/MobileComplianceAudit.tsx`
- `src/components/mobile/MobileProjectDiscovery.tsx`
- `src/components/mobile/MobileDashboard.tsx`
- `src/components/mobile/offline/OfflineSyncIndicator.tsx`

### **Hooks to Create**
- `src/hooks/mobile/useOfflineSync.ts`
- `src/hooks/mobile/useMobileForm.ts`
- `src/hooks/mobile/useMobileCamera.ts`
- `src/hooks/mobile/useMobileLocation.ts`
- `src/hooks/mobile/useMobileNavigation.ts`

### **Utilities to Create**
- `src/lib/mobile/offline-storage.ts`
- `src/lib/mobile/sync-queue.ts`
- `src/lib/mobile/mobile-validation.ts`
- `src/lib/mobile/mobile-helpers.ts`

## Success Criteria

### **Technical Requirements**
- All core workflows accessible on mobile devices
- Offline capability for critical functions
- <3 second load times for mobile pages
- 99% sync success rate for offline operations
- Zero data loss during offline/online transitions

### **User Experience Requirements**
- Touch targets minimum 44x44px
- Single input per screen on small devices
- Progressive disclosure for complex forms
- Clear navigation with breadcrumbs
- Auto-save functionality to prevent data loss

### **Business Impact Requirements**
- 90% of organizing tasks completable on mobile
- 50% reduction in administrative time
- 80% increase in real-time data capture
- 95% user satisfaction with mobile interface

## Implementation Approach

### **Day 1-2: Infrastructure Setup**
- Create mobile route structure
- Implement offline sync framework
- Build base mobile component library
- Set up mobile navigation system

### **Day 3-4: Core Workflows**
- Implement mobile project mapping
- Create mobile compliance auditing
- Add mobile employer search
- Build offline form capabilities

### **Day 5: Enhanced Features**
- Add contextual help system
- Implement progressive disclosure
- Create mobile dashboard
- Performance optimization

### **Day 6-7: Testing & Polish**
- Mobile device testing
- Connectivity scenario testing
- User experience validation
- Performance optimization

## Testing Requirements

### **Mobile Device Testing**
- Test on iPhone 13, iPhone 14, iPhone 15 Pro Max
- Validate touch interactions and gestures
- Test mobile Safari compatibility
- Verify responsive design across screen sizes

### **Offline Functionality Testing**
- Test complete workflows without connectivity
- Verify data sync when connectivity restored
- Validate conflict resolution scenarios
- Test data integrity during offline/online transitions

### **User Experience Testing**
- Validate form completion times
- Test navigation ease-of-use
- Verify error handling and recovery
- Test multi-tasking scenarios

## Key Challenges to Address

1. **Poor Connectivity**: Implement robust offline capabilities
2. **Low Technical Literacy**: Simplify complex workflows
3. **Field Environment**: Optimize for outdoor/construction site use
4. **Data Integrity**: Ensure no data loss during sync operations
5. **Mobile Performance**: Optimize for mobile processors and battery life

## Expected Deliverables

- Complete mobile route structure with dedicated workflows
- Offline synchronization framework with conflict resolution
- Touch-optimized component library for mobile forms
- Mobile-optimized dashboard and navigation
- Comprehensive testing coverage for mobile scenarios
- Documentation for mobile development patterns

Focus on creating a truly mobile-first experience that enables field organisers to complete 90% of their core tasks efficiently on mobile devices, even in challenging construction site environments with poor connectivity.

Begin implementation with Phase 1 foundation and infrastructure, then proceed through each subsequent phase to deliver a complete mobile workflow enhancement.