# CFMEU Employer Access Analysis - Final Approach

## Business Reality: Universal Write Access Required

Your clarification reveals the core challenge: **Any organiser may need to work with any employer at any time**. This makes traditional write restrictions unworkable for your business model.

### **Real-World Scenarios**
- An employer not currently on an organiser's project could start work tomorrow
- Organisers need to immediately add project assignments
- Traffic light ratings must be updatable by any organiser
- Worker additions, Incolink/FWC scrapes needed on-demand
- Geographic boundaries don't dictate employer relationship possibilities

## Revised Technical Approach

### **Keep Universal Read + Write Access**
```sql
-- Employer RLS policies should be:
USING (true) -- Everyone can read all employers
WITH CHECK (true) -- Everyone can update all employers
```

**This is actually the CORRECT approach for your business model.**

---

## Focus on Change Management & Data Integrity

Since universal write access is required, the focus shifts to **tracking, notification, and conflict resolution** rather than prevention.

### **1. Comprehensive Change Tracking System**

```sql
CREATE TABLE employer_change_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id),
  changed_by UUID NOT NULL REFERENCES profiles(id),
  change_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  change_type TEXT NOT NULL, -- 'project_assignment', 'rating', 'worker_add', 'scrape', etc.
  field_changed TEXT,
  old_value JSONB,
  new_value JSONB,
  change_reason TEXT,
  session_id UUID,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_employer_change_audit_employer_id ON employer_change_audit(employer_id);
CREATE INDEX idx_employer_change_audit_timestamp ON employer_change_audit(change_timestamp);
CREATE INDEX idx_employer_change_audit_changed_by ON employer_change_audit(changed_by);
```

### **2. Real-Time Change Notifications**

```typescript
// WebSocket or real-time subscription for employer changes
supabase
  .channel('employer-changes')
  .on('postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'employer_change_audit',
      filter: `employer_id=eq.${employerId}`
    },
    (payload) => {
      // Notify other users working with this employer
      handleEmployerChange(payload.new);
    }
  )
  .subscribe()
```

### **3. Change Conflict Resolution**

```typescript
// Optimistic locking with change detection
interface EmployerUpdate {
  employerId: string;
  changes: Record<string, any>;
  expectedVersion: number; // Prevent stale updates
  changeReason: string;
}

async function updateEmployer(update: EmployerUpdate) {
  // Get current state
  const current = await getEmployer(update.employerId);

  // Check for conflicts
  if (current.version !== update.expectedVersion) {
    const conflicts = detectConflicts(current, update.changes);
    if (conflicts.length > 0) {
      return {
        success: false,
        conflicts,
        currentData: current,
        message: 'Employer data was modified by another user'
      };
    }
  }

  // Apply changes with audit trail
  const result = await applyEmployerUpdate(update);
  await auditEmployerChange(update, current, result);

  return { success: true, data: result };
}
```

---

## Smart Conflict Resolution Strategies

### **1. Last Write Wins with Notifications**
- Most common approach for collaborative systems
- Immediate user feedback about conflicts
- Change history available for review

### **2. Field-Level Conflict Detection**
```typescript
function detectConflicts(current: Employer, changes: Record<string, any>) {
  const conflicts: Conflict[] = [];

  for (const [field, newValue] of Object.entries(changes)) {
    if (current[field] !== newValue) {
      // Check if this field was recently modified by someone else
      const recentChange = await getRecentFieldChange(
        current.id,
        field,
        5 * 60 * 1000 // 5 minutes ago
      );

      if (recentChange && recentChange.changed_by !== current.userId) {
        conflicts.push({
          field,
          currentValue: current[field],
          attemptedValue: newValue,
          lastModifiedBy: recentChange.changed_by,
          lastModifiedAt: recentChange.change_timestamp
        });
      }
    }
  }

  return conflicts;
}
```

### **3. User-Initiated Merge Resolution**
```typescript
interface ConflictResolution {
  employerId: string;
  resolutions: FieldResolution[];
}

interface FieldResolution {
  field: string;
  strategy: 'use_mine' | 'use_theirs' | 'merge_both' | 'manual_review';
  finalValue?: any;
}
```

---

## Enhanced User Experience for Collaborative Editing

### **1. Real-Time Collaboration Indicators**

```typescript
// Show who is currently viewing/editing an employer
function useEmployerCollaboration(employerId: string) {
  const [activeUsers, setActiveUsers] = useState<User[]>([]);

  useEffect(() => {
    const channel = supabase.channel(`employer-${employerId}`);

    // Join collaboration session
    channel.on('presence', { event: 'sync' }, () => {
      const newState = channel.presenceState();
      setActiveUsers(Object.values(newState).flat());
    });

    channel.subscribe(async () => {
      await channel.track({
        user: currentUser,
        status: 'viewing',
        timestamp: Date.now()
      });
    });

    return () => {
      channel.untrack();
      channel.unsubscribe();
    };
  }, [employerId]);

  return { activeUsers };
}
```

### **2. Smart Conflict UI**

```typescript
function ConflictResolutionDialog({ conflicts, onResolve }: ConflictResolutionProps) {
  return (
    <Dialog>
      <DialogContent>
        <DialogTitle>Employer Data Conflicts</DialogTitle>
        <p>This employer was modified by another user while you were editing:</p>

        {conflicts.map(conflict => (
          <ConflictCard key={conflict.field}>
            <h4>{formatFieldName(conflict.field)}</h4>
            <div className="conflict-values">
              <div>
                <strong>Current value:</strong> {formatValue(conflict.currentValue)}
                <small>Modified by {conflict.lastModifiedBy.name} at {formatTime(conflict.lastModifiedAt)}</small>
              </div>
              <div>
                <strong>Your changes:</strong> {formatValue(conflict.attemptedValue)}
              </div>
            </div>
            <div className="resolution-options">
              <Button onClick={() => onResolve(conflict.field, 'use_theirs')}>
                Use Their Version
              </Button>
              <Button onClick={() => onResolve(conflict.field, 'use_mine')}>
                Use My Version
              </Button>
              <Button onClick={() => onResolve(conflict.field, 'manual_review')}>
                Review Manually
              </Button>
            </div>
          </ConflictCard>
        ))}
      </DialogContent>
    </Dialog>
  );
}
```

### **3. Change History & Rollback**

```typescript
function useEmployerHistory(employerId: string) {
  const [history, setHistory] = useState<ChangeRecord[]>([]);

  const getHistory = async () => {
    const changes = await supabase
      .from('employer_change_audit')
      .select('*')
      .eq('employer_id', employerId)
      .order('change_timestamp', { ascending: false })
      .limit(50);

    setHistory(changes.data);
  };

  const rollbackToVersion = async (versionId: string) => {
    // Get snapshot at that point in time
    const snapshot = await getEmployerSnapshot(employerId, versionId);

    // Apply rollback with audit
    await applyEmployerSnapshot(employerId, snapshot);
    await auditRollback(employerId, versionId, currentUser.id);
  };

  return { history, rollbackToVersion, getHistory };
}
```

---

## Performance & Scalability Considerations

### **1. Efficient Change Tracking**

```sql
-- Use JSONB for efficient change storage
ALTER TABLE employer_change_audit
ADD COLUMN changes_snapshot JSONB;

-- Index for efficient querying
CREATE INDEX idx_employer_audit_changes_gin
ON employer_change_audit USING GIN(changes_snapshot);

-- Partitioning for large datasets
CREATE TABLE employer_change_audit_2024 PARTITION OF employer_change_audit
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

### **2. Smart Caching Strategy**

```typescript
// Cache employer data with version tracking
const employerCache = new Map<string, { data: Employer; version: number; timestamp: number }>();

function getCachedEmployer(employerId: string): Employer | null {
  const cached = employerCache.get(employerId);
  if (!cached) return null;

  // Cache for 5 minutes
  if (Date.now() - cached.timestamp > 5 * 60 * 1000) {
    employerCache.delete(employerId);
    return null;
  }

  return cached.data;
}

function setCachedEmployer(employerId: string, data: Employer, version: number) {
  employerCache.set(employerId, {
    data,
    version,
    timestamp: Date.now()
  });
}
```

---

## Admin & Oversight Tools

### **1. Change Analytics Dashboard**

```typescript
function AdminChangeAnalytics() {
  const [analytics, setAnalytics] = useState<ChangeAnalytics>();

  useEffect(() => {
    const loadAnalytics = async () => {
      const stats = await supabase
        .rpc('get_change_analytics', {
          start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end_date: new Date()
        });

      setAnalytics(stats.data);
    };

    loadAnalytics();
  }, []);

  return (
    <div>
      <h2>Employer Change Activity (30 Days)</h2>

      <MetricsGrid>
        <MetricCard
          title="Total Changes"
          value={analytics?.totalChanges}
          trend={analytics?.changeTrend}
        />
        <MetricCard
          title="Unique Employers Modified"
          value={analytics?.uniqueEmployers}
        />
        <MetricCard
          title="Active Organisers"
          value={analytics?.activeUsers}
        />
        <MetricCard
          title="Conflict Rate"
          value={`${analytics?.conflictRate}%`}
        />
      </MetricsGrid>

      <ChangeActivityChart data={analytics?.dailyActivity} />
      <TopChangersTable users={analytics?.topChangers} />
    </div>
  );
}
```

### **2. Bulk Change Management**

```typescript
function BulkEmployerOperations() {
  const [selectedEmployers, setSelectedEmployers] = useState<string[]>([]);

  const handleBulkRatingUpdate = async (rating: TrafficLightRating) => {
    const promises = selectedEmployers.map(employerId =>
      updateEmployerRating(employerId, rating, {
        bulkOperation: true,
        initiatedBy: currentUser.id,
        reason: 'Bulk compliance review'
      })
    );

    await Promise.all(promises);

    // Track bulk operation
    await supabase.from('bulk_operations').insert({
      operation_type: 'bulk_rating_update',
      affected_employers: selectedEmployers,
      initiated_by: currentUser.id,
      changes_applied: promises.length
    });
  };

  return (
    <div>
      <EmployerSelector
        selected={selectedEmployers}
        onChange={setSelectedEmployers}
      />

      <BulkActions>
        <Button onClick={() => handleBulkRatingUpdate('green')}>
          Set All to Green
        </Button>
        <Button onClick={() => handleBulkRatingUpdate('red')}>
          Set All to Red
        </Button>
        <Button onClick={() => handleBulkRatingUpdate('amber')}>
          Set All to Amber
        </Button>
      </BulkActions>
    </div>
  );
}
```

---

## Final Implementation Priority

### **Week 1-2: Foundation**
1. Implement comprehensive change tracking
2. Add employer version management
3. Create basic conflict detection

### **Week 3-4: User Experience**
1. Real-time collaboration indicators
2. Conflict resolution UI
3. Change history interface

### **Week 5-6: Admin Tools**
1. Analytics dashboard
2. Bulk operation support
3. Advanced conflict resolution

### **Week 7-8: Polish & Training**
1. Performance optimization
2. User training materials
3. Feedback collection & improvements

---

## Conclusion

The revised approach embraces your business reality: **universal write access is required**. Instead of trying to restrict access, the system focuses on:

1. **Comprehensive change tracking** - Full audit trail of all modifications
2. **Real-time collaboration** - Users can see who's working with employers
3. **Smart conflict resolution** - Automatic detection and user-friendly resolution
4. **Admin oversight tools** - Analytics and bulk operations for management
5. **Performance optimization** - Efficient caching and querying

This approach supports your business model while maintaining data integrity and providing the collaboration tools your organisers need to work effectively across geographic boundaries.