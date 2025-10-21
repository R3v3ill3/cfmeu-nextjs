# Categories Dropdown Issue: Only Shows Trades in Use

**Discovered:** October 21, 2025  
**Issue:** Categories tab dropdown only shows subset of available trades

---

## 🔍 Root Cause Analysis

### **Current Behavior:**

The Categories tab dropdown queries `/api/eba/categories` which returns:

```typescript
// src/app/api/eba/categories/route.ts line 20-28
let query = supabase
  .from('v_contractor_categories_catalog')  // ← THE PROBLEM
  .select('category_type, category_code, category_name, current_employers, total_employers')
```

### **What v_contractor_categories_catalog Does:**

```sql
-- supabase/migrations/20251008090500_eba_employer_categories.sql lines 149-161
CREATE VIEW v_contractor_categories_catalog AS
SELECT
  category_type,
  category_code,
  category_name,
  COUNT(DISTINCT employer_id) FILTER (WHERE is_current) AS current_employers,
  COUNT(DISTINCT employer_id) AS total_employers
FROM public.v_employer_contractor_categories  -- ← Aggregates from employer data
GROUP BY 1,2,3;
```

**The Problem:**
- This view aggregates from **actual employer assignments**
- It ONLY shows categories that have **at least one employer**
- If no employer has "cleaning" assigned → "cleaning" doesn't appear in dropdown
- User can't assign "cleaning" because it's not in the list!

**This is a chicken-and-egg problem:**
- Can't add "cleaning" capability because it's not in dropdown
- It's not in dropdown because no employer has it yet
- Can't assign it to anyone because it's not in dropdown!

---

## 🎯 The Solution

### **Option 1: Query Reference Tables Directly** (Recommended)

Change the API to return **ALL possible** categories from reference tables, not just those in use:

```typescript
// Updated /api/eba/categories route
if (typeParam === 'contractor_role') {
  // Query contractor_role_types reference table
  const { data } = await supabase
    .from('contractor_role_types')
    .select('code, name, category')
    .eq('is_active', true)
    .order('hierarchy_level, name')
  
  return data.map(r => ({
    category_type: 'contractor_role',
    category_code: r.code,
    category_name: r.name,
    current_employers: 0,  // Can be looked up if needed
    total_employers: 0
  }))
}

if (typeParam === 'trade') {
  // Query trade_types reference table
  const { data } = await supabase
    .from('trade_types')
    .select('code, name, category')
    .eq('is_active', true)
    .order('sort_order, name')
  
  return data.map(t => ({
    category_type: 'trade',
    category_code: t.code,
    category_name: t.name,
    current_employers: 0,
    total_employers: 0
  }))
}
```

**Benefits:**
- ✅ Shows ALL 53 trades in dropdown
- ✅ Shows ALL contractor roles in dropdown
- ✅ User can assign any valid category
- ✅ No chicken-and-egg problem
- ✅ Simpler, more predictable

**Trade-offs:**
- Won't show employer counts (or can make separate query)
- Slightly different approach than catalog view

---

### **Option 2: Hybrid - Reference Tables with Counts** (More Complex)

Query reference tables but LEFT JOIN to get counts:

```sql
-- New view or query
SELECT
  'trade' as category_type,
  tt.code as category_code,
  tt.name as category_name,
  COUNT(DISTINCT ec.employer_id) FILTER (WHERE ec.employer_id IS NOT NULL) as total_employers
FROM trade_types tt
LEFT JOIN employer_capabilities ec ON ec.trade_type_id = tt.id 
  AND ec.capability_type = 'trade'
WHERE tt.is_active = true
GROUP BY tt.code, tt.name
ORDER BY tt.sort_order, tt.name
```

**Benefits:**
- ✅ Shows all trades
- ✅ Includes employer counts
- ✅ More informative

**Trade-offs:**
- More complex query
- Requires view update or API change

---

### **Option 3: Update Catalog View** (Database Change)

Modify `v_contractor_categories_catalog` to include ALL reference table entries:

```sql
-- Updated view (hybrid approach)
CREATE OR REPLACE VIEW v_contractor_categories_catalog AS
-- All trades from reference table
SELECT
  'trade'::text as category_type,
  tt.code as category_code,
  tt.name as category_name,
  COALESCE(agg.current_employers, 0) as current_employers,
  COALESCE(agg.total_employers, 0) as total_employers
FROM trade_types tt
LEFT JOIN (
  SELECT 
    category_code,
    COUNT(DISTINCT employer_id) FILTER (WHERE is_current) AS current_employers,
    COUNT(DISTINCT employer_id) AS total_employers
  FROM v_employer_contractor_categories
  WHERE category_type = 'trade'
  GROUP BY category_code
) agg ON agg.category_code = tt.code
WHERE tt.is_active = true

UNION ALL

-- All roles from reference table
SELECT
  'contractor_role'::text as category_type,
  crt.code as category_code,
  crt.name as category_name,
  COALESCE(agg.current_employers, 0) as current_employers,
  COALESCE(agg.total_employers, 0) as total_employers
FROM contractor_role_types crt
LEFT JOIN (
  SELECT 
    category_code,
    COUNT(DISTINCT employer_id) FILTER (WHERE is_current) AS current_employers,
    COUNT(DISTINCT employer_id) AS total_employers
  FROM v_employer_contractor_categories
  WHERE category_type = 'contractor_role'
  GROUP BY category_code
) agg ON agg.category_code = crt.code
WHERE crt.is_active = true
```

**Benefits:**
- ✅ No API changes needed
- ✅ Shows all categories
- ✅ Includes counts (0 for unused)
- ✅ Maintains existing API contract

---

## 🎯 Recommended Approach

**Use Option 3** - Update the `v_contractor_categories_catalog` view.

**Why:**
1. ✅ No breaking API changes
2. ✅ Maintains backward compatibility
3. ✅ Shows ALL available categories
4. ✅ Still provides employer counts
5. ✅ Single database change fixes it everywhere

---

## 📋 Implementation

Create Migration 5 to update the view.

**Result:**
- Categories dropdown shows all 53 trades ✅
- Categories dropdown shows all contractor roles ✅
- Employer counts show "0" for unused categories
- User can assign any valid category ✅



