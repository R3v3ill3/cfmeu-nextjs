# CFMEU Security Analysis - Revised Recommendations

## Context Update: Business Requirements Clarified

Based on the clarification of actual business requirements, the security analysis needs to be completely reframed:

### **Actual Business Model**
- **Closed User Base**: All authenticated users are trusted union members
- **Data Access Philosophy**: Open viewing within user base, filtered UX by role
- **Primary Concern**: User experience optimization, not data restriction
- **Employer Data Complexity**: Universal access required with data integrity challenges

---

## Revised Security Analysis

### **1. RLS Policy "OR true" Conditions - RECLASSIFIED**

**Original Assessment**: Critical security vulnerability
**Revised Assessment**: **Intentional business feature** that supports open data access model

#### **Why "OR true" is Actually Correct Here**

The `OR true` conditions in RLS policies align with your business model:

```sql
-- This is actually the CORRECT policy for your business model:
USING ((has_patch_access_logic) OR true)
-- Translation: "If you have specific patch access OR you're any authenticated user"
```

**Business Logic Supported**:
- ✅ All organisers can view all projects and employers (required)
- ✅ Lead organisers can see team data across patches (required)
- ✅ Admins have universal access (required)
- ✅ Search functionality works across entire dataset (required)

#### **Recommendation**: **KEEP "OR true" conditions** but document as intentional business choice

---

### **2. API Geographic Validation - REFRAMED**

**Original Assessment**: Security vulnerability requiring validation
**Revised Assessment**: **UX filtering requirement**, not security enforcement

#### **Current API Behavior is Actually Correct**

Your APIs should return broad data that gets filtered in the UI:

```typescript
// Current approach is CORRECT for your model:
const patchIds = body.patch_ids || [] // Accept any patch IDs
const projects = await searchProjects(patchIds) // Return broad dataset
// Frontend then filters based on user's default view preferences
```

**Business Logic Supported**:
- ✅ Universal employer search and access (required)
- ✅ Team-level data views for coordinators (required)
- ✅ Admin universal access (required)
- ✅ Cross-patch collaboration (required)

#### **Recommendation**: **Remove geographic validation** from APIs, implement UX filtering

---

## Revised Recommendations

### **Phase 1: Documentation & Intent Clarification**

**Immediate Actions**:
1. **Document RLS policies** as intentional open-access design
2. **Add comments** to database schema explaining business model
3. **Create data access policy** document for future developers
4. **Remove "security" classification** from these issues

### **Phase 2: UX Filtering Implementation**

**Default View Filtering by Role**:

```typescript
// Organiser default view - their assigned patches only
const organiserDefaultPatches = await getUserAssignedPatches(user.id)

// Lead organiser default view - all patches in their team
const teamDefaultPatches = await getTeamAssignedPatches(user.leadId)

// Admin default view - configurable (all, by coordinator, by organiser)
const adminDefaultView = getUserPreference(user.id, 'default_view')
```

**UI Components to Update**:
1. **Dashboard**: Role-based default filters
2. **Project Lists**: Patch-based default views
3. **Employer Search**: Universal access with smart filtering
4. **Navigation**: Quick access to "My Patches" vs "Team View"

### **Phase 3: Enhanced User Experience**

**Role-Based View Controls**:

```typescript
// Organiser view options:
- My Patches (default)
- Team View (patches assigned to my lead)
- All Projects (for collaboration)

// Lead Organiser view options:
- My Team (all organiser patches under me, default)
- Individual Organiser View (by organiser)
- All Projects (admin-level access)

// Admin view options:
- All Data (default)
- By Coordinator (team-level views)
- By Organiser (individual organiser views)
```

**Smart Defaults**:
- Remember user's preferred view scope
- Provide quick toggle between "My Work" and "Team View"
- Contextual suggestions based on user activity

---

## Employer Data Integrity Challenge

### **The Core Problem**
Everyone needs access to all employers, but maintaining data integrity is complex with universal write access.

### **Current State Analysis**
- ✅ **Read Access**: Universal (correct for business needs)
- ⚠️ **Write Access**: Needs careful consideration
- ⚠️ **Data Conflicts**: Multiple users editing same employer
- ⚠️ **Change Tracking**: Need audit trail for employer modifications

### **Recommended Approach**

#### **1. Employer Read Access - Keep Universal**
```sql
-- RLS policy for employers:
USING (true) -- Everyone can read all employers
```

#### **2. Employer Write Access - Role-Based**
```sql
-- RLS policy for employer updates:
USING (
  is_admin() OR
  is_lead_organiser() OR
  is_assigned_organiser() -- Only if they work with this employer
)
```

#### **3. Change Tracking System**
```sql
-- Add employer change tracking:
CREATE TABLE employer_changes (
  id UUID PRIMARY KEY,
  employer_id UUID REFERENCES employers(id),
  changed_by UUID REFERENCES profiles(id),
  change_type TEXT,
  old_values JSONB,
  new_values JSONB,
  changed_at TIMESTAMP DEFAULT NOW()
);
```

#### **4. Conflict Resolution**
- **Last Write Wins** for most fields
- **Audit Trail** for tracking changes
- **Notifications** for significant employer changes
- **Admin Override** capabilities for critical corrections

---

## Implementation Plan

### **Week 1: Documentation & Policy**
1. Document current data access model as intentional
2. Create developer guidelines for data access patterns
3. Update code comments to reflect business requirements
4. Remove "security vulnerability" classifications

### **Week 2-3: UX Filtering Implementation**
1. Implement role-based default views
2. Add view scope controls to dashboards
3. Create smart filtering for project/employer lists
4. Update navigation for role-appropriate access

### **Week 4-5: Employer Data Integrity**
1. Implement employer write access controls
2. Add change tracking system
3. Create conflict resolution mechanisms
4. Build admin override capabilities

### **Week 6: User Training & Rollout**
1. Train users on new view options
2. Document best practices for data management
3. Create support materials for role-based access
4. Monitor user adoption and feedback

---

## Technical Implementation Details

### **Role-Based View Filtering**

```typescript
// Hook for role-based default views
function useRoleBasedDefaults() {
  const { user, role } = useAuth()

  const getDefaultFilters = useMemo(() => {
    switch (role) {
      case 'organiser':
        return {
          patchIds: user.assignedPatches,
          viewScope: 'my_patches',
          showTeamData: false
        }

      case 'lead_organiser':
        return {
          patchIds: user.teamPatches,
          viewScope: 'team_view',
          showIndividualOrganisers: true
        }

      case 'admin':
        return {
          patchIds: null, // All patches
          viewScope: 'all_data',
          showByCoordinator: true,
          showByOrganiser: true
        }

      default:
        return { patchIds: [], viewScope: 'limited' }
    }
  }, [user, role])

  return { getDefaultFilters }
}
```

### **Employer Access Control**

```typescript
// API endpoint for employer updates
export async function PUT(request: Request) {
  const { employerId, updates } = await request.json()
  const { user } = await getServerSession()

  // Check write permissions
  const canUpdate = await canUpdateEmployer(user.id, employerId)
  if (!canUpdate) {
    return NextResponse.json({ error: 'Update not permitted' }, { status: 403 })
  }

  // Track changes
  await trackEmployerChange(employerId, user.id, updates)

  // Apply updates
  const result = await updateEmployer(employerId, updates)

  return NextResponse.json(result)
}
```

---

## Updated Risk Assessment

### **Security Risks**: **LOW**
- Closed user base with trusted members
- Data access is intentional business model
- Main risk is data integrity, not unauthorized access

### **User Experience Risks**: **MEDIUM**
- Complex filtering might confuse users
- Need clear indicators of current view scope
- Risk of users getting lost in data navigation

### **Data Integrity Risks**: **MEDIUM-HIGH**
- Multiple users editing same employer data
- Need for change tracking and conflict resolution
- Requirement for admin oversight and correction capabilities

### **Implementation Risks**: **LOW**
- Changes are additive (adding filtering, not restricting access)
- Backwards compatible with current workflows
- Can be rolled out incrementally

---

## Conclusion

The "security vulnerabilities" identified in the original analysis are actually **intentional business features** that support your open data access model. The "OR true" conditions and lack of API geographic validation are correct for your needs.

**Key Shift in Focus**:
- ❌ **Security hardening** → ✅ **User experience optimization**
- ❌ **Data restriction** → ✅ **Smart filtering and views**
- ❌ **Access control** → ✅ **Role-based defaults**

The main technical challenge is **employer data integrity** with universal write access, which can be addressed with change tracking and role-based write permissions.

This revised approach maintains all current functionality while improving the user experience through intelligent, role-based filtering of the open data model.