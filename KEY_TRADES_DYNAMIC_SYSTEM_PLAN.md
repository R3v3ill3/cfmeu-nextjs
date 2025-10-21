# Key Trades Dynamic System - Research & Implementation Plan

## 📊 Executive Summary

**Current State**: "Key trades" is hard-coded in **15+ locations** with **inconsistent values**  
**Proposed State**: Single, editable, database-backed list managed by admin/lead_organiser  
**Scope**: System-wide (NOT user-specific) - one canonical list for entire organization  
**Risk Level**: **MEDIUM-HIGH** - Touches core business logic across many modules

---

## 🔍 Research Findings

### Current Hard-Coded Locations (15 found)

#### ✅ Already Using Centralized Constant (3 files)
1. `src/components/employers/TradeCapabilitiesSelector.tsx`
   - **Import**: `KEY_CONTRACTOR_TRADES` from `@/constants/keyTrades`
   - **Usage**: Separates trades into "key" vs "other" for dropdown display
   - **Business Impact**: User-facing trade selection prioritization

2. `src/app/api/eba/categories/route.ts`
   - **Import**: `KEY_CONTRACTOR_TRADES_SET` from `@/constants/keyContractorTrades`
   - **Usage**: Filters EBA categories to show only key trades
   - **Business Impact**: EBA tracking and reporting focus

3. `src/app/api/eba/employers/route.ts`
   - **Import**: `KEY_CONTRACTOR_TRADES` from `@/constants/keyContractorTrades`
   - **Usage**: Filters employers by key trade assignments
   - **Business Impact**: EBA employer identification and targeting

#### ❌ Hard-Coded Inline Definitions (12 files)
4. **`src/components/projects/ProjectsDesktopView.tsx`** (Lines 176-179)
   ```typescript
   const KEY_CONTRACTOR_TRADES = new Set([
     'demolition', 'piling', 'concrete', 'scaffolding', 'form_work',
     'tower_crane', 'mobile_crane', 'labour_hire', 'earthworks', 'traffic_control'
   ]); // 10 trades
   ```
   - **Usage**: Key contractor mapping metrics for project dashboard
   - **Business Impact**: **CRITICAL** - Project completion KPIs, dashboard metrics
   - **Context**: Calculates % of key contractors mapped with EBAs

5. **`src/components/projects/mapping/MappingSubcontractorsTable.tsx`** (Lines 45-56)
   ```typescript
   const KEY_CONTRACTOR_TRADES = new Set([...10 trades])
   ```
   - **Usage**: Filters trades to show only "key contractors" in mapping sheet
   - **Business Impact**: **CRITICAL** - Primary project mapping interface
   - **Context**: "Show key contractors only" toggle, affects what organisers see

6. **`src/components/projects/compliance/EmployerComplianceTable.tsx`** (Lines 18-27)
   ```typescript
   const KEY_CONTRACTOR_TRADES = new Set([...10 trades])
   ```
   - **Usage**: Identifies key contractors in compliance checks
   - **Business Impact**: **HIGH** - Compliance tracking and reporting
   - **Context**: Marks employers as "key contractor" for compliance priority

7. **`src/hooks/useOrganizingUniverseMetrics.ts`** (Lines 215-217)
   ```typescript
   const KEY_CONTRACTOR_TRADES = new Set([
     'demolition', 'piling', 'concreting', 'form_work', 'scaffolding', 
     'tower_crane', 'mobile_crane'
   ]); // ⚠️ ONLY 7 TRADES! (missing 3)
   ```
   - **Usage**: Dashboard-wide organizing universe metrics
   - **Business Impact**: **CRITICAL** - Executive dashboard KPIs
   - **Context**: Calculates organization-wide key contractor EBA coverage
   - **⚠️ INCONSISTENCY**: Missing 'labour_hire', 'earthworks', 'traffic_control'

8. **`src/components/projects/SelectiveEbaSearchManager.tsx`** (Lines 88-95)
   ```typescript
   const KEY_CONTRACTOR_TRADES = new Set([...10 trades])
   ```
   - **Usage**: Identifies key contractors for targeted EBA search
   - **Business Impact**: **HIGH** - EBA search and assignment workflow
   - **Context**: Prioritizes key contractors in EBA matching

9. **`src/components/admin/EbaBackfillManager.tsx`** (Lines 36-43)
   ```typescript
   const KEY_CONTRACTOR_TRADES = new Set([...10 trades])
   ```
   - **Usage**: Key contractor identification during EBA backfill operations
   - **Business Impact**: **MEDIUM** - Admin data cleanup operations
   - **Context**: Bulk EBA assignment prioritization

10. **`src/components/upload/EbaProjectSearch.tsx`** (Lines 57-64)
    ```typescript
    const KEY_CONTRACTOR_TRADES = new Set([...10 trades])
    ```
    - **Usage**: Key contractor filtering during EBA project search
    - **Business Impact**: **MEDIUM** - EBA import workflows
    - **Context**: Identifies which employers to prioritize for EBA matching

11. **`src/app/api/public/form-data/[token]/route.old.ts`** (Lines 301-308)
    ```typescript
    const KEY_CONTRACTOR_TRADES = new Set([...10 trades])
    ```
    - **Usage**: Public share link - key contractor display
    - **Business Impact**: **LOW** - Legacy code (marked .old.ts)
    - **Context**: May not be in use

12. **`src/components/dashboard/ActiveConstructionMetrics.tsx`**
    - **Usage**: Similar to organizing universe metrics
    - **Business Impact**: **HIGH** - Dashboard calculations

13. **`src/components/projects/compliance/EmployerComplianceMobile.tsx`**
    - **Usage**: Mobile compliance view
    - **Business Impact**: **MEDIUM** - Mobile compliance interface

14. **`src/components/projects/SubsetEbaStats.tsx`**
    - **Usage**: EBA statistics calculations
    - **Business Impact**: **MEDIUM** - Reporting and analytics

15. **`src/hooks/useProjectSubsetStats.ts`**
    - **Usage**: Project-level statistics
    - **Business Impact**: **MEDIUM** - Project analytics

### 🚨 Critical Inconsistency Found!

**Two different constants files exist:**
- `src/constants/keyTrades.ts` (created recently) - 10 trades
- `src/constants/keyContractorTrades.ts` (existing) - 10 trades
- Both have same values but different exports

**Variation in hard-coded lists:**
- **Most common**: 10 trades (demolition, piling, concrete, scaffolding, form_work, tower_crane, mobile_crane, labour_hire, earthworks, traffic_control)
- **`useOrganizingUniverseMetrics.ts`**: Only 7 trades! (missing labour_hire, earthworks, traffic_control)
- **Some use 'concrete'**, others use 'concreting'

### Business Logic Impact Analysis

#### Where Key Trades Determines Critical Outcomes

1. **Dashboard Metrics** (5+ locations)
   - Key contractor EBA coverage %
   - Project completion metrics
   - Organizing universe health scores
   - **Impact**: Executive decision-making, strategy planning

2. **Project Mapping** (3+ locations)
   - Which trades show in "key contractors" view
   - Trade assignment prioritization
   - **Impact**: Organiser daily workflow, project planning

3. **Compliance Tracking** (3+ locations)
   - Which employers flagged as "key contractors"
   - Compliance priority and reporting
   - **Impact**: Legal risk management, audit trails

4. **EBA Workflows** (4+ locations)
   - EBA search prioritization
   - EBA assignment suggestions
   - EBA coverage calculations
   - **Impact**: Campaign strategy, resource allocation

5. **User Interface** (2+ locations)
   - Trade dropdown organization
   - Filter options
   - **Impact**: User experience, workflow efficiency

---

## 🎯 Proposed Solution Architecture

### Database Schema

#### New Table: `key_contractor_trades`

```sql
CREATE TABLE key_contractor_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_type trade_type NOT NULL UNIQUE,  -- FK to trade_types enum
  display_order INTEGER NOT NULL DEFAULT 999,
  is_active BOOLEAN NOT NULL DEFAULT true,
  added_by UUID REFERENCES auth.users(id),
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  CONSTRAINT unique_active_trade_type UNIQUE (trade_type) WHERE is_active = true
);

-- Index for fast lookups
CREATE INDEX idx_key_contractor_trades_active ON key_contractor_trades(is_active) WHERE is_active = true;
CREATE INDEX idx_key_contractor_trades_order ON key_contractor_trades(display_order) WHERE is_active = true;

-- RLS Policies
ALTER TABLE key_contractor_trades ENABLE ROW LEVEL SECURITY;

-- Everyone can read key trades
CREATE POLICY "Anyone can view key contractor trades"
  ON key_contractor_trades FOR SELECT
  USING (true);

-- Only admin and lead_organiser can modify
CREATE POLICY "Admin and lead_organiser can manage key trades"
  ON key_contractor_trades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'lead_organiser')
    )
  );

-- Audit trigger
CREATE TRIGGER update_key_contractor_trades_timestamp
  BEFORE UPDATE ON key_contractor_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE key_contractor_trades IS 
  'System-wide list of key contractor trades used for prioritization, metrics, and filtering across the application. Managed by admin and lead_organiser roles.';
```

#### Alternative: Configuration Table Approach

```sql
CREATE TABLE system_configuration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_config_key CHECK (config_key ~ '^[a-z_]+$')
);

-- Store key trades as JSON array
INSERT INTO system_configuration (config_key, config_value, category, description)
VALUES (
  'key_contractor_trades',
  '["demolition", "piling", "concrete", "scaffolding", "form_work", "tower_crane", "mobile_crane", "labour_hire", "earthworks", "traffic_control"]',
  'business_logic',
  'List of trade types considered "key contractors" for metrics, prioritization, and filtering'
);
```

**Recommendation**: Use dedicated `key_contractor_trades` table (Option 1)
- **Pros**: Type-safe, easier to query, better audit trail, supports ordering
- **Cons**: Slightly more complex, more tables
- **Verdict**: Better for long-term maintainability

### API Layer

#### New API Endpoint: `/api/admin/key-trades`

```typescript
// GET /api/admin/key-trades
// Returns current key trades configuration
{
  keyTrades: [
    { id: "...", trade_type: "demolition", display_order: 1, is_active: true },
    { id: "...", trade_type: "piling", display_order: 2, is_active: true },
    // ...
  ],
  availableTrades: [
    { value: "electrical", label: "Electrical", isKey: false },
    { value: "plumbing", label: "Plumbing", isKey: false },
    // ...
  ]
}

// POST /api/admin/key-trades/add
// Adds a trade to key trades list
{ trade_type: "electrical", display_order: 11 }

// POST /api/admin/key-trades/remove
// Removes a trade from key trades list  
{ trade_type: "demolition" }

// PUT /api/admin/key-trades/reorder
// Updates display order
{ trades: [{ id: "...", display_order: 1 }, ...] }
```

### React Hook: `useKeyContractorTrades`

```typescript
// src/hooks/useKeyContractorTrades.ts
export function useKeyContractorTrades() {
  return useQuery({
    queryKey: ['key-contractor-trades'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('key_contractor_trades')
        .select('trade_type, display_order')
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data.map(t => t.trade_type);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    cacheTime: 10 * 60 * 1000,
  });
}

// For immediate, synchronous access (with stale-while-revalidate)
export function useKeyContractorTradesSet() {
  const { data = [] } = useKeyContractorTrades();
  return useMemo(() => new Set(data), [data]);
}
```

### Admin UI Component

#### Location: `/admin/key-trades` or Settings page

```typescript
// src/app/(app)/admin/key-trades/page.tsx
export default function KeyTradesManager() {
  const { data: keyTrades, refetch } = useKeyContractorTrades();
  const { data: allTrades } = useQuery(['all-trades'], fetchAllTrades);
  
  const availableTrades = allTrades.filter(t => !keyTrades.includes(t.value));
  
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1>Key Contractor Trades</h1>
        <p>Manages which trades are considered "key contractors" for metrics, prioritization, and filtering.</p>
      </div>
      
      {/* Current Key Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Current Key Trades ({keyTrades.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Trade</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keyTrades.map((trade, index) => (
                <TableRow key={trade.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{trade.label}</TableCell>
                  <TableCell>
                    <Button onClick={() => removeTrade(trade.id)}>
                      Remove from Key Trades
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      {/* Available Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle>Available Trades ({availableTrades.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            {/* Similar structure with "Add to Key Trades" action */}
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 🔄 Migration Strategy

### Phase 1: Setup & Consolidation
1. Create database table and migration
2. Seed with current hard-coded values (10 trades)
3. Consolidate `keyTrades.ts` and `keyContractorTrades.ts` into one
4. Create React hook `useKeyContractorTrades()`
5. Create API endpoints

### Phase 2: Replace Hard-Coded (Low-Risk First)
Replace in order of risk (lowest → highest):
1. `TradeCapabilitiesSelector` (already uses constant)
2. EBA API routes (already uses constant)
3. Admin tools (EbaBackfillManager, etc.)
4. Upload/import workflows
5. Compliance tables
6. Mapping sheets (**test thoroughly**)
7. Dashboard metrics (**test thoroughly**)
8. Organizing universe metrics (**CRITICAL** - extensive testing)

### Phase 3: Admin UI & Testing
1. Build admin management UI
2. Add to admin navigation
3. Comprehensive testing of all affected features
4. Document changes for users

### Phase 4: Cleanup
1. Remove hard-coded definitions
2. Remove duplicate constant files
3. Update documentation
4. Add monitoring/alerting for key trades changes

---

## ⚖️ Pros & Cons Analysis

### ✅ Pros (Benefits)

#### Business Benefits
1. **Flexibility**: Adapt to changing business priorities without code deploys
2. **Responsiveness**: Quickly adjust to market conditions (e.g., new key trade emerges)
3. **Consistency**: Single source of truth eliminates discrepancies
4. **Ownership**: Business stakeholders can manage without developer intervention
5. **Audit Trail**: Track who changed what and when
6. **Testing**: Can test different configurations without code changes

#### Technical Benefits
7. **DRY Principle**: Eliminates 12+ duplicate definitions
8. **Maintainability**: Changes in one place, not scattered across codebase
9. **Type Safety**: Database-backed with proper validation
10. **Performance**: Can cache effectively, minimal overhead
11. **Scalability**: Easy to extend (e.g., add trade-specific metadata)
12. **Testing**: Can reset to known state in tests

#### Operational Benefits
13. **No Deployments**: Changes take effect immediately
14. **Rollback**: Easy to revert changes via UI
15. **Documentation**: Built-in notes field for reasoning
16. **Visibility**: Clear view of current configuration

### ❌ Cons (Risks & Challenges)

#### Technical Risks
1. **Breaking Changes**: Wrong configuration could break metrics/dashboards
2. **Cache Invalidation**: Need robust cache strategy across all consumers
3. **Migration Complexity**: 15+ locations to update, high risk of bugs
4. **Testing Burden**: Must test all 15+ dependent features
5. **Performance**: Database query on every key trade check (mitigated by caching)
6. **Type Safety Loss**: Runtime data vs compile-time constant
7. **Deployment Coordination**: Requires database migration + code changes in lockstep

#### Business Risks
8. **User Error**: Admin could accidentally remove critical trade
9. **No Version Control**: Unlike code, database changes not in git
10. **Unexpected Impacts**: User may not realize all places affected
11. **Data Integrity**: Must ensure no orphaned references
12. **Inconsistent State**: Brief window where old code + new config = bugs

#### Operational Risks
13. **Access Control**: Must strictly limit who can modify
14. **Change Management**: Need process for testing changes before applying
15. **Monitoring**: Need alerts if key trades count drops unexpectedly
16. **Documentation**: Users must understand what "key trades" affects
17. **Training**: Admin/lead_organiser need training on implications

---

## 🛡️ Risk Mitigation Strategies

### 1. Safety Rails
```typescript
// Minimum key trades requirement
const MIN_KEY_TRADES = 5;
const MAX_KEY_TRADES = 15;

// Validate before saving
if (keyTrades.length < MIN_KEY_TRADES) {
  throw new Error(`Must have at least ${MIN_KEY_TRADES} key trades`);
}
```

### 2. Change Approval Workflow
```typescript
// Require confirmation for major changes
if (Math.abs(currentCount - newCount) > 3) {
  showWarning("Significant change detected. Please review impact.");
  requireConfirmation();
}
```

### 3. Audit Logging
```sql
CREATE TABLE key_trades_audit_log (
  id UUID PRIMARY KEY,
  action TEXT, -- 'add', 'remove', 'reorder'
  trade_type TEXT,
  actor_id UUID,
  actor_email TEXT,
  previous_value JSONB,
  new_value JSONB,
  created_at TIMESTAMP
);
```

### 4. Rollback Capability
```typescript
// Store previous state for quick rollback
const [history, setHistory] = useState<ConfigSnapshot[]>([]);

function rollback() {
  const previous = history[history.length - 1];
  applyConfiguration(previous);
}
```

### 5. Staging Environment Testing
- Require testing in staging before production
- Automated tests run on config change
- Visual diff of metric calculations

### 6. Gradual Rollout
```typescript
// Feature flag for dynamic key trades
if (process.env.USE_DYNAMIC_KEY_TRADES === 'true') {
  // Use database
} else {
  // Use hard-coded fallback
}
```

### 7. Monitoring & Alerts
```typescript
// Alert if key trades count changes
if (newCount !== previousCount) {
  sendAlert('Key trades configuration changed', {
    previous: previousCount,
    new: newCount,
    by: currentUser.email
  });
}
```

---

## 📋 Implementation Checklist

### Database & Infrastructure
- [ ] Create `key_contractor_trades` table migration
- [ ] Seed with current 10 trades
- [ ] Set up RLS policies
- [ ] Add audit logging
- [ ] Create database functions for validation

### API Layer
- [ ] Create `/api/admin/key-trades` GET endpoint
- [ ] Create `/api/admin/key-trades/add` POST endpoint
- [ ] Create `/api/admin/key-trades/remove` POST endpoint
- [ ] Create `/api/admin/key-trades/reorder` PUT endpoint
- [ ] Add permission checks (admin/lead_organiser only)
- [ ] Add validation (min/max trades, valid trade_types)

### React Hooks & Utils
- [ ] Create `useKeyContractorTrades()` hook
- [ ] Create `useKeyContractorTradesSet()` hook
- [ ] Consolidate `keyTrades.ts` and `keyContractorTrades.ts`
- [ ] Add cache invalidation logic
- [ ] Add loading states handling

### Admin UI
- [ ] Create admin page `/admin/key-trades`
- [ ] Build current key trades table
- [ ] Build available trades table
- [ ] Add drag-drop reordering
- [ ] Add confirmation dialogs
- [ ] Add success/error notifications
- [ ] Add "Preview Impact" feature

### Code Migration (15 locations)
- [ ] Replace `TradeCapabilitiesSelector.tsx`
- [ ] Replace `eba/categories/route.ts`
- [ ] Replace `eba/employers/route.ts`
- [ ] Replace `ProjectsDesktopView.tsx`
- [ ] Replace `MappingSubcontractorsTable.tsx`
- [ ] Replace `EmployerComplianceTable.tsx`
- [ ] Replace `useOrganizingUniverseMetrics.ts` (FIX 7→10 trades!)
- [ ] Replace `SelectiveEbaSearchManager.tsx`
- [ ] Replace `EbaBackfillManager.tsx`
- [ ] Replace `EbaProjectSearch.tsx`
- [ ] Replace `ActiveConstructionMetrics.tsx`
- [ ] Replace `EmployerComplianceMobile.tsx`
- [ ] Replace `SubsetEbaStats.tsx`
- [ ] Replace `useProjectSubsetStats.ts`
- [ ] Remove `route.old.ts` (legacy)

### Testing
- [ ] Unit tests for API endpoints
- [ ] Integration tests for hook
- [ ] E2E tests for admin UI
- [ ] Regression tests for all 15 dependent features
- [ ] Performance tests (cache effectiveness)
- [ ] Load tests (concurrent reads)

### Documentation
- [ ] User guide for admin UI
- [ ] Developer documentation
- [ ] Migration guide
- [ ] Troubleshooting guide
- [ ] Change impact matrix

### Deployment
- [ ] Feature flag setup
- [ ] Staging deployment
- [ ] Staging validation
- [ ] Production deployment
- [ ] Monitoring setup
- [ ] Rollback plan

---

## 🎯 Recommended Approach

### Option A: Full Dynamic System (Recommended for Long-Term)
**Timeline**: 3-4 weeks  
**Effort**: High  
**Risk**: Medium-High  
**Value**: High (future-proof, flexible)

### Option B: Hybrid Approach (Conservative)
**Timeline**: 1-2 weeks  
**Effort**: Medium  
**Risk**: Low-Medium  
**Value**: Medium (consistency now, flexibility later)

**Steps:**
1. Consolidate all hard-coded to single constant file (quick win)
2. Add admin UI for editing constant file
3. Require code deployment for changes (version controlled)
4. Later migrate to database if needed

### Option C: Status Quo Plus (Minimal)
**Timeline**: 1 week  
**Effort**: Low  
**Risk**: Low  
**Value**: Low (consistency only)

**Steps:**
1. Consolidate to single constant file
2. Fix `useOrganizingUniverseMetrics.ts` inconsistency (7→10)
3. Document what key trades affects
4. Done

---

## 💡 Recommendation: Option A with Phased Rollout

**Why:**
1. The "key trades" concept is **core business logic**, not just UI
2. Already used in **15+ critical places** (metrics, compliance, mapping)
3. **Inconsistencies exist** (7 vs 10 trades) - needs addressing regardless
4. **Business stakeholders** should own this configuration
5. **Future-proof** - easy to adapt as business evolves

**Implementation Path:**
1. **Week 1-2**: Database, API, hooks, consolidate constants
2. **Week 2-3**: Replace low-risk consumers (6-8 locations)
3. **Week 3-4**: Replace high-risk consumers (dashboards, metrics)
4. **Week 4**: Admin UI, testing, documentation
5. **Week 5**: Deployment, monitoring, stabilization

**Go/No-Go Decision Points:**
- After Week 2: Validate cache strategy and performance
- After Week 3: Validate metrics calculations unchanged
- After Week 4: Stakeholder approval of UI and documentation

---

## 📊 Impact Summary

### Files Requiring Changes: **20+**
- 15 locations with hard-coded key trades
- 2 duplicate constant files to consolidate
- 3+ new files (DB migration, API, admin UI)

### Critical Systems Affected:
- **Dashboard Metrics** (Executive visibility)
- **Project Mapping** (Daily organiser workflow)
- **Compliance Tracking** (Legal/audit requirements)
- **EBA Campaigns** (Strategic initiatives)

### User Roles Affected:
- **Admin**: New management UI
- **Lead Organiser**: New management UI
- **Organiser**: Potentially different key trades shown
- **All Users**: Dashboard metrics may change

### Database Changes:
- 1 new table: `key_contractor_trades`
- 1 optional audit table: `key_trades_audit_log`
- RLS policies, indexes, triggers

---

## 🚨 Critical Questions for Stakeholder Decision

1. **Who should be able to change key trades?**
   - Current plan: admin + lead_organiser
   - Alternative: admin only

2. **What's the business process for changing key trades?**
   - Immediate effect, or approval workflow?
   - Testing required before production?

3. **How often do you expect this to change?**
   - Rarely (quarterly): Maybe not worth dynamic system
   - Frequently (monthly): Definitely worth it

4. **What happens to historical data?**
   - Metrics calculated with old key trades list
   - Should we recalculate, or leave as-is?

5. **Minimum number of key trades?**
   - Current: 10
   - Range: 5-15 recommended

6. **Should we support trade-specific notes/metadata?**
   - Why is this trade "key"?
   - When was it added?

---

## 📝 Next Steps

1. **Review this plan** with stakeholders
2. **Answer critical questions** above
3. **Choose approach**: Option A (full dynamic), B (hybrid), or C (minimal)
4. **If Option A**: Schedule 4-5 week implementation
5. **If Option B**: Schedule 1-2 week consolidation
6. **If Option C**: Schedule 1 week cleanup

**Recommendation: Proceed with Option A** given the pervasive use and strategic importance of the "key trades" concept.


