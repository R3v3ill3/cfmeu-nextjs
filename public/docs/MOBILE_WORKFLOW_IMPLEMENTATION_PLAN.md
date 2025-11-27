# CFMEU Mobile Workflow Enhancement Implementation Plan

## Overview

This plan addresses the critical mobile workflow gaps identified in the agent analysis, focusing on completing the field organizing experience for union organisers working primarily on iPhone 13+ devices in construction site environments.

## Business Context

**Target Users**: Field organisers with low technical literacy transitioning from pen-and-paper processes
**Primary Workflows**: Project mapping, compliance auditing, delegate coordination, geographic project discovery
**Critical Gap**: Missing dedicated mobile routes and offline capabilities for construction site use
**Success Criteria**: 90% of core organising tasks completable on mobile devices

## Implementation Strategy

### **Phase 1: Foundation (Week 1)**
- Create mobile-specific route structure
- Implement offline data synchronization framework
- Build mobile-optimized form components
- Create responsive navigation system

### **Phase 2: Core Workflows (Week 2)**
- Implement mobile project mapping workflow
- Create mobile compliance auditing interface
- Build offline-capable form submission
- Add mobile-aware validation and error handling

### **Phase 3: Enhanced Features (Week 3)**
- Implement progressive disclosure for complex forms
- Add contextual help system
- Create mobile-specific employer search
- Build touch-optimized dashboard components

## Detailed Implementation Requirements

### **1. Mobile Route Structure**

**Create dedicated `/mobile/*` routes for core workflows:**

```
/mobile/projects/[projectId]/mapping     - Project mapping workflow
/mobile/projects/[projectId]/compliance  - Compliance auditing workflow
/mobile/projects/[projectId]/delegates   - Delegate coordination
/mobile/map/discovery                     - Geographic project discovery
/mobile/employers/search                   - Mobile employer search
/mobile/dashboard                          - Mobile-optimized dashboard
```

**Each mobile route should:**
- Use mobile-specific layouts with safe area handling
- Implement proper touch targets (44x44px minimum)
- Provide offline capability for critical functions
- Include mobile-optimized navigation breadcrumbs
- Support gestures and mobile-specific interactions

### **2. Offline Data Synchronization Framework**

**Core Requirements:**
- Queue-based offline operations
- Conflict resolution for concurrent edits
- Progress indicators for sync operations
- Graceful degradation when offline
- Automatic sync restoration when connectivity returns

**Technical Implementation:**
```typescript
// Offline operation queue
interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  data: any;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
}

// Offline storage with IndexedDB
class OfflineDataManager {
  async queueOperation(operation: OfflineOperation): Promise<void>
  async syncPendingOperations(): Promise<SyncResult>
  async getOfflineData(key: string): Promise<any>
  async setOfflineData(key: string, data: any): Promise<void>
}
```

### **3. Mobile-Optimized Form Components**

**Design Principles:**
- Single input per screen on small devices
- Large touch targets and clear visual hierarchy
- Progressive disclosure for complex forms
- Auto-save and progress preservation
- Mobile-specific input types (numeric keyboards, etc.)

**Component Library:**
```typescript
// Mobile form components
<MobileFormWizard>           // Step-by-step form navigation
<MobileInput>               // Large touch targets + mobile keyboard types
<MobileSelect>              // Native mobile select interfaces
<MobileDatePicker>          // Native mobile date pickers
<MobileCameraCapture>       // Photo upload for site documentation
<MobileLocationPicker>      // GPS integration for site locations
<MobileProgressIndicator>   // Sync and upload progress
<MobileErrorBoundary>       // Mobile-friendly error handling
```

### **4. Touch-Optimized Navigation**

**Navigation Requirements:**
- Clear breadcrumbs showing current location
- Easy back navigation without losing form data
- Quick access to related workflows
- Mobile-appropriate menu density
- Gesture support for common actions

**Implementation:**
```typescript
// Mobile navigation component
<MobileNavigation>
  <BreadcrumbTrail currentLocation="Project Mapping" />
  <QuickActions>
    <ActionButton icon="camera" label="Add Photo" />
    <ActionButton icon="map-pin" label="Set Location" />
    <ActionButton icon="users" label="Add Delegate" />
  </QuickActions>
  <BackButton preserveForm={true} />
</MobileNavigation>
```

## Specific Workflow Implementations

### **1. Mobile Project Mapping Workflow**

**Route**: `/mobile/projects/[projectId]/mapping`

**Features:**
- Step-by-step mapping wizard with progress indicators
- Photo capture for site documentation
- GPS location integration for accurate site positioning
- Offline mode for completing mapping sheets without connectivity
- Auto-save functionality to prevent data loss
- Mobile-optimized employer search and selection
- Touch-friendly contractor assignment interface

**Mobile-Specific Enhancements:**
```typescript
// Mobile mapping workflow
const MobileMappingWorkflow = () => {
  return (
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

      <Step title="Trade Contractors">
        <MobileTradeSelector />
        <MobileInput label="Worker Count" type="number" />
        <MobileCheckboxGroup label="Key Trades" />
      </Step>

      <Step title="Delegate Information">
        <MobileInput label="Delegate Name" />
        <MobileInput label="Delegate Phone" type="tel" />
        <MobileSelect label="Union Status" />
      </Step>
    </MobileFormWizard>
  );
};
```

### **2. Mobile Compliance Auditing Workflow**

**Route**: `/mobile/projects/[projectId]/compliance`

**Features:**
- Mobile-optimized traffic light rating interface
- Large, touch-friendly rating selectors
- Photo capture for compliance evidence
- Voice-to-text support for field notes
- Offline completion with queue-based sync
- Progress preservation across app sessions
- Mobile-optimized delegate task assignment

**Mobile-Specific Components:**
```typescript
// Mobile compliance interface
const MobileComplianceAudit = () => {
  return (
    <MobileScrollView>
      <ComplianceOverviewCard>
        <TrafficLightRatingPicker
          size="large"
          onRatingChange={handleRatingChange}
        />
        <MobileCameraCapture label="Compliance Photos" />
      </ComplianceOverviewCard>

      <DetailedAuditForm>
        <VoiceToTextArea
          label="Field Notes"
          placeholder="Speak your observations..."
        />
        <MobileCheckboxGroup
          label="Compliance Issues"
          options={complianceChecklist}
        />
      </DetailedAuditForm>

      <DelegateTaskSection>
        <MobileUserSearch label="Assign to Delegate" />
        <MobileDatePicker label="Follow-up Date" />
      </DelegateTaskSection>
    </MobileScrollView>
  );
};
```

### **3. Mobile Geographic Project Discovery**

**Route**: `/mobile/map/discovery`

**Features:**
- Full-screen interactive map optimized for mobile
- GPS integration for "Near Me" functionality
- Offline map caching for areas with poor connectivity
- Touch-optimized project information cards
- Click-to-call functionality for project contacts
- Mobile filters for project type and status
- Turn-by-turn navigation integration

**Mobile Optimizations:**
```typescript
// Mobile map interface
const MobileProjectDiscovery = () => {
  return (
    <MobileMapContainer>
      <MapControls>
        <GPSButton onLocationFound={handleGPSLocation} />
        <FilterButton onPress={showMobileFilters} />
        <LayersButton onPress={showMapLayers} />
      </MapControls>

      <ProjectMarkers>
        {projects.map(project => (
          <MobileProjectMarker
            key={project.id}
            project={project}
            onPress={() => showProjectDetails(project)}
          />
        ))}
      </ProjectMarkers>

      <MobileProjectSheet>
        <ProjectCard project={selectedProject}>
          <ContactActions>
            <CallButton phone={project.contactPhone} />
            <DirectionsButton address={project.address} />
            <NavigationButton destination={project.coordinates} />
          </ContactActions>
        </ProjectCard>
      </MobileProjectSheet>
    </MobileMapContainer>
  );
};
```

### **4. Mobile Dashboard**

**Route**: `/mobile/dashboard`

**Features:**
- Role-based default views (organiser patches, team view)
- Touch-optimized metric cards
- Quick access to recent projects and employers
- Mobile-appropriate data density
- Pull-to-refresh functionality
- Offline capability for recent data

**Mobile Dashboard Design:**
```typescript
// Mobile dashboard components
const MobileDashboard = () => {
  return (
    <MobileScrollView refreshControl={refreshControl}>
      <WelcomeHeader
        userName={user.name}
        role={user.role}
        patchCount={assignedPatches.length}
      />

      <QuickActionsGrid>
        <QuickAction
          icon="map"
          title="Find Projects"
          route="/mobile/map/discovery"
        />
        <QuickAction
          icon="clipboard"
          title="Start Audit"
          route="/mobile/audit/select-project"
        />
        <QuickAction
          icon="users"
          title="Manage Delegates"
          route="/mobile/delegates"
        />
        <QuickAction
          icon="search"
          title="Find Employer"
          route="/mobile/employers/search"
        />
      </QuickActionsGrid>

      <RecentActivities />
      <MyProjectsList />
      <TeamMetrics />
    </MobileScrollView>
  );
};
```

## Technical Implementation Details

### **Mobile Route Structure**

```typescript
// File: src/app/mobile/layout.tsx
export default async function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <MobileSafeAreaProvider>
        <OfflineSyncProvider>
          <MobileNavigationProvider>
            {children}
          </MobileNavigationProvider>
        </OfflineSyncProvider>
      </MobileSafeAreaProvider>
    </AuthProvider>
  );
}

// File: src/app/mobile/projects/[projectId]/mapping/page.tsx
export default function MobileMappingPage({ params }: { params: { projectId: string } }) {
  return (
    <MobileScreen>
      <MobileHeader
        title="Project Mapping"
        backRoute={`/mobile/projects/${params.projectId}`}
      />
      <MobileMappingWorkflow projectId={params.projectId} />
    </MobileScreen>
  );
}
```

### **Offline Synchronization Implementation**

```typescript
// File: src/hooks/mobile/useOfflineSync.ts
export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState<OfflineOperation[]>([]);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');

  const queueOperation = useCallback(async (operation: OfflineOperation) => {
    await offlineStorage.addOperation(operation);
    setPendingOperations(prev => [...prev, operation]);

    if (isOnline) {
      await syncPendingOperations();
    }
  }, [isOnline]);

  const syncPendingOperations = useCallback(async () => {
    setSyncStatus('syncing');

    try {
      const operations = await offlineStorage.getPendingOperations();

      for (const operation of operations) {
        try {
          const response = await fetch(operation.endpoint, {
            method: operation.type === 'create' ? 'POST' :
                   operation.type === 'update' ? 'PUT' : 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: operation.type !== 'delete' ? JSON.stringify(operation.data) : undefined,
          });

          if (response.ok) {
            await offlineStorage.removeOperation(operation.id);
          } else {
            await offlineStorage.incrementRetries(operation.id);
          }
        } catch (error) {
          await offlineStorage.incrementRetries(operation.id);
        }
      }

      setSyncStatus('idle');
    } catch (error) {
      setSyncStatus('error');
    }
  }, []);

  return { queueOperation, syncStatus, pendingOperations, isOnline };
}
```

### **Mobile Form Component Library**

```typescript
// File: src/components/mobile/MobileFormWizard.tsx
interface MobileFormWizardProps {
  children: React.ReactNode[];
  onComplete: (data: FormData) => void;
  onStepChange?: (stepIndex: number) => void;
}

export function MobileFormWizard({
  children,
  onComplete,
  onStepChange
}: MobileFormWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({});
  const [isCompleted, setIsCompleted] = useState(false);

  const handleNext = useCallback(() => {
    if (currentStep < children.length - 1) {
      setCurrentStep(prev => prev + 1);
      onStepChange?.(currentStep + 1);
    } else {
      onComplete(formData);
      setIsCompleted(true);
    }
  }, [currentStep, children.length, onComplete, onStepChange]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      onStepChange?.(currentStep - 1);
    }
  }, [currentStep]);

  return (
    <MobileWizardContainer>
      <ProgressIndicator
        currentStep={currentStep}
        totalSteps={children.length}
      />

      <StepContent>
        {children[currentStep]}
      </StepContent>

      <NavigationButtons>
        {currentStep > 0 && (
          <BackButton onPress={handleBack} />
        )}
        <NextButton
          onPress={handleNext}
          isLastStep={currentStep === children.length - 1}
        />
      </NavigationButtons>
    </MobileWizardContainer>
  );
}
```

## Testing Strategy

### **Mobile Device Testing**
- iPhone 13, iPhone 14, iPhone 15 Pro Max
- Safari mobile browser testing
- Touch interaction testing
- Performance testing on mobile processors

### **Connectivity Testing**
- Offline functionality testing
- Poor connectivity simulation
- Sync operation testing
- Data integrity validation

### **User Experience Testing**
- Form completion time measurements
- Navigation ease-of-use testing
- Error handling and recovery testing
- Multi-tasking scenario testing

## Success Metrics

### **Technical Metrics**
- <3 second load times for mobile pages
- <1 second form field response times
- 99% sync success rate for offline operations
- Zero data loss during offline/online transitions

### **User Experience Metrics**
- 90% form completion rate without assistance
- <30 seconds average project mapping completion
- <2 clicks to reach any core workflow
- 95% user satisfaction with mobile interface

### **Business Impact Metrics**
- 50% reduction in time spent on administrative tasks
- 80% increase in real-time data capture
- 90% of organising tasks completed on mobile devices
- 25% improvement in data accuracy and completeness

## Implementation Timeline

### **Week 1: Foundation**
- Set up mobile route structure
- Implement offline sync framework
- Create base mobile component library
- Build mobile navigation system

### **Week 2: Core Workflows**
- Implement mobile project mapping
- Create mobile compliance auditing
- Add offline form capabilities
- Build mobile employer search

### **Week 3: Enhancement & Polish**
- Add contextual help system
- Implement progressive disclosure
- Create mobile dashboard
- Performance optimization and testing

This implementation plan focuses on creating a truly mobile-first experience that supports field organisers in their core workflows while maintaining data integrity and providing seamless offline capabilities for construction site environments.