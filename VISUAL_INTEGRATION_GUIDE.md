# Site Visit Enhancement - Visual Integration Guide

This guide shows you **exactly where** the new site visit features appear in your UI.

---

## 📍 Location 1: Projects Page - Card View

### Before:
```
┌──────────────────────────────────┐
│ Southbank Tower        [Mapping] │
│ [Tier 1] [EBA Active]            │
│                                  │
│ Builder Co                       │
│ ▓▓▓░ Key: 75%                   │
│ ▓▓░░ EBA: 50%                   │
│                                  │
│ [    Open project    ]          │ ← Only one button
└──────────────────────────────────┘
```

### After:
```
┌──────────────────────────────────┐
│ Southbank Tower        [Mapping] │
│ [Tier 1] [EBA Active]            │
│                                  │
│ Builder Co                       │
│ ▓▓▓░ Key: 75%                   │
│ ▓▓░░ EBA: 50%                   │
│                                  │
│ [    Open project    ]          │
│ [  Record Site Visit  ]         │ ← NEW BUTTON!
└──────────────────────────────────┘
```

**User Action**: Click "Record Site Visit" → Opens project's Site Visits tab

---

## 📍 Location 2: Projects Page - Table View

### Before:
```
| Project    | Contractor | ... | EBA | Key EBA |
|------------|------------|-----|-----|---------|
| Project A  | Builder Co | ... | 60% | 45%     |
| Project B  | Other Inc  | ... | 40% | 30%     |
```

### After:
```
| Project    | Contractor | ... | EBA | Key EBA | Last Visit        | Actions     |
|------------|------------|-----|-----|---------|-------------------|-------------|
| Project A  | Builder Co | ... | 60% | 45%     | 🟢 2 weeks ago   | [📅 Visit]  | ← NEW!
| Project B  | Other Inc  | ... | 40% | 30%     | 🟠 8 months ago  | [📅 Visit]  | ← NEW!
| Project C  | New Corp   | ... | 80% | 70%     | ⚫ Never         | [📅 Visit]  | ← NEW!
```

**User Action**: 
- See last visit status for every project
- Click "Visit" button → Quick access to record visit

---

## 📍 Location 3: Project Detail Page - New Tab

### Before:
```
Tabs:
[Mapping Sheets] [Wallcharts] [EBA Search] [Audit & Compliance]
```

### After:
```
Tabs:
[Mapping Sheets] [Site Visits] [Wallcharts] [EBA Search] [Audit & Compliance]
                     ↑ NEW!
```

### When Site Visits Tab is Clicked:

#### If No Visits Exist:
```
┌──────────────────────────────────────────────┐
│         📅                                   │
│    No site visits recorded yet               │
│    Start recording site visits to track      │
│    your organizing activities                │
│                                              │
│    [  Record First Visit  ]                 │
└──────────────────────────────────────────────┘
```

#### If Visits Exist:
```
Site Visits
Southbank Tower Project                [+ Record Site Visit]

┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│  [+]               │ │ 📅 15 Oct 2025     │ │ 📅 01 Oct 2025     │
│                    │ │ 👤 John Smith      │ │ 👤 Jane Doe        │
│  Record New Visit  │ │ 📍 Main Site       │ │ 📍 West Wing       │
│                    │ │ [Compliance] [EBA] │ │ [Safety Issue]     │
│                    │ │ Notes: "Checked..."│ │ [Draft]            │
│                    │ │                    │ │                    │
│ Document a site    │ │  View details →   │ │  View details →   │
│ visit              │ │                    │ │                    │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
       ↑ Always first        ↑ Previous visits with details
```

---

## 📍 Location 4: Mapping Sheet - Project Header

### Before:
```
Southbank Tower Project
[Tier 1]  $45M
```

### After:
```
Southbank Tower Project
[Tier 1]  $45M  🟢 2 weeks ago
                     ↑ Visit badge!
```

**Badge Colors**:
- 🟢 Bright Green: < 3 months (excellent)
- 🟢 Light Green: 3-6 months (good)
- 🟠 Orange: 6-12 months (attention needed)
- 🔴 Red: > 12 months (urgent)
- ⚫ Grey: Never visited (critical)

---

## 📍 Location 5: Enhanced Site Visit Form

### What the Form Looks Like:

```
┌────────────────────────────────────────────────────────────┐
│ Record Site Visit                                     [×]  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ ┌─ Visit Details ─────────────────────────────────┐      │
│ │ Date: [15/10/2025]    Organiser: [John Smith]  │      │
│ │ Project: [Southbank Tower ▼]                    │      │
│ │ Site: [Main Site ▼]                             │      │
│ │ 📍 Main Site - 123 Smith St, Melbourne          │      │
│ └─────────────────────────────────────────────────┘      │
│                                                            │
│ ┌─ Employers at Site ──────────────────────────────┐      │
│ │ ☑ Select all                                     │      │
│ │ ☑ Builder Co Ltd                                 │      │
│ │ ☐ Subcontractor Inc                              │      │
│ │ ☑ Steel Works Pty                                │      │
│ └──────────────────────────────────────────────────┘      │
│                                                            │
│ ┌─ Visit Reasons ──────────────────────────────────┐      │
│ │ ☑ Compliance Audit                               │      │
│ │   └─ Notes: "Checked safety procedures..."       │      │
│ │ ☑ Safety Issue                                   │      │
│ │   └─ Notes: "Scaffolding concern addressed"      │      │
│ │ ☐ Delegate Election                              │      │
│ │ ☐ EBA Vote                                       │      │
│ │ ˅ Show more reasons (4)                          │      │
│ └──────────────────────────────────────────────────┘      │
│                                                            │
│ ┌─ General Notes ──────────────────────────────────┐      │
│ │ [Productive visit. Workers engaged and...]       │      │
│ │ [                                           ]     │      │
│ └──────────────────────────────────────────────────┘      │
│                                                            │
│ ┌─ Follow-up Actions ──────────────────────────────┐      │
│ │ • Call Bob re: safety training   Due: 22/10/2025 │      │
│ │   [📅 Calendar] [×]                              │      │
│ │                                                   │      │
│ │ [Description...] [Due date] [+ Add]              │      │
│ └──────────────────────────────────────────────────┘      │
│                                                            │
│ ┌─ Quick Links ────────────────────────────────────┐      │
│ │ [📄 Open Mapping Sheet ↗]                        │      │
│ │ [✓ Open Audit & Compliance ↗]                    │      │
│ │ [✓ Open EBA Search ↗]                            │      │
│ └──────────────────────────────────────────────────┘      │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ [Cancel]              [Save Draft]  [Complete Visit]      │
└────────────────────────────────────────────────────────────┘
```

---

## 📍 Location 6: Lead Console - Visit Reasons Management

### Before:
```
┌────────────────────────────────────┐
│ Lead Organiser Console             │
├────────────────────────────────────┤
│ [Summary cards...]                 │
│ [Organiser Assignment...]          │
└────────────────────────────────────┘
```

### After:
```
┌──────────────────────────────────────────────────────────┐
│ Co-ordinator Console      [📄 Manage Site Visit Reasons] │ ← NEW!
├──────────────────────────────────────────────────────────┤
│ [Summary cards...]                                       │
│ [Organiser Assignment...]                                │
└──────────────────────────────────────────────────────────┘
```

### Visit Reasons Management Page:
```
Site Visit Reasons                    [+ Add Custom Reason]

Your Custom Visit Reasons
┌───────────────────────────────────────────────────────────┐
│ Name              | Description      | Visibility | Order  │
│──────────────────────────────────────────────────────────│
│ Safety Inspection | Monthly checks   | [Always]  | ↑↓ 100 │
│ Contract Nego     | Contract talks   | [More]    | ↑↓ 110 │
└───────────────────────────────────────────────────────────┘

Global Visit Reasons
[Compliance Audit] [Delegate Election] [EBA Vote] [Safety Issue]
[Employer Meeting] [Delegate 1-on-1] [Site Meeting] [General Visit]
```

---

## 🎯 Navigation Flow Diagram

```
Projects Page (Card/Table View)
    │
    ├─→ Click "Record Site Visit" button
    │   └─→ Opens: /projects/[id]?tab=site-visits
    │       └─→ Site Visits tab loads
    │           └─→ ProjectSiteVisits component
    │               └─→ Click "Record New Visit" card
    │                   └─→ EnhancedSiteVisitForm opens
    │                       └─→ Pre-filled with project
    │
    ├─→ Click project name / "Open project"
    │   └─→ Opens: /projects/[id]
    │       └─→ Click "Site Visits" tab
    │           └─→ View visit history
    │
    └─→ Click "Visit" button in table
        └─→ Same as "Record Site Visit"

Mapping Sheet
    │
    └─→ See visit badge in header
        └─→ Visual indicator of last visit

Lead Console
    │
    └─→ Click "Manage Site Visit Reasons"
        └─→ Opens: /lead-console/site-visit-reasons
            └─→ Create/edit custom reasons
```

---

## 🔧 Customization Options

### If You Want to Change Behavior:

**Auto-open form when no visits exist:**
```typescript
// In ProjectSiteVisits component:
<ProjectSiteVisits 
  projectId={projectId}
  autoCreate={true}  // Change to true to auto-open form
/>
```

**Change badge variant:**
```typescript
// Use "default" instead of "compact" for larger badge
<LastVisitBadge projectId={id} variant="default" />
```

**Modify geofence radius:**
```typescript
// In src/hooks/useGeofencing.ts, line 8:
const GEOFENCE_RADIUS_METERS = 200 // Change from 100 to 200 meters
```

**Adjust notification cooldown:**
```typescript
// In src/hooks/useGeofencing.ts, line 10:
const NOTIFICATION_COOLDOWN = 7200000 // Change to 2 hours (from 1 hour)
```

---

## ✨ Features at a Glance

| Feature | Location | Description |
|---------|----------|-------------|
| **Record Visit Button** | Project cards | Quick access to record visits |
| **Visit Column** | Project table | See last visit date for all projects |
| **Visit Tab** | Project details | Full visit history per project |
| **Visit Badge** | Mapping sheet | Color-coded recency indicator |
| **Custom Reasons** | Lead console | Create team-specific reasons |
| **Geofencing** | Settings (to add) | Location-based notifications |
| **Analytics Views** | Database | Coverage reporting data |

---

## 🎨 Design System Integration

All new components follow your existing design patterns:
- ✅ Uses shadcn/ui components (Card, Button, Badge, etc.)
- ✅ Matches desktop/mobile responsive patterns
- ✅ Follows color scheme (light/dark mode compatible)
- ✅ Consistent typography and spacing
- ✅ Accessible (keyboard navigation, ARIA labels)

---

## 🚦 Status Indicators Reference

### Visit Status (on visit cards):
- **[Draft]** - Grey badge, visit not completed
- **No badge** - Completed visit

### Visit Recency (badges):
- 🟢 **Bright Green** background: Very recent (< 3 months)
- 🟢 **Light Green** background: Recent (3-6 months)
- 🟠 **Orange** background: Somewhat old (6-12 months)
- 🔴 **Red** background: Very old (> 12 months)
- ⚫ **Grey** background: Never visited

### Follow-up Actions:
- **Unchecked** box: Action pending
- **Checked** box: Action completed (when supported)
- **📅 Icon**: Calendar export available

---

## 🎪 Interactive Elements

### Clickable Items:

1. **Project card "Record Site Visit" button**
   - Navigates to: `/projects/[id]?tab=site-visits`
   - Opens Site Visits tab

2. **Table "Visit" button**
   - Same navigation as above
   - Compact button with calendar icon

3. **Visit cards in grid**
   - Click any past visit → Opens edit form
   - Click "Record New Visit" → Opens create form

4. **Context links in form**
   - "Open Mapping Sheet" → Navigate to mapping tab
   - "Open Audit & Compliance" → Navigate to compliance tab
   - "Open EBA Search" → Navigate to EBA tab

5. **Calendar export**
   - Click 📅 icon on follow-up → Downloads .ics file
   - Can import to Google Calendar, Outlook, etc.

---

## 📱 Mobile-Specific Features

### Responsive Adjustments:
- Form becomes full-screen on mobile
- Card grid becomes single column
- Table switches to mobile-optimized view
- Touch-friendly buttons and spacing

### Geofencing (Mobile Only):
When enabled:
```
┌────────────────────────────────┐
│  🔔  You're near Main Site     │
│  Tap to record site visit      │
└────────────────────────────────┘
      ↓ (User taps notification)
┌────────────────────────────────┐
│  Record Site Visit             │
│  Project: [Pre-filled]         │
│  Site: [Pre-filled]            │
│  ...                           │
└────────────────────────────────┘
```

---

## 🎓 Training Your Team

### Quick Training Script (5 minutes):

**For Organisers:**
> "When you visit a project site, you can now record it directly from the Projects page. 
> Just click the 'Record Site Visit' button on any project card or in the table. 
> The form lets you select multiple reasons for your visit, add follow-up actions, 
> and even export reminders to your calendar. 
> After recording, you'll see a green badge showing when the site was last visited."

**For Lead Organisers:**
> "You can now create custom visit reasons for your team. Go to the Lead Console 
> and click 'Manage Site Visit Reasons'. Any reasons you create will automatically 
> appear in the forms for organisers on your team. This helps track team-specific 
> activities beyond the standard reasons."

**For All Users:**
> "The new Site Visits feature helps us track our organizing activities systematically. 
> You can now see at a glance which projects haven't been visited in a while 
> (look for red or grey badges), record detailed visit information including 
> multiple reasons and outcomes, and set follow-up actions so nothing falls through 
> the cracks."

---

## 🔍 Where to Find Everything

### As a User:
- **Record visits**: Click button on project cards/table, or go to `/site-visits`
- **View history**: Project detail page → Site Visits tab
- **See status**: Look for colored badges on projects and mapping sheets

### As a Lead Organiser:
- **Manage reasons**: Lead Console → "Manage Site Visit Reasons" button
- **View team performance**: (Coming soon: Visit Coverage Card integration)

### As an Admin:
- **All of the above**, plus:
- **View all visits**: `/site-visits` page
- **Monitor usage**: Check database views (v_visit_reasons_summary, etc.)

---

## 🎁 Bonus: What You Get for Free

### Analytics Capabilities (via database views):
- Query visit patterns over time
- Identify high/low activity periods
- Track most-used visit reasons
- Monitor team productivity
- Generate custom reports

### Future Enhancements Ready:
- Photo attachments (schema ready)
- Offline sync (schema ready)
- Background geofencing (infrastructure ready)
- PDF export (views ready)
- Worker interaction tracking (extensible schema)

---

## 🏁 Ready to Use!

All integrations are **complete and tested** with:
- ✅ Zero linting errors
- ✅ TypeScript compiles successfully
- ✅ Responsive design
- ✅ Accessibility features
- ✅ Role-based permissions

**Just apply the migrations and start using it!** 🚀

See `QUICK_DEPLOY_CHECKLIST.md` for deployment steps.


