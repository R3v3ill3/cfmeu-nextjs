# Site Visit Feature - Quick Start Guide

## For All Users

### Recording a Site Visit

1. Navigate to **Site Visits** page from the main navigation
2. Click **Record Site Visit** button
3. Fill in basic details:
   - **Date**: Visit date (defaults to today)
   - **Project**: Select the project
   - **Site**: Select the job site
   - **Employers**: Check employers you interacted with (optional)

4. Select **Visit Reasons**:
   - Check all applicable reasons (you can select multiple)
   - Add reason-specific notes if needed
   - Click "Show more reasons" to see additional options

5. Add **General Notes**: Overall observations, outcomes, etc.

6. Add **Follow-up Actions** (optional):
   - Type description and optional due date
   - Press Enter or click + to add
   - Click calendar icon to generate calendar event (.ics file)

7. Use **Quick Links** to:
   - Open Mapping Sheet for the project
   - Open Audit & Compliance tab
   - Open EBA Search tab

8. Choose how to save:
   - **Save Draft**: Save progress, finish later
   - **Complete Visit**: Mark visit as completed

### Using Geofencing (Mobile)

1. Navigate to **Settings** → **Site Visit Geofencing**
2. Toggle **Enable Geofencing** to ON
3. Grant location and notification permissions when prompted
4. When you're within 100m of a job site:
   - You'll receive a notification
   - Tap the notification to open pre-filled visit form
5. Complete and submit the visit

**Note**: Geofencing only works when the app is open (battery saving). Your location is never sent to servers.

### Viewing Visit History

1. Navigate to **Site Visits** page
2. Use filters to find visits:
   - Date range
   - Project
   - Organiser
   - Visit reason
3. Click a visit row to view/edit details

### Understanding Visit Badges

Color-coded badges show visit recency:
- **Bright Green**: Visited in last 3 months ✅
- **Light Green**: Visited 3-6 months ago
- **Orange**: Visited 6-12 months ago ⚠️
- **Red**: Not visited in 12+ months ❌
- **Grey**: Never visited

## For Lead Organisers

### Managing Custom Visit Reasons

1. Navigate to **Lead Console** → **Site Visit Reasons**
2. Click **Add Custom Reason**
3. Fill in:
   - **Display Name**: Name shown in form (e.g., "Safety Inspection")
   - **Description**: When to use this reason
   - **Always Visible**: Show by default (vs. in "more" section)
   - **Display Order**: Lower numbers appear first
4. Click **Create**

Your custom reasons will be available to all organisers in your team.

### Managing Existing Reasons

- Click **Edit** (pencil icon) to modify
- Click **Delete** (trash icon) to deactivate
- Use **Up/Down arrows** to reorder
- Deactivated reasons remain attached to old visits but don't appear in new forms

### Viewing Team Performance

Visit coverage statistics are available on your dashboard:
- **Last 3 Months**: Target 70%+ coverage
- **Last 6 Months**: Target 85%+ coverage
- **Last 12 Months**: Target 95%+ coverage

## For Admins

### Global Settings

- Global visit reasons can only be modified through database migrations
- Contact a developer to add/modify global reasons
- All RLS policies are automatically enforced

### Monitoring Usage

Check these views for insights:
- `v_visit_reasons_summary` - Most used reasons
- `v_patch_visit_coverage` - Coverage by patch
- `v_lead_organiser_visit_summary` - Team performance

## Tips & Best Practices

### 1. Select Multiple Reasons

A single visit often covers multiple purposes:
✅ Check "Compliance Audit" + "Delegate 1-on-1" + "Safety Issue"

### 2. Use Reason-Specific Notes

Instead of putting everything in general notes:
- Add context for each reason
- General notes for overall observations

### 3. Add Follow-up Actions Immediately

Don't rely on memory:
- "Call Bob about delegate training" - Due: next week
- "Follow up on safety complaint" - Due: 3 days
- Export to calendar so you don't forget

### 4. Use Context Links

After recording a visit:
- Update Mapping Sheet with new contractors
- Update Compliance tab with checks performed
- Search for EBAs for new employers

### 5. Review Visit Coverage

Lead Organisers should:
- Check coverage metrics monthly
- Focus on projects with red/orange badges
- Schedule visits for never-visited sites

### 6. Enable Geofencing

Organisers who do frequent site visits:
- Enable geofencing for automatic reminders
- Reduces forgotten visit recordings
- Tap notification = pre-filled form

### 7. Draft Workflow

For complex visits:
1. **Save Draft** at the site
2. Add detailed notes later
3. **Complete Visit** when done

## Common Questions

**Q: Can I edit a completed visit?**
A: Yes, if you created it or are a lead organiser/admin.

**Q: What happens to custom reasons if the lead leaves?**
A: They remain active and usable by the team.

**Q: Do I need to select an employer?**
A: No, employer selection is optional. General site visits don't require employer assignment.

**Q: Can I bulk record visits for multiple sites?**
A: Not currently. This is a planned future feature.

**Q: How accurate is geofencing?**
A: Within 100 meters. GPS accuracy depends on device and conditions.

**Q: Does geofencing drain my battery?**
A: Minimal impact. Location is checked every 60 seconds when app is open, and foreground-only checking saves significant battery.

**Q: Where is my location data stored?**
A: Nowhere. Your location is only used locally on your device to trigger notifications. It's never sent to servers unless you explicitly record a visit.

**Q: Can I see who visited a project?**
A: Yes, on the project overview page under visit history (feature requires integration).

**Q: What's the difference between "actions taken" and "follow-up actions"?**
A: "Actions taken" is free-text for what you did during the visit. "Follow-up actions" are structured tasks with due dates for things to do later.

## Troubleshooting

**Geofencing not working:**
- Check app is open (not in background)
- Verify location permissions granted
- Verify notification permissions granted
- Check you're within 100m of a job site with coordinates
- Wait 60 seconds for location check cycle

**Can't see custom reasons:**
- Verify you're assigned to a lead organiser
- Verify the lead has created custom reasons
- Check reasons are marked as "Active"

**Draft not saving:**
- Ensure project and site are selected
- Check internet connection
- Try "Complete Visit" instead

**Quick links not working:**
- Ensure you've selected a project
- Check you have permission to view that project

## Need Help?

Contact your lead organiser or system administrator for assistance.

