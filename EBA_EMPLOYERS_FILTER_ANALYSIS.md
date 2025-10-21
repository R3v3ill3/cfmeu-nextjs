# EBA Employers Page Filter Analysis

**Date:** October 21, 2025  
**Analysis:** Impact of employer_capabilities consolidation on EBA Employers filters

---

## 📍 Filter Location & Behavior

**Page:** `src/app/(app)/eba-employers/page.tsx`

### **Filter 1: Category Type**
- Options: "Contractor Role" or "Trade"
- Controls what shows in Filter 2

### **Filter 2: Category**
- Dynamic dropdown based on Filter 1 selection
- Shows specific contractor roles OR trades
- Displays employer counts for each category

---

## 🔄 Complete Data Flow Trace

### **Step 1: User Selects Category Type**
```typescript
// page.tsx line 31-32
const [type, setType] = useState<'contractor_role' | 'trade'>('contractor_role')
```

### **Step 2: Load Available Categories**
```typescript
// page.tsx lines 42-53
const { data: categories } = useQuery({
  queryFn: async () => {
    const res = await fetch(`/api/eba/categories?type=${type}`)
    return res.json()
  }
})
```

**Calls:** `/api/eba/categories`

---

### **Step 3: API Fetches Category List**
**File:** `src/app/api/eba/categories/route.ts`

```typescript
// Line 20-22
let query = supabase
  .from('v_contractor_categories_catalog')  // ← KEY VIEW
  .select('category_type, category_code, category_name, current_employers, total_employers')

if (typeParam) {
  query = query.eq('category_type', typeParam) // Filter by contractor_role or trade
}
```

**Uses View:** `v_contractor_categories_catalog`

---

### **Step 4: View Aggregates Data**
**File:** `supabase/migrations/20251008090500_eba_employer_categories.sql` (lines 149-161)

```sql
CREATE VIEW v_contractor_categories_catalog AS
SELECT
  category_type,
  category_code,
  category_name,
  COUNT(DISTINCT employer_id) FILTER (WHERE is_current) AS current_employers,
  COUNT(DISTINCT employer_id) AS total_employers
FROM public.v_employer_contractor_categories  -- ← Sources from here
GROUP BY 1,2,3;
```

**Sources From:** `v_employer_contractor_categories`

---

### **Step 5: Unified View (The Critical Piece)**
**File:** `supabase/migrations/20251008090500_eba_employer_categories.sql` (lines 14-127)

```sql
CREATE VIEW v_employer_contractor_categories AS
WITH 
-- Source 1: Legacy builder field
builder_role AS (...),

-- Source 2: Project assignments - contractor roles
pa_roles AS (
  SELECT ... FROM project_assignments pa
  JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
  WHERE pa.assignment_type = 'contractor_role'
),

-- Source 3: Project assignments - trades
pa_trades AS (
  SELECT ... FROM project_assignments pa
  JOIN trade_types tt ON tt.id = pa.trade_type_id
  WHERE pa.assignment_type = 'trade_work'
),

-- Source 4: Legacy project trades
pct AS (
  SELECT ... FROM project_contractor_trades pct
),

-- Source 5: Legacy site trades
sct AS (
  SELECT ... FROM site_contractor_trades sct
),

-- 🎯 Source 6: MANUAL ROLES (employer_capabilities!)
manual_roles AS (
  SELECT
    ec.employer_id,
    'contractor_role'::text AS category_type,
    crt.code AS category_code,
    crt.name AS category_name,
    'manual_capability'::text AS source,
    NULL::uuid AS project_id,
    TRUE AS is_current
  FROM public.employer_capabilities ec           -- ← USES OUR NEW TABLE!
  JOIN public.contractor_role_types crt ON crt.id = ec.contractor_role_type_id
  WHERE ec.capability_type = 'contractor_role'
),

-- 🎯 Source 7: MANUAL TRADES (employer_capabilities!)
manual_trades AS (
  SELECT
    ec.employer_id,
    'trade'::text AS category_type,
    tt.code AS category_code,
    tt.name AS category_name,
    'manual_capability'::text AS source,
    NULL::uuid AS project_id,
    TRUE AS is_current
  FROM public.employer_capabilities ec           -- ← USES OUR NEW TABLE!
  JOIN public.trade_types tt ON tt.id = ec.trade_type_id
  WHERE ec.capability_type = 'trade'
)
SELECT * FROM builder_role
UNION ALL SELECT * FROM pa_roles
UNION ALL SELECT * FROM pa_trades
UNION ALL SELECT * FROM pct
UNION ALL SELECT * FROM sct
UNION ALL SELECT * FROM manual_roles    -- ← Includes our data
UNION ALL SELECT * FROM manual_trades   -- ← Includes our data
```

---

## ✅ Impact Analysis Result

### **Finding: ALREADY COMPATIBLE!** 🎉

The EBA Employers page filters **ALREADY use the `employer_capabilities` table** through the unified view!

#### **Why It Works:**

1. **View was designed for this:** The `v_employer_contractor_categories` view includes both old and new data sources
2. **UNION ALL approach:** Combines data from 7 different sources including `employer_capabilities`
3. **Source tracking:** The `source` column distinguishes 'manual_capability' from other sources
4. **Future-proof:** View automatically picks up migrated data

---

## 📊 What The Filters Show

### **Before Migration:**
```
Category Type: Contractor Role
└─ Categories:
   ├─ Builder (from project_assignments + builder_id + manual via OLD tables)
   ├─ Head Contractor (from project_assignments + manual via OLD tables)
   └─ Other roles (from project_assignments only)

Category Type: Trade  
└─ Categories:
   ├─ Scaffolding (from project_assignments + legacy tables + OLD contractor_trade_capabilities)
   ├─ Concrete (from project_assignments + legacy tables + OLD contractor_trade_capabilities)
   └─ ... (53 total trades)
```

### **After Migration:**
```
Category Type: Contractor Role
└─ Categories:
   ├─ Builder (from project_assignments + builder_id + manual via NEW employer_capabilities)
   ├─ Head Contractor (from project_assignments + manual via NEW employer_capabilities)
   └─ Other roles (from project_assignments + manual via NEW employer_capabilities)

Category Type: Trade  
└─ Categories:
   ├─ Scaffolding (from project_assignments + legacy tables + NEW employer_capabilities)
   ├─ Concrete (from project_assignments + legacy tables + NEW employer_capabilities)
   └─ ... (53 total trades, now from NEW employer_capabilities)
```

**Key Difference:** 
- Now includes data from `employer_capabilities` (our 1,358 migrated records!)
- Filters will show MORE complete data because of the migration
- Manual capabilities now visible alongside derived ones

---

## 🧪 Filter Source Breakdown

### **What Each Filter Shows:**

#### **"Contractor Role" Filter Options:**
**Data Sources:**
1. ✅ `employer_capabilities` (capability_type='contractor_role') - **OUR NEW TABLE**
2. ✅ `project_assignments` (assignment_type='contractor_role')
3. ✅ `projects.builder_id` field

**Available Options:**
- All entries from `contractor_role_types` table:
  - builder
  - head_contractor
  - building_contractor
  - construction_manager
  - managing_contractor
  - contractor
  - fitout_contractor
  - piling_foundation_contractor
  - road_work_contractor
  - superstructure_contractor
  - turnkey_contractor
  - etc.

#### **"Trade" Filter Options:**
**Data Sources:**
1. ✅ `employer_capabilities` (capability_type='trade') - **OUR NEW TABLE** 
2. ✅ `project_assignments` (assignment_type='trade_work')
3. ✅ `project_contractor_trades` (legacy)
4. ✅ `site_contractor_trades` (legacy)

**Available Options:**
- All entries from `trade_types` table (53 trades)
- Dynamically filtered if "Key Trades Only" checkbox is selected

---

## 🎯 Impact of Our Migration

### **Before Migration:**
- Filters showed data from `employer_capabilities` if manually added via Categories tab
- Did NOT show data from `employer_role_tags` or `contractor_trade_capabilities`
- **Missing 1,358 trade capability records!**

### **After Migration:**
- ✅ Filters now show ALL 1,358 migrated trade capabilities
- ✅ Manual contractor roles now visible (0 records currently, but ready)
- ✅ Data added via Edit form now appears in filters
- ✅ Complete data visibility across all interfaces

---

## ✅ Conclusion

### **Do The Filters Need Updates?**
**Answer: NO! ✅**

The filters are **already fully compatible** with our changes because:

1. ✅ They query `v_employer_contractor_categories` view
2. ✅ This view includes `employer_capabilities` data (manual_roles and manual_trades CTEs)
3. ✅ The view was architecturally designed to support this migration
4. ✅ No API changes needed
5. ✅ No component changes needed

### **What Changed:**
- ✅ Filters will now show **more complete data** (1,358 migrated records)
- ✅ Manual capabilities from Edit form now visible in filters
- ✅ Better data consistency across the application

### **Testing Recommendations:**
1. Visit EBA Employers page
2. Select "Category Type: Trade"
3. Check "Category" dropdown - should show all trades with counts
4. Verify counts are higher (due to migrated data)
5. Filter by a trade (e.g., "Scaffolding")
6. Should see employers who have that trade capability

---

## 📈 Expected Improvements

### **Category Counts Will Increase:**
The employer counts next to each category will be **more accurate** now because:
- Before: Only counted employers with data in `employer_capabilities` OR project assignments
- After: Includes all 1,358 migrated trade capabilities from `contractor_trade_capabilities`
- Result: More employers appear in trade categories

**Example:**
```
Before Migration:
  Scaffolding (45 employers)  ← Missing manually assigned capabilities

After Migration:
  Scaffolding (128 employers) ← Now includes migrated capabilities
```

---

## 🎉 Summary

**Status:** ✅ **NO CHANGES REQUIRED**

The EBA Employers page filters are **already fully integrated** with the employer_capabilities table. Our migration will:
- ✅ Automatically improve filter accuracy
- ✅ Show more complete employer lists
- ✅ Include manually assigned capabilities from Edit form
- ✅ Maintain all existing functionality

**This is exactly how the system was designed to work!** The unified view architecture provides seamless compatibility. 🚀



