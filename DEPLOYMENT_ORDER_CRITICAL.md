# 🚨 CRITICAL: Correct Deployment Order

**Date:** October 21, 2025  
**Status:** Migrations 1-3 deployed, Migration 4 REQUIRED before UI deployment

---

## ⚠️ STOP! Read This Before Deploying UI

A **critical issue** was discovered during review: The `trade_types` reference table is not fully populated, causing trades like "cleaning" to disappear in Categories tab and filters.

---

## ✅ Correct Deployment Sequence

### **Step 1: ✅ COMPLETE - Migrations 1-3 Deployed**
```bash
npx supabase db push --include-all
```

**What Deployed:**
- ✅ Migration 1: Consolidated employer_role_tags + contractor_trade_capabilities → employer_capabilities
- ✅ Migration 2: Updated triggers for dual-write
- ✅ Migration 3: Updated RPC functions

**Status:** Successfully deployed to database

---

### **Step 2: 🔴 CRITICAL - Deploy Migration 4**

**⚠️ DO NOT SKIP THIS STEP!**

```bash
npx supabase db push --include-all
```

**What This Does:**
- Seeds `trade_types` table with all 53 trades
- Seeds `contractor_role_types` table with all roles
- Fixes "cleaning" and other missing trades
- Ensures Categories tab and filters work correctly

**Migration File:** `20251021000003_seed_trade_types_reference_table.sql`

**Why Critical:**
- Without this, Categories tab won't show many trades
- EBA Employers filters will be incomplete  
- Edit form and Categories tab will be inconsistent
- Users will see trades disappear after saving

---

### **Step 3: Verify Reference Tables**

After Migration 4, run verification:

```bash
psql $DATABASE_URL -c "
SELECT 
  'trade_types rows' as table_name,
  COUNT(*) as count,
  EXISTS(SELECT 1 FROM trade_types WHERE code = 'cleaning') as has_cleaning,
  EXISTS(SELECT 1 FROM trade_types WHERE code = 'final_clean') as has_final_clean
FROM trade_types;
"
```

**Expected Output:**
```
table_name     | count | has_cleaning | has_final_clean
---------------|-------|--------------|----------------
trade_types rows|  53   |     t        |       t
```

---

### **Step 4: Deploy UI Changes**

**ONLY AFTER Migration 4 succeeds:**

```bash
# Build frontend
npm run build

# Deploy to Vercel
vercel --prod
```

---

## 🎯 Why This Order Matters

### **If You Deploy UI Before Migration 4:**

1. User edits employer → Adds "Cleaning" capability ✅
2. Saves successfully to `employer_capabilities` ✅
3. Opens Categories tab → "Cleaning" missing ❌
4. Opens EBA Employers → "Cleaning" not in filter dropdown ❌
5. User confused - thinks data was lost! ❌

### **If You Deploy Migration 4 First:**

1. Reference tables complete with all 53 trades ✅
2. User edits employer → Adds "Cleaning" capability ✅
3. Saves successfully to `employer_capabilities` ✅
4. Opens Categories tab → "Cleaning" appears ✅
5. Opens EBA Employers → "Cleaning" in dropdown ✅
6. Consistent experience everywhere! ✅

---

## 📋 Deployment Checklist

- [x] Migration 1 deployed (data consolidation)
- [x] Migration 2 deployed (trigger updates)
- [x] Migration 3 deployed (RPC updates)
- [ ] 🔴 **Migration 4 deployment (reference tables)** ← DO THIS NOW
- [ ] Verify all 53 trades in database
- [ ] Test Categories tab shows all trades
- [ ] Test EBA Employers filters show all trades
- [ ] Deploy UI changes
- [ ] Full end-to-end testing

---

## 🆘 Current Status

### **Database:**
- ✅ employer_capabilities populated (1,358 records)
- ✅ Triggers updated for dual-write
- ✅ RPC functions updated
- ❌ **trade_types table incomplete** ← FIX NEEDED

### **Frontend:**
- ✅ UI components updated in codebase
- ❌ **NOT YET DEPLOYED** (waiting for Migration 4)

### **Risk Level:**
- 🟡 **MEDIUM** - System works but with incomplete data
- 🔴 **HIGH** if UI deployed before Migration 4

---

## 🚀 Action Required

**RUN THIS NOW:**
```bash
cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs
npx supabase db push --include-all
```

This will deploy Migration 4 and fix the reference table gap.

**THEN verify and deploy UI.**

---

## 📞 Questions?

See detailed analysis in:
- `CRITICAL_TRADE_TYPES_TABLE_ISSUE.md` - Full problem breakdown
- `TRADE_TYPES_MISSING_DATA_ISSUE.md` - Technical details
- `/tmp/audit_trade_types.sql` - Diagnostic queries

---

**Status:** 🔴 **MIGRATION 4 REQUIRED BEFORE UI DEPLOYMENT**



