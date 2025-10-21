# Employer Classification Taxonomy - Detailed Impact Analysis

## Executive Summary

After thorough investigation of APIs, Views, Triggers, and Queries, **Option 1 (Consolidate to employer_capabilities) is feasible with manageable risk**. Most critical infrastructure already uses or is compatible with the modern system.

---

## 🚧 Detailed Impact Assessment & Mitigations

### **1. APIs - MEDIUM RISK** ⚠️

#### **Affected API: `/api/eba/employers/[employerId]/categories`**
**Status:** ✅ **SAFE - Already uses `employer_capabilities`**

**Current Implementation:**
- GET: Reads from `v_employer_contractor_categories` view (includes both systems)
- POST: Writes to `employer_capabilities` table
- DELETE: Removes from `employer_capabilities` table

**Impact:** ✅ **ZERO - API already uses the target table**

**Evidence:**
```typescript
// src/app/api/eba/employers/[employerId]/categories/route.ts
await supabase.from('employer_capabilities').upsert({
  employer_id: employerId,
  capability_type: 'contractor_role',
  contractor_role_type_id: role.id,
})
```

**Mitigation:** None needed - this API is already on the modern system.

---

#### **RPC Function: `admin_update_employer_full`**  
**Status:** ⚠️ **REQUIRES UPDATE**

**Current Implementation:**
- Has TWO overloaded signatures
- Writes to `employer_role_tags` table
- Writes to `contractor_trade_capabilities` table
- Used by Edit form

**Evidence:**
```sql
-- Signature 1 (old)
admin_update_employer_full(p_employer_id, p_update, p_role_tags[], p_trade_caps[])
  → Writes to employer_role_tags and contractor_trade_capabilities

-- Signature 2 (newer) 
admin_update_employer_full(p_employer_id, p_update, p_role_tags[], p_trade_types[])
  → Also writes to employer_role_tags and contractor_trade_capabilities
```

**Impact:** ⚠️ **MEDIUM - RPC needs modification**

**Mitigation Strategy:**
1. **Keep RPC signature** for backward compatibility
2. **Update RPC body** to write to `employer_capabilities` instead
3. **Add compatibility layer** that also writes to old tables during transition
4. **Later phase** can remove old table writes

**Proposed RPC Update:**
```sql
CREATE OR REPLACE FUNCTION admin_update_employer_full(
  p_employer_id uuid,
  p_update jsonb,
  p_role_tags employer_role_tag[],
  p_trade_types trade_type[]
) RETURNS void AS $$
BEGIN
  -- Update employer fields (unchanged)
  UPDATE employers SET ... WHERE id = p_employer_id;
  
  -- NEW: Write to employer_capabilities (roles)
  IF p_role_tags IS NOT NULL THEN
    DELETE FROM employer_capabilities 
    WHERE employer_id = p_employer_id 
      AND capability_type = 'contractor_role';
    
    INSERT INTO employer_capabilities (employer_id, capability_type, contractor_role_type_id)
    SELECT p_employer_id, 'contractor_role', crt.id
    FROM unnest(p_role_tags) AS tag
    JOIN contractor_role_types crt ON crt.code = tag::text;
  END IF;
  
  -- NEW: Write to employer_capabilities (trades)
  IF p_trade_types IS NOT NULL THEN
    DELETE FROM employer_capabilities 
    WHERE employer_id = p_employer_id 
      AND capability_type = 'trade';
    
    INSERT INTO employer_capabilities (employer_id, capability_type, trade_type_id)
    SELECT p_employer_id, 'trade', tt.id
    FROM unnest(p_trade_types) AS trade
    JOIN trade_types tt ON tt.code = trade::text;
  END IF;
  
  -- COMPATIBILITY: Also write to old tables (for transition period)
  -- These can be removed in Phase 6
  DELETE FROM employer_role_tags WHERE employer_id = p_employer_id;
  INSERT INTO employer_role_tags (employer_id, tag)
  SELECT p_employer_id, unnest(p_role_tags) WHERE p_role_tags IS NOT NULL;
  
  DELETE FROM contractor_trade_capabilities WHERE employer_id = p_employer_id;
  INSERT INTO contractor_trade_capabilities (employer_id, trade_type)
  SELECT p_employer_id, unnest(p_trade_types) WHERE p_trade_types IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Timeline:** Update in Phase 3

---

### **2. Views - LOW RISK** ✅

#### **Materialized View: `employers_search_optimized`**
**Status:** ✅ **SAFE - Does not use old tables**

**Current Implementation:**
- Used for employer list filtering/search
- Only references: `employers`, `worker_placements`, `project_assignments`, `company_eba_records`
- Does NOT reference `employer_role_tags` or `contractor_trade_capabilities`

**Impact:** ✅ **ZERO - Not affected**

**Evidence:**
```sql
CREATE MATERIALIZED VIEW employers_search_optimized AS
SELECT 
  e.id, e.name, e.employer_type, ...
  -- Uses project_assignments, NOT employer_role_tags
  (SELECT COUNT(*) FROM project_assignments pa WHERE pa.employer_id = e.id)
FROM employers e
```

**Mitigation:** None needed.

---

#### **View: `v_employer_contractor_categories`** 
**Status:** ✅ **SAFE - Designed to handle both systems**

**Current Implementation:**
- UNION ALL of 7 different sources
- Includes `employer_capabilities` (manual_roles and manual_trades CTEs)
- Also includes project assignments, legacy tables
- This view is the KEY to maintaining compatibility

**Impact:** ✅ **ZERO - View already handles unification**

**Evidence:**
```sql
CREATE VIEW v_employer_contractor_categories AS
  ... 
  UNION ALL
  SELECT * FROM manual_roles  -- FROM employer_capabilities
  UNION ALL
  SELECT * FROM manual_trades -- FROM employer_capabilities
  UNION ALL
  SELECT * FROM pa_roles      -- FROM project_assignments
  UNION ALL
  SELECT * FROM pa_trades     -- FROM project_assignments
  ...
```

**Benefit:** This view will automatically show data from `employer_capabilities` once we migrate!

**Mitigation:** None needed - view is future-proof.

---

#### **Materialized View: `employer_list_view`** 
**Status:** ✅ **SAFE - Does not use old tables**

**Current Implementation:**
- Legacy view, less used than `employers_search_optimized`
- Does not reference the old tables

**Impact:** ✅ **ZERO**

**Mitigation:** None needed.

---

### **3. Triggers - MEDIUM RISK** ⚠️

#### **Trigger: `sync_employer_role_tag_from_per`**
**Status:** ⚠️ **REQUIRES UPDATE**

**Current Behavior:**
- Fires on INSERT/UPDATE of `project_employer_roles` table
- Auto-creates `employer_role_tags` when employer assigned as builder/head_contractor
- Ensures employer gets the persistent tag

**Function:**
```sql
CREATE FUNCTION sync_employer_role_tag_from_per() RETURNS trigger AS $$
BEGIN
  IF NEW.employer_id IS NOT NULL AND (NEW.role = 'builder' OR NEW.role = 'head_contractor') THEN
    INSERT INTO employer_role_tags (employer_id, tag)
    VALUES (NEW.employer_id, NEW.role::employer_role_tag)
    ON CONFLICT (employer_id, tag) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Impact:** ⚠️ **MEDIUM - Needs to write to new table**

**Mitigation - Update Trigger:**
```sql
CREATE OR REPLACE FUNCTION sync_employer_role_tag_from_per() RETURNS trigger AS $$
BEGIN
  IF NEW.employer_id IS NOT NULL AND (NEW.role = 'builder' OR NEW.role = 'head_contractor') THEN
    -- NEW: Write to employer_capabilities
    INSERT INTO employer_capabilities (employer_id, capability_type, contractor_role_type_id)
    SELECT NEW.employer_id, 'contractor_role', crt.id
    FROM contractor_role_types crt
    WHERE crt.code = NEW.role::text
    ON CONFLICT (employer_id, capability_type, contractor_role_type_id) DO NOTHING;
    
    -- COMPATIBILITY: Also write to old table (transition period)
    INSERT INTO employer_role_tags (employer_id, tag)
    VALUES (NEW.employer_id, NEW.role::employer_role_tag)
    ON CONFLICT (employer_id, tag) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Timeline:** Update in Phase 5

---

#### **Trigger: `sync_trade_capability_from_pct`**
**Status:** ⚠️ **REQUIRES UPDATE**

**Current Behavior:**
- Fires on INSERT/UPDATE of `project_contractor_trades` table
- Auto-creates `contractor_trade_capabilities` when employer assigned to trade
- Ensures employer gets the capability

**Function:**
```sql
CREATE FUNCTION sync_trade_capability_from_pct() RETURNS trigger AS $$
BEGIN
  IF NEW.employer_id IS NOT NULL AND NEW.trade_type IS NOT NULL THEN
    INSERT INTO contractor_trade_capabilities (employer_id, trade_type, is_primary)
    SELECT NEW.employer_id, NEW.trade_type::trade_type, false
    WHERE NOT EXISTS (...)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Impact:** ⚠️ **MEDIUM - Needs to write to new table**

**Mitigation - Update Trigger:**
```sql
CREATE OR REPLACE FUNCTION sync_trade_capability_from_pct() RETURNS trigger AS $$
BEGIN
  IF NEW.employer_id IS NOT NULL AND NEW.trade_type IS NOT NULL THEN
    -- NEW: Write to employer_capabilities
    INSERT INTO employer_capabilities (employer_id, capability_type, trade_type_id)
    SELECT NEW.employer_id, 'trade', tt.id
    FROM trade_types tt
    WHERE tt.code = NEW.trade_type::text
    ON CONFLICT (employer_id, capability_type, trade_type_id) DO NOTHING;
    
    -- COMPATIBILITY: Also write to old table (transition period)
    INSERT INTO contractor_trade_capabilities (employer_id, trade_type, is_primary)
    SELECT NEW.employer_id, NEW.trade_type::trade_type, false
    WHERE NOT EXISTS (...)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Timeline:** Update in Phase 5

---

### **4. Direct Queries - HIGH RISK** 🔴

#### **Component: `SingleEmployerPicker` / `SingleEmployerDialogPicker`**
**Status:** 🔴 **REQUIRES REFACTOR**

**Current Implementation:**
```typescript
// Loads ALL employer_role_tags upfront
const { data: tagRows } = await supabase
  .from("employer_role_tags")
  .select("employer_id, tag");

// Uses tags to prioritize employers
const tags = tagMap[employer.id] || [];
if (tags.includes("builder") || tags.includes("head_contractor")) {
  // Show with priority
}
```

**Impact:** 🔴 **HIGH - Direct table dependency**

**Mitigation - Refactor Query:**
```typescript
// NEW: Query employer_capabilities instead
const { data: capRows } = await supabase
  .from("employer_capabilities")
  .select("employer_id, contractor_role_types!inner(code)")
  .eq("capability_type", "contractor_role")
  .in("contractor_role_types.code", ["builder", "head_contractor"]);

// Build same map structure
const tagMap: Record<string, string[]> = {};
capRows.forEach(row => {
  if (!tagMap[row.employer_id]) tagMap[row.employer_id] = [];
  tagMap[row.employer_id].push(row.contractor_role_types.code);
});
```

**Timeline:** Update in Phase 4

**Files Affected:**
- `src/components/projects/SingleEmployerPicker.tsx`
- `src/components/projects/SingleEmployerDialogPicker.tsx`
- `src/components/projects/MultiEmployerPicker.tsx`

---

#### **Component: `TradeContractorsManager`**
**Status:** 🔴 **REQUIRES REFACTOR**

**Current Implementation:**
```typescript
// Loads ALL contractor_trade_capabilities
const { data: caps } = await supabase
  .from("contractor_trade_capabilities")
  .select("employer_id, trade_type");

// Builds lookup map
const map: Record<string, Set<string>> = {};
caps.forEach(row => {
  if (!map[row.trade_type]) map[row.trade_type] = new Set();
  map[row.trade_type].add(row.employer_id);
});
```

**Impact:** 🔴 **HIGH - Direct table dependency**

**Mitigation - Refactor Query:**
```typescript
// NEW: Query employer_capabilities instead
const { data: caps } = await supabase
  .from("employer_capabilities")
  .select("employer_id, trade_types!inner(code)")
  .eq("capability_type", "trade");

// Build same map structure
const map: Record<string, Set<string>> = {};
caps.forEach((row: any) => {
  const tradeCode = row.trade_types.code;
  if (!map[tradeCode]) map[tradeCode] = new Set();
  map[tradeCode].add(row.employer_id);
});
```

**Timeline:** Update in Phase 4

**Files Affected:**
- `src/components/projects/TradeContractorsManager.tsx`

---

#### **Component: `AddEmployerDialog`**
**Status:** 🔴 **REQUIRES REFACTOR**

**Current Implementation:**
```typescript
// Inserts into employer_role_tags
await supabase.from('employer_role_tags').insert(tagInserts);

// Inserts into contractor_trade_capabilities  
await supabase.from('contractor_trade_capabilities').insert(tradeInserts);
```

**Impact:** 🔴 **HIGH - Creates data in old tables**

**Mitigation - Refactor to use API:**
```typescript
// NEW: Use the categories API instead
for (const tag of ['builder', 'head_contractor']) {
  if (shouldAddTag(tag)) {
    await fetch(`/api/eba/employers/${newEmployerId}/categories`, {
      method: 'POST',
      body: JSON.stringify({ type: 'contractor_role', code: tag })
    });
  }
}

for (const trade of tradeCapabilities) {
  await fetch(`/api/eba/employers/${newEmployerId}/categories`, {
    method: 'POST',
    body: JSON.stringify({ type: 'trade', code: trade })
  });
}
```

**Timeline:** Update in Phase 3

**Files Affected:**
- `src/components/employers/AddEmployerDialog.tsx`

---

#### **Import/Merge Components**  
**Status:** ⚠️ **MEDIUM RISK**

**Affected Files:**
- `src/components/upload/PendingEmployersImport.tsx` - 4 insert locations
- `src/lib/employers/mergePendingIntoExisting.ts` - Merge logic
- `src/components/admin/DuplicateEmployerManager.tsx` - Duplicate merge
- `src/components/upload/ContractorImport.tsx` - Bulk import
- `src/components/projects/mapping/scan-review/EmployerMatchDialog.tsx` - Scan review

**Current Pattern:**
```typescript
await supabase.from('contractor_trade_capabilities').insert({
  employer_id: id,
  trade_type: 'scaffolding'
});
```

**Mitigation:** 
- Update all to use `/api/eba/employers/[id]/categories` API
- OR update to write directly to `employer_capabilities` with proper ID lookups

**Timeline:** Update in Phase 3

---

## 📊 Summary of Mitigations

| Component | Risk | Mitigation | Phase | Effort |
|-----------|------|------------|-------|--------|
| `/api/eba/employers/[id]/categories` | ✅ None | Already uses new system | - | 0 |
| `v_employer_contractor_categories` view | ✅ None | Already unified | - | 0 |
| `employers_search_optimized` view | ✅ None | Doesn't use old tables | - | 0 |
| `admin_update_employer_full` RPC | ⚠️ Medium | Update body, keep signature | 3 | 2h |
| `sync_employer_role_tag_from_per` trigger | ⚠️ Medium | Dual-write during transition | 5 | 1h |
| `sync_trade_capability_from_pct` trigger | ⚠️ Medium | Dual-write during transition | 5 | 1h |
| `EmployerEditForm` | 🔴 High | Refactor queries | 3 | 3h |
| `SingleEmployerPicker` (3 files) | 🔴 High | Refactor queries | 4 | 4h |
| `TradeContractorsManager` | 🔴 High | Refactor query | 4 | 2h |
| `AddEmployerDialog` | 🔴 High | Use API instead | 3 | 2h |
| Import/Merge components (5 files) | ⚠️ Medium | Use API or direct writes | 3 | 6h |

**Total Effort:** ~21 hours

---

## 🚀 Deployment Strategy (Zero-Downtime)

### **Phase 1: Prepare (No user impact)**
1. Run data migration SQL
2. Verify data in `employer_capabilities`
3. Deploy updated triggers (dual-write mode)

### **Phase 2: Deploy UI Updates (Gradual rollout)**
1. Deploy RPC update (maintains compatibility)
2. Deploy EmployerEditForm update
3. Deploy AddEmployerDialog update
4. Test thoroughly in production

### **Phase 3: Deploy Picker Updates**
1. Deploy SingleEmployerPicker updates
2. Deploy TradeContractorsManager update
3. Deploy import component updates
4. Monitor for issues

### **Phase 4: Cleanup (After validation period)**
1. Remove dual-write from triggers
2. Mark old tables as deprecated
3. Add schema comments
4. Update documentation

**Timeline:** Can be done incrementally over 1-2 weeks with monitoring between phases.

---

## 🔄 Rollback Strategy

### **If issues occur in Phase 2-3:**
1. Revert deployed code to previous version
2. Old tables still have data (from dual-write)
3. Zero data loss
4. System continues working

### **Database rollback:**
- Old tables remain populated during entire transition
- Triggers maintain both tables
- Can switch back to old queries anytime
- No destructive operations until Phase 4

### **Feature flag option:**
```typescript
// Can add feature flag to switch between systems
const USE_EMPLOYER_CAPABILITIES = process.env.NEXT_PUBLIC_USE_CAPABILITIES === 'true';

if (USE_EMPLOYER_CAPABILITIES) {
  // New query
} else {
  // Old query
}
```

---

## ✅ Recommendation

**Option 1 (Consolidate to employer_capabilities) is RECOMMENDED with manageable risk:**

1. **APIs:** Already compatible ✅
2. **Views:** Already compatible ✅
3. **Triggers:** Easy to update with dual-write strategy ⚠️
4. **Queries:** Straightforward refactoring required 🔴

**Key Safety Measures:**
- Dual-write strategy ensures no data loss
- Incremental deployment allows validation at each step
- Feature flags enable instant rollback
- Old tables remain as backup during transition

**Estimated Timeline:** 1-2 weeks with proper testing

**Total Development Effort:** ~21 hours


