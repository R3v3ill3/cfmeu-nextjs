# 🎯 Organizing Universe Rules - Deployment Guide

## Overview
This guide implements automatic organizing universe classification based on project tier, EBA status, and patch assignments, while preserving full user control through manual overrides.

## Business Rules
1. **Tier 1 projects** → `"active"` (always)
2. **Tier 2/3 + EBA active builder + patch assigned** → `"active"`
3. **Tier 2/3 + patch assigned + no EBA active builder** → `"potential"`
4. **Tier 3 + no EBA active builder + no patch assignment** → `"excluded"`

## Step-by-Step SQL Execution Order

### 📁 Files to Run (in this exact order):

1. **`01_add_tracking_columns.sql`** - Adds tracking columns and backup
2. **`02_create_business_logic_functions.sql`** - Creates rule calculation functions  
3. **`03_impact_analysis.sql`** - Analyzes what would change
4. **`04_preview_changes.sql`** - Shows specific projects that would change
5. **`05_apply_retrospective_changes.sql`** - Applies rules to existing projects
6. **`06_create_triggers_for_new_projects.sql`** - Auto-assignment for new projects
7. **`07_manual_override_functions.sql`** - User control functions
8. **`08_rollback_functions.sql`** - Emergency rollback capabilities

### 🚀 Execution Instructions

#### Step 1: Preparation
```sql
-- In Supabase SQL Editor, run:
SELECT COUNT(*) as total_projects FROM projects;
SELECT tier, COUNT(*) FROM projects GROUP BY tier;
```

#### Step 2: Run Each File
Copy and paste each file's contents into Supabase SQL Editor and run them **one at a time** in order.

**After each step, look for:**
- ✅ Success messages in the output
- 📊 Statistics and impact analysis
- ⚠️ Any error messages

#### Step 3: Review Impact (After Step 4)
```sql
-- See what would change
SELECT * FROM organising_universe_impact_analysis 
WHERE change_type != 'NO_CHANGE' 
ORDER BY tier, name;

-- Summary by tier
SELECT 
  tier,
  calculated_universe,
  COUNT(*) as projects
FROM organising_universe_impact_analysis 
GROUP BY tier, calculated_universe 
ORDER BY tier, calculated_universe;
```

#### Step 4: Apply Changes (After Step 5)
```sql
-- DRY RUN first (see what would happen)
SELECT apply_organising_universe_rules_retrospectively(TRUE);

-- If happy with results, apply for real
SELECT apply_organising_universe_rules_retrospectively(FALSE, auth.uid());
```

### 🛡️ Safety Features

#### Backup & Recovery
- **Automatic backup** of current state before any changes
- **Full audit log** of every change made
- **Emergency rollback** function to undo everything

#### User Control Preserved
- **Manual override flag** prevents automatic changes
- **User can set any value** and it will persist
- **Override removal** allows returning to automatic rules

#### Change Tracking
- **Detailed logging** of why each change was made
- **Rule tracking** shows which business rule was applied
- **User attribution** tracks who made manual changes

### 🧪 Testing Functions

After deployment, test with:

```sql
-- Test rule calculation for a specific project
SELECT 
  name,
  tier,
  calculate_default_organising_universe(id) as calculated_universe
FROM projects 
WHERE name ILIKE '%your-project-name%';

-- Test manual override
SELECT set_organising_universe_manual(
  'project-uuid-here',
  'active',
  auth.uid(),
  'Testing manual override'
);

-- Test automatic assignment
SELECT remove_organising_universe_manual_override(
  'project-uuid-here', 
  auth.uid(),
  'Testing auto-assignment'
);
```

### 📊 Monitoring Queries

```sql
-- Check automation status
SELECT 
  organising_universe,
  COUNT(*) as projects,
  COUNT(CASE WHEN organising_universe_auto_assigned THEN 1 END) as auto_assigned,
  COUNT(CASE WHEN organising_universe_manual_override THEN 1 END) as manual_override
FROM projects 
WHERE organising_universe IS NOT NULL
GROUP BY organising_universe;

-- Recent changes
SELECT 
  p.name,
  ocl.old_value,
  ocl.new_value,
  ocl.change_reason,
  ocl.applied_at
FROM organising_universe_change_log ocl
JOIN projects p ON p.id = ocl.project_id
ORDER BY ocl.applied_at DESC 
LIMIT 10;

-- Projects by rule outcome
SELECT 
  tier,
  organising_universe,
  COUNT(*) as count,
  ROUND(AVG(value)/1000000, 1) as avg_value_millions
FROM projects 
WHERE tier IS NOT NULL 
GROUP BY tier, organising_universe
ORDER BY tier, organising_universe;
```

### 🚨 Emergency Procedures

#### If Something Goes Wrong:
```sql
-- 1. Check what's in backup
SELECT * FROM emergency_rollback_info;

-- 2. Rollback everything to original state  
SELECT rollback_organising_universe_changes(TRUE, auth.uid());

-- 3. Or clear all automation (keep current values but stop auto-assignment)
SELECT clear_organising_universe_automation(TRUE);
```

#### Disable Automation:
```sql
-- Stop all triggers from firing
DROP TRIGGER IF EXISTS trigger_auto_assign_organising_universe ON projects;
DROP TRIGGER IF EXISTS trigger_contractor_organising_universe_update ON project_assignments;
DROP TRIGGER IF EXISTS trigger_patch_organising_universe_update ON patch_job_sites;
```

### ✅ Success Criteria

After all steps complete, you should have:

1. **Automated classification** for all projects with tiers
2. **User override capability** that persists permanently  
3. **Audit trail** of all changes made
4. **Automatic assignment** for new projects
5. **Trigger-based updates** when builders/patches change
6. **Emergency rollback** capability

### 🎯 Integration with Dashboard

The new rules will automatically integrate with your dashboard:
- **Organizing universe metrics** will reflect the new classifications
- **Role-based summaries** will use updated project categorizations
- **Filters** will work with the new universe assignments
- **Real-time updates** when users change classifications manually

### 📋 Post-Deployment Tasks

After successful deployment:

1. **Update frontend** to show manual override status
2. **Add admin interface** for bulk manual overrides
3. **Monitor audit log** for unexpected changes
4. **Test project creation** to verify auto-assignment

The system is designed to be **completely safe** with full rollback capability and user control preservation! 🛡️
