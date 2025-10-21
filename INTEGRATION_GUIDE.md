# Site Visit Enhancement - Step-by-Step Integration Guide

This guide walks you through integrating the site visit enhancement features into your existing pages.

## ✅ Integration 1: Site Visits Page (COMPLETED)

**Status**: Already completed in previous step
- Replaced `SiteVisitForm` with `EnhancedSiteVisitForm`
- Added geofencing notification handling

---

## Integration 2: Add Last Visit Badge to Mapping Sheet

**File**: `src/components/projects/mapping/MappingSheetPage1.tsx`

### Step 2a: Add Import

At the top of the file, add:

```typescript
import { LastVisitBadge } from "@/components/projects/LastVisitBadge"
```

### Step 2b: Add Badge to Project Header

Find the project header section (around line 120-150 where project name and tier are displayed).

Add the badge near the project title:

```typescript
// Find this section in your MappingSheetPage1 component:
<div className="flex items-center gap-4">
  <h2 className="text-2xl font-bold">{projectData.name}</h2>
  <ProjectTierBadge tier={projectData.tier} />
  {/* ADD THIS: */}
  <LastVisitBadge projectId={projectData.id} variant="compact" />
</div>
```

If you can't find a clear header section, add it wherever the project name is displayed.

---

## Integration 3: Add Last Visit Column to Project Table

**File**: `src/components/projects/ProjectTable.tsx`

### Step 3a: Add Import

```typescript
import { LastVisitBadge } from "@/components/projects/LastVisitBadge"
```

### Step 3b: Add Table Header

Around line 96-111, add a new `<TableHead>` after "EBA Coverage":

```typescript
<TableHeader>
  <TableRow>
    <TableHead>Project</TableHead>
    <TableHead>Primary Contractor</TableHead>
    <TableHead>Tier</TableHead>
    <TableHead>Classifications</TableHead>
    <TableHead>Patch</TableHead>
    <TableHead>Organiser</TableHead>
    <TableHead className="text-right">Employers</TableHead>
    <TableHead className="text-right">Workers</TableHead>
    <TableHead className="text-right">Members</TableHead>
    <TableHead>Delegate</TableHead>
    <TableHead className="text-right">EBA Coverage</TableHead>
    <TableHead className="text-right">Key EBA</TableHead>
    <TableHead>Last Visit</TableHead> {/* ADD THIS */}
  </TableRow>
</TableHeader>
```

### Step 3c: Add Table Cell

In the `<TableBody>` section (around line 113-279), add a new `<TableCell>` at the end of each row:

```typescript
{/* Find the last TableCell in the row (around line 270+) and add after it: */}
<TableCell>
  <LastVisitBadge projectId={project.id} variant="compact" />
</TableCell>
```

---

## Integration 4: Add Visit Coverage to Patch Dashboard

**File**: `src/app/(app)/patch/page.tsx`

### Step 4a: Add Import

```typescript
import { VisitCoverageCard } from "@/components/siteVisits/VisitCoverageCard"
```

### Step 4b: Add Card to Dashboard

Find where other dashboard cards are rendered (likely in the main return statement).

Add the Visit Coverage Card:

```typescript
{/* Add alongside other dashboard cards */}
{selectedPatchId && (
  <VisitCoverageCard 
    patchId={selectedPatchId} 
    variant="patch" 
  />
)}
```

If you want it in a grid layout:

```typescript
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Existing cards */}
  <VisitCoverageCard patchId={selectedPatchId} variant="patch" />
</div>
```

---

## Integration 5: Add Visit Coverage to Lead Console

**File**: `src/components/lead/LeadConsole.tsx`

### Step 5a: Add Import

```typescript
import { VisitCoverageCard } from "@/components/siteVisits/VisitCoverageCard"
import Link from "next/link"
```

### Step 5b: Add Navigation Link

In the main return statement, find where other actions/links are displayed and add:

```typescript
{/* Add in the header or actions area */}
<Link href="/lead-console/site-visit-reasons">
  <Button variant="outline">
    Manage Visit Reasons
  </Button>
</Link>
```

### Step 5c: Add Visit Coverage Card

Add the card to show team performance:

```typescript
{/* Add alongside other lead console cards */}
{leadId && (
  <VisitCoverageCard 
    leadOrganiserId={leadId} 
    variant="lead" 
  />
)}
```

---

## Integration 6: Add Visit Badge to Project Detail Page

**File**: `src/app/(app)/projects/[projectId]/page.tsx`

### Step 6a: Add Import

```typescript
import { LastVisitBadge } from "@/components/projects/LastVisitBadge"
```

### Step 6b: Add Badge to Overview Section

Find the project overview cards section (around line 600-670) and add:

```typescript
{/* Add as a new overview stat card or inline with project header */}
<Card>
  <CardHeader>
    <CardTitle>Site Visits</CardTitle>
  </CardHeader>
  <CardContent>
    <LastVisitBadge projectId={projectId} />
    <Button 
      variant="link" 
      className="mt-2 p-0 h-auto" 
      onClick={() => router.push(`/site-visits?projectId=${projectId}`)}
    >
      View all visits →
    </Button>
  </CardContent>
</Card>
```

---

## Integration 7: Add Link to Lead Console Navigation

**File**: `src/components/DesktopLayout.tsx` (or wherever your navigation is defined)

### Step 7a: Find Lead Organiser Navigation Section

Look for where lead_organiser-specific menu items are defined (likely around line 100-200).

### Step 7b: Add Navigation Item

```typescript
{userRole === 'lead_organiser' && (
  <>
    {/* Existing lead organiser menu items */}
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link href="/lead-console">
          <Users className="h-4 w-4" />
          <span>Team Console</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
    {/* ADD THIS: */}
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link href="/lead-console/site-visit-reasons">
          <FileText className="h-4 w-4" />
          <span>Visit Reasons</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </>
)}
```

Make sure to import FileText from lucide-react at the top if not already imported.

---

## Integration 8: (Optional) Add Geofencing Setup to Settings

**File**: Create `src/app/(app)/settings/page.tsx` or add to existing settings page

```typescript
import { GeofencingSetup } from "@/components/siteVisits/GeofencingSetup"

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Settings</h1>
      
      {/* Other settings sections */}
      
      <GeofencingSetup />
    </div>
  )
}
```

---

## Integration 9: (Optional) Update Compliance Views

**File**: `src/components/projects/compliance/ComplianceDesktopView.tsx`

This is optional but recommended for tracking when compliance checks were last performed.

### Step 9a: Add Column to Employer Compliance Table

Find the `<EmployerComplianceTable>` component definition and add a "Last Visit" column.

You'll need to:
1. Fetch last visit data for each employer
2. Add column to table header
3. Display date in table cells

Example:

```typescript
// In the table header:
<TableHead>Last Site Visit</TableHead>

// In the table body:
<TableCell>
  {employer.last_visit_date 
    ? format(new Date(employer.last_visit_date), 'dd/MM/yyyy')
    : 'Never'
  }
</TableCell>
```

---

## Testing Checklist

After completing the integrations, test each one:

- [ ] **Site Visits Page**: Create a new visit with multiple reasons and follow-ups
- [ ] **Mapping Sheet**: Visit badge appears and shows correct color
- [ ] **Project Table**: Last visit column shows for all projects
- [ ] **Patch Dashboard**: Visit coverage card displays correct percentages
- [ ] **Lead Console**: Coverage card shows and "Manage Visit Reasons" link works
- [ ] **Project Detail**: Visit badge appears in overview
- [ ] **Lead Console Navigation**: "Visit Reasons" link appears and navigates correctly
- [ ] **Geofencing** (if enabled): Notification triggers when near site
- [ ] **Context Links**: "Open Mapping Sheet" etc. buttons navigate correctly

---

## Quick Integration Script

If you want to do all integrations at once, here's a checklist:

1. ✅ Site visits page (already done)
2. ⏳ Add imports to 6 files
3. ⏳ Add LastVisitBadge to 3 locations
4. ⏳ Add VisitCoverageCard to 2 locations
5. ⏳ Add navigation link to 1 location
6. ⏳ Add table column to 1 location

**Total**: ~20-30 minutes of integration work

---

## Troubleshooting

### "Module not found" errors
- Make sure you run migrations first
- Check that all new files are in the correct locations
- Restart your Next.js dev server

### Badge shows "Loading..." forever
- Check that migrations were applied
- Verify `v_project_last_visit` view exists in database
- Check browser console for errors

### Geofencing doesn't work
- Only works when app is open (foreground only)
- Requires HTTPS in production
- Check notification permissions in browser

### Custom reasons don't appear
- Verify lead organiser has created reasons
- Check organiser is assigned to that lead
- Verify `v_organiser_lead_assignments` view exists

---

## Need Help?

If you encounter issues:

1. Check browser console for errors
2. Verify database migrations applied: `SELECT * FROM site_visit_reason_definitions`
3. Check component imports match file locations
4. Ensure TypeScript types are up to date: run `pnpm install`

For specific errors, check the `SITE_VISIT_ENHANCEMENT_IMPLEMENTATION.md` file for detailed technical information.


