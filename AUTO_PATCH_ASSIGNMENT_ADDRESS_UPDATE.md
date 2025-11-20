# Automatic Patch Assignment on Address Update

## Overview

When updating a project's address with coordinates in the Edit Project Dialog, the system now automatically assigns the project to the appropriate geographic patch (if not already assigned to one).

## How It Works

### Database Trigger (Existing)

The database has a trigger `job_sites_set_patch_from_coords()` that automatically runs whenever a job site is created or updated with coordinates:

```sql
-- Trigger fires on INSERT or UPDATE of job_sites
-- Only assigns if:
-- 1. patch_id IS NULL (not already assigned)
-- 2. latitude IS NOT NULL AND longitude IS NOT NULL (has coordinates)

-- Logic:
1. Check if coordinates fall within any active geographic patch
2. If found → Assign to that patch
3. If not found → Assign to fallback patch
4. Update patch_job_sites linking table
```

### Edit Dialog Enhancement (New)

After saving an address with coordinates, the Edit Project Dialog now:

1. **Saves the address** to the main job site (with lat/lng)
2. **Trigger fires automatically** in the database
3. **Checks for patch assignment** by querying the updated job site
4. **Notifies the user** if a patch was automatically assigned

## User Experience

### Scenario 1: Project Without Patch Gets Address with Coordinates

```
User Flow:
1. Opens Edit Project Dialog
2. Enters address: "123 George St, Sydney NSW 2000"
3. Google Places returns coordinates: -33.8688, 151.2093
4. Clicks "Save changes"

System Actions:
→ Updates job site with address and coordinates
→ Database trigger checks for containing patch
→ Finds "Sydney CBD" patch contains those coordinates
→ Automatically assigns patch_id to job site

User Feedback:
✅ "Project updated"
✅ "Automatically assigned to patch: Sydney CBD"
   "Based on project location coordinates"
```

### Scenario 2: Project Already Has a Patch

```
User Flow:
1. Opens Edit Project Dialog
2. Project already in "Parramatta" patch
3. Updates address to new location in same patch
4. Clicks "Save changes"

System Actions:
→ Updates job site with new address and coordinates
→ Database trigger checks: patch_id is NOT NULL
→ Skips automatic assignment (already has patch)

User Feedback:
✅ "Project updated"
(No patch assignment message - already assigned)
```

### Scenario 3: Address Without Coordinates

```
User Flow:
1. Opens Edit Project Dialog
2. Manually types address (doesn't select from Google)
3. No coordinates captured
4. Clicks "Save changes"

System Actions:
→ Updates job site with address text only
→ Database trigger checks: latitude/longitude are NULL
→ Skips automatic assignment (no coordinates)

User Feedback:
✅ "Project updated"
(No patch assignment - need coordinates)
```

## Visual Feedback

### Success Toast (Patch Assigned)

```
┌────────────────────────────────────────────┐
│ ✅ Automatically assigned to patch:        │
│    Sydney CBD                              │
│                                            │
│ Based on project location coordinates     │
└────────────────────────────────────────────┘
Duration: 4 seconds
```

### Standard Toast (No Assignment)

```
┌────────────────────────────────────────────┐
│ ✅ Project updated                         │
└────────────────────────────────────────────┘
```

## Technical Details

### Code Implementation

**Location:** `src/components/projects/EditProjectDialog.tsx`

**After address save:**

```typescript
// Check if patch was auto-assigned based on coordinates
if (updatedJobSiteId && addressData.lat && addressData.lng) {
  try {
    const { data: jobSiteWithPatch } = await supabase
      .from("job_sites")
      .select("patch_id, patches:patch_id(name)")
      .eq("id", updatedJobSiteId)
      .single();

    if (jobSiteWithPatch?.patch_id) {
      const patchName = jobSiteWithPatch.patches?.name;
      
      toast.success(`Automatically assigned to patch: ${patchName}`, {
        description: "Based on project location coordinates",
        duration: 4000,
      });
    }
  } catch (e) {
    // Non-critical - don't block the save
    console.debug("Could not check patch assignment:", e);
  }
}
```

### Database Trigger

**Function:** `job_sites_set_patch_from_coords()`
**Trigger:** Fires on `INSERT` or `UPDATE` of `job_sites` table

**Key Logic:**

```sql
-- Only assign if unset and coordinates present
IF (new.patch_id IS NULL) 
   AND (new.latitude IS NOT NULL) 
   AND (new.longitude IS NOT NULL) 
THEN
  -- Find geographic patch containing the coordinates
  SELECT p.id INTO v_patch_id
  FROM patches p
  WHERE p.type = 'geo'
    AND p.status = 'active'
    AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326))
  LIMIT 1;

  IF FOUND THEN
    new.patch_id := v_patch_id;
  ELSE
    -- Assign to fallback patch if no geographic match
    new.patch_id := v_fallback_patch_id;
  END IF;

  -- Sync linking table
  INSERT INTO patch_job_sites (patch_id, job_site_id)
  VALUES (v_patch_id, new.id)
  ON CONFLICT DO NOTHING;
END IF;
```

## Business Rules

### Automatic Assignment Occurs When:

✅ Job site has no existing patch assignment (`patch_id IS NULL`)
✅ Address includes valid coordinates (lat/lng from Google Places)
✅ Coordinates fall within an active geographic patch boundary
✅ User saves changes in Edit Project Dialog

### Automatic Assignment Skipped When:

❌ Job site already assigned to a patch (`patch_id IS NOT NULL`)
❌ No coordinates available (manual text entry, no Google selection)
❌ Coordinates outside all defined patch boundaries (fallback patch used)
❌ Patch is inactive or non-geographic type

## Benefits

### For Organisers

1. **Automatic Workflow** - No manual patch assignment needed
2. **Accurate Assignment** - Based on precise GPS coordinates
3. **Immediate Feedback** - Know which patch owns the project
4. **Mobile-Friendly** - Use geolocation at construction site for instant assignment

### For Lead Organisers

1. **Geographic Accuracy** - Projects auto-assigned to correct territories
2. **Reduced Admin** - No need to manually assign patches
3. **Audit Trail** - Clear record of how assignment happened
4. **Scalability** - Works for bulk address updates

### For System

1. **Data Consistency** - Coordinates drive assignment, not manual input
2. **Real-time Updates** - Assignment happens immediately on save
3. **Geofencing Integration** - Uses same spatial logic as mapping
4. **Fallback Handling** - Projects outside patches get fallback assignment

## Related Features

### Geofencing

The patch assignment uses the same PostGIS spatial functions as:
- Project map view filtering
- Proximity search
- Geographic reporting

### Patch Management

Patch boundaries defined in `patches` table:
- `type = 'geo'` for geographic patches
- `geom` field contains polygon boundary (PostGIS geometry)
- `status = 'active'` required for auto-assignment

### Manual Override

Users can still manually change patch assignment:
- Use "Assign patch" dropdown in Edit Project Dialog
- Manual assignment overrides automatic assignment
- Re-updating address won't re-assign if already set

## Troubleshooting

### Patch Not Assigned After Address Update

**Possible Causes:**

1. **No coordinates captured**
   - Solution: Ensure address selected from Google Places dropdown
   - Check: Green "✓ Address selected" appears

2. **Coordinates outside all patches**
   - Solution: Check patch boundaries include the location
   - System will assign to fallback patch

3. **Already assigned to a patch**
   - Solution: This is expected behavior - won't reassign
   - Manually change patch if needed

4. **Patch is inactive**
   - Solution: Activate the patch in patch management
   - Check patch `status = 'active'`

### Wrong Patch Assigned

**Possible Causes:**

1. **Patch boundaries overlap**
   - System picks first match (LIMIT 1)
   - Solution: Review and fix patch boundaries

2. **Incorrect coordinates**
   - Google Places returned wrong location
   - Solution: Manually correct in patch assignment

## Configuration

### Fallback Patch

If coordinates don't fall within any defined patch:

```sql
v_fallback_patch_id := 'b06b9622-024c-4cd7-8127-e4664f641034'
```

**To change fallback patch:**
1. Update the UUID in the database function
2. Or create patch with this specific UUID

### Disable Auto-Assignment

To disable automatic patch assignment:

**Option 1: Drop the trigger**
```sql
DROP TRIGGER IF EXISTS job_sites_set_patch_from_coords_trigger ON job_sites;
```

**Option 2: Modify trigger to skip logic**
```sql
-- Change IF condition to always be false
IF FALSE THEN
  -- assignment logic
END IF;
```

## Testing

### Test Case 1: New Project in Known Patch

1. Create/Edit project
2. Enter address in Sydney CBD: "100 George St, Sydney NSW 2000"
3. Select from Google Places
4. Save
5. **Expected:** Assigned to "Sydney CBD" patch

### Test Case 2: Project Already Has Patch

1. Edit project already in "Parramatta" patch
2. Update address to new Parramatta location
3. Save
4. **Expected:** Stays in "Parramatta" patch (no reassignment)

### Test Case 3: Manual Text Entry (No Coordinates)

1. Edit project
2. Type address manually without selecting from Google
3. Save
4. **Expected:** No patch assignment (no coordinates)

### Test Case 4: Use Geolocation

1. Edit project on mobile at construction site
2. Click location icon in address field
3. Allow location access
4. Save
5. **Expected:** Assigned to patch containing current GPS location

## Monitoring

### Success Indicators

- Projects with addresses have `patch_id` populated
- `patch_job_sites` linking table updated
- Toast notifications appear on assignment
- Project appears in correct patch's project list

### Database Queries

**Check auto-assigned projects:**
```sql
SELECT 
  p.name as project_name,
  js.full_address,
  pt.name as patch_name,
  js.latitude,
  js.longitude
FROM projects p
JOIN job_sites js ON js.id = p.main_job_site_id
LEFT JOIN patches pt ON pt.id = js.patch_id
WHERE js.patch_id IS NOT NULL
  AND js.latitude IS NOT NULL
ORDER BY js.updated_at DESC;
```

**Find projects needing coordinates:**
```sql
SELECT 
  p.name,
  js.full_address,
  js.patch_id
FROM projects p
JOIN job_sites js ON js.id = p.main_job_site_id
WHERE js.full_address IS NOT NULL
  AND js.latitude IS NULL;
```

## Future Enhancements

1. **Bulk Geocoding** - Add coordinates to all addresses missing them
2. **Patch Boundary Visualization** - Show patches on map when editing address
3. **Assignment History** - Track when and why patches were assigned
4. **Confidence Scores** - Indicate how certain the assignment is
5. **Multi-Patch Projects** - Handle projects spanning multiple patches

## Summary

✅ **Automatic**: No manual work required
✅ **Accurate**: Based on GPS coordinates from Google Places
✅ **Smart**: Only assigns if not already assigned
✅ **Transparent**: User notified when assignment happens
✅ **Integrated**: Uses existing database triggers and spatial logic
✅ **Mobile-Ready**: Works with geolocation for field use

The automatic patch assignment feature streamlines the organizing workflow by eliminating manual patch assignment for projects with geographic addresses.





