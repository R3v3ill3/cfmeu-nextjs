# Critical Issue: trade_types Table Not Populated

**Discovered:** October 21, 2025  
**Severity:** 🔴 HIGH - Data inconsistency across application

---

## 🚨 The Problem

### **Symptom:**
"Cleaning" appears in Edit form trade capabilities but NOT in:
- Categories tab
- EBA Employers filters

### **Root Cause:**
The application has **THREE different trade sources** that are NOT synchronized:

1. **trade_type ENUM** (53 values) - Database type definition ✅
2. **TRADE_OPTIONS constant** (53 values) - TypeScript constant ✅  
3. **trade_types TABLE** (??? rows) - Reference table ❌ **LIKELY EMPTY/INCOMPLETE**

---

## 📊 Architecture Analysis

### **What Each System Uses:**

#### **Edit Form (EmployerEditForm.tsx):**
```typescript
// Line 646-667
{TRADE_OPTIONS.map((t) => (
  <label key={t.value}>
    <input type="checkbox" value={t.value} />
    {t.label}
  </label>
))}
```
**Source:** `TRADE_OPTIONS` constant from `src/constants/trades.ts`  
**Contains:** All 53 trades including 'cleaning' ✅

---

#### **Categories Tab (EmployerCategoriesEditor.tsx):**
```typescript
// Uses API: /api/eba/categories
// Which queries: v_contractor_categories_catalog view
// Which queries: v_employer_contractor_categories view
// Which includes: manual_trades CTE
```

```sql
-- manual_trades CTE
SELECT
  ec.employer_id,
  tt.code AS category_code,
  tt.name AS category_name
FROM employer_capabilities ec
JOIN trade_types tt ON tt.id = ec.trade_type_id  -- ← JOIN to TABLE
WHERE ec.capability_type = 'trade'
```

**Source:** `trade_types` **TABLE** via JOIN  
**Contains:** ??? (probably incomplete) ❌

---

#### **EBA Employers Filters:**
```typescript
// Uses API: /api/eba/categories
// Same data flow as Categories tab
```
**Source:** `trade_types` **TABLE** via VIEW  
**Contains:** ??? (probably incomplete) ❌

---

## 🔍 The Discrepancy

### **trade_type ENUM (Database):**
```sql
-- From supabase/migrations/0000_remote_schema.sql line 265-320
CREATE TYPE trade_type AS ENUM (
  'scaffolding', 'form_work', 'reinforcing_steel', 'concrete',
  'crane_and_rigging', 'plant_and_equipment', 'electrical', 'plumbing',
  'carpentry', 'painting', 'flooring', 'roofing', 'glazing',
  'landscaping', 'demolition', 'earthworks', 'structural_steel',
  'mechanical_services', 'fire_protection', 'security_systems',
  'cleaning',  -- ← HERE!
  'traffic_management', 'waste_management', 'general_construction',
  'other', 'tower_crane', 'mobile_crane', 'post_tensioning',
  'concreting', 'steel_fixing', 'bricklaying', 'traffic_control',
  'labour_hire', 'windows', 'waterproofing', 'plastering',
  'edge_protection', 'hoist', 'kitchens', 'tiling', 'piling',
  'excavations', 'facade', 'final_clean', 'foundations',
  'ceilings', 'stairs_balustrades', 'building_services',
  'civil_infrastructure', 'fitout', 'insulation', 'technology',
  'pools', 'pipeline'
);
```
**Total:** 53 values ✅

---

### **TRADE_OPTIONS Constant (TypeScript):**
```typescript
// From src/constants/trades.ts lines 9-78
export const TRADE_OPTIONS: TradeOption[] = [
  { value: 'tower_crane', label: 'Tower Crane' },
  { value: 'mobile_crane', label: 'Mobile Crane' },
  // ... 
  { value: 'cleaning', label: 'Cleaning' },  // ← HERE!
  { value: 'final_clean', label: 'Final Clean' },
  // ...
  { value: 'other', label: 'Other' },
];
```
**Total:** 53 entries ✅

---

### **trade_types TABLE (Reference Data):**
```sql
-- From supabase/migrations/0000_remote_schema.sql line 6537-6550
CREATE TABLE trade_types (
  id UUID PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 999,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Current Rows:** ❌ **UNKNOWN - NO SEEDING MIGRATION FOUND!**

**Missing:** No `INSERT INTO trade_types` statement found in migrations!

---

## 🎯 Why This Matters

### **Current Behavior:**

1. **User adds "cleaning" capability in Edit form:**
   - Edit form shows checkbox (from TRADE_OPTIONS)
   - User checks it
   - Saves to `contractor_trade_capabilities` (old) or `employer_capabilities` (new)
   - Stores value: `'cleaning'::trade_type` (ENUM value) ✅

2. **User views Categories tab:**
   - Queries `employer_capabilities` 
   - JOIN to `trade_types` table WHERE `trade_types.code = 'cleaning'`
   - **If 'cleaning' not in table: JOIN returns nothing!** ❌
   - Capability disappears from view!

3. **User checks EBA Employers filters:**
   - Same issue - JOIN fails
   - 'Cleaning' doesn't appear in dropdown ❌

---

## ✅ The Solution

### **Create Migration to Seed trade_types Table**

We need to populate the `trade_types` table with all 53 trade types from the enum:

```sql
-- Seed trade_types table from trade_type enum
INSERT INTO trade_types (code, name, category, sort_order)
VALUES
  -- Crane & Rigging
  ('tower_crane', 'Tower Crane', 'equipment', 1),
  ('mobile_crane', 'Mobile Crane', 'equipment', 2),
  ('crane_and_rigging', 'Crane & Rigging', 'equipment', 3),
  
  -- Early Works
  ('demolition', 'Demolition', 'early_works', 10),
  ('earthworks', 'Earthworks', 'early_works', 11),
  ('piling', 'Piling', 'early_works', 12),
  ('excavations', 'Excavations', 'early_works', 13),
  ('scaffolding', 'Scaffolding', 'structure', 20),
  ('traffic_control', 'Traffic Control', 'early_works', 14),
  ('traffic_management', 'Traffic Management', 'early_works', 15),
  ('waste_management', 'Waste Management', 'early_works', 16),
  ('cleaning', 'Cleaning', 'finishing', 50),  -- ← ADD THIS!
  ('final_clean', 'Final Clean', 'finishing', 51),
  
  -- Structure
  ('concrete', 'Concrete', 'structure', 21),
  ('concreting', 'Concreting', 'structure', 22),
  ... (all 53 trades)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order;
```

---

## 🔧 Recommended Action

### **Step 1: Audit Current State**
Run the diagnostic SQL I created:
```bash
psql $DATABASE_URL -f /tmp/audit_trade_types.sql
```

This will show:
- How many rows are in `trade_types` table
- Which enum values are missing from the table
- Whether 'cleaning' specifically is missing

### **Step 2: Create Seeding Migration**
Create a new migration: `20251021000003_seed_trade_types_table.sql`

This migration should:
1. Insert all 53 trade types from the enum into the table
2. Use proper categories (early_works, structure, finishing, other)
3. Use sensible sort_order values
4. Use ON CONFLICT to be idempotent

### **Step 3: Verify**
After running the migration:
```sql
-- Should return 53
SELECT COUNT(*) FROM trade_types;

-- Should return TRUE, TRUE
SELECT 
  EXISTS(SELECT 1 FROM trade_types WHERE code = 'cleaning') as has_cleaning,
  EXISTS(SELECT 1 FROM trade_types WHERE code = 'final_clean') as has_final_clean;
```

---

## 📋 Expected Results After Fix

### **Before Fix:**
```
Edit Form Trade Capabilities:
  ✅ Shows all 53 trades (from TRADE_OPTIONS constant)
  
Categories Tab:
  ❌ Shows only ~20 trades (only those in trade_types table)
  ❌ Missing: cleaning, final_clean, and others
  
EBA Employers Filters:
  ❌ Same issue - incomplete trade list
```

### **After Fix:**
```
Edit Form Trade Capabilities:
  ✅ Shows all 53 trades (from TRADE_OPTIONS constant)
  
Categories Tab:
  ✅ Shows all 53 trades (from trade_types table - now complete!)
  
EBA Employers Filters:
  ✅ Shows all 53 trades (from trade_types table via view)
```

---

## 🎯 Canonical Source of Truth

### **Current Issue:**
Three different sources claim to be canonical:
1. `trade_type` ENUM - 53 values ✅
2. `TRADE_OPTIONS` constant - 53 values ✅
3. `trade_types` TABLE - ??? values ❌ **NOT SEEDED**

### **Recommended Solution:**
Make **trade_types TABLE** the single source of truth:

1. **Seed the table** with all enum values
2. **Keep ENUM** for type safety (can't remove from PostgreSQL easily)
3. **Keep TRADE_OPTIONS constant** for Edit form UI
4. **Ensure synchronization:**
   - ENUM ← Defines valid values
   - TABLE ← Authoritative reference data (code, name, category)
   - CONSTANT ← Mirrors table for UI (can be generated from table)

---

## 🚀 Implementation Priority

**Priority:** 🔴 **HIGH**

This should be fixed **before deploying our employer_capabilities migration** because:
1. Our migration will populate `employer_capabilities` with trade_type_id references
2. If trade_types table is incomplete, JOINs will fail
3. Data will appear to disappear in Categories tab and filters
4. Users will be confused by inconsistent views

---

**Next Step:** Create the seeding migration for trade_types table!



