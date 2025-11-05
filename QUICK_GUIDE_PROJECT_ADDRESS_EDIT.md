# Quick Guide: Editing Project Addresses

## How to Edit a Project Address

### Step 1: Open the Edit Dialog
1. Navigate to a project's detail page
2. Click the **"Edit"** button at the top of the page

### Step 2: Enter or Update the Address
In the Edit Project dialog, you'll now see an **Address** field (located right after the Project Name):

**Option A: Type an Address**
- Start typing the project address
- Select from the Google Places suggestions that appear
- The address will be validated automatically

**Option B: Use Current Location** (Mobile Only)
- Click the location icon button
- Allow location access when prompted
- Your current position will be converted to an address

### Step 3: Save Changes
- Click **"Save changes"** at the bottom
- The address will be saved to the project's main job site
- If no main job site exists, one will be created automatically

## Features

### Address Validation
- ✓ Ensures Australian addresses only
- ✓ Validates completeness (street, suburb, state, postcode)
- ✓ Shows error messages for incomplete addresses
- ✓ Confirms when valid address is selected

### Automatic Coordinate Capture
When you select an address:
- Latitude and longitude are automatically captured
- Enables the project to appear on maps
- Supports proximity searches
- Enables automatic patch assignment

### Mobile-Friendly
- Large touch targets
- Geolocation support
- Responsive design
- Works on construction sites

## What Happens to the Address?

The address is saved to the project's **main job site**:
- If a main job site exists → address is updated
- If no main job site exists → one is created
- The address is stored in both `full_address` and `location` fields
- Coordinates are stored for mapping and search

## Common Scenarios

### Updating an Existing Address
1. Open Edit dialog
2. The current address will be pre-filled
3. Type a new address or modify the existing one
4. Select from Google suggestions
5. Save changes

### Adding an Address to a Project Without One
1. Open Edit dialog
2. The address field will be empty
3. Type the project address
4. Select from Google suggestions
5. Save - a main job site will be created automatically

### Using Geolocation (Mobile)
1. Visit the construction site
2. Open Edit dialog on your phone
3. Click the location icon
4. Allow location access
5. Your current location becomes the address
6. Save changes

## Tips

- **Always select from suggestions** - This ensures the address is validated and coordinates are captured
- **Be specific** - Include street number, street name, suburb
- **Verify on map** - After saving, check the project appears correctly on the map view
- **Mobile advantage** - Use geolocation when physically at the site for accuracy

## Troubleshooting

**Address not saving?**
- Ensure you selected an address from the dropdown (not just typed it)
- Check that it's an Australian address
- Verify all required components (street, suburb, state, postcode) are present

**Can't find the address?**
- Try entering just the street name and suburb
- Use Google Maps first to verify the address exists
- For new developments, use the nearest known address

**Geolocation not working?**
- Check browser/app location permissions
- Ensure GPS is enabled on your device
- Try refreshing the page
- Make sure you're using HTTPS (not HTTP)

**Address field is empty when editing?**
- The project may not have a main job site yet
- Simply enter the address and save - it will create one

## Data Impact

Editing a project address affects:
- **Maps** - Project location on map views
- **Proximity Search** - Finding nearby projects by address
- **Patch Assignment** - Automatic assignment to geographic patches
- **Site Visits** - Address used for navigation/directions
- **Mapping Sheets** - Address appears on printed sheets

## Need Help?

Contact your system administrator if:
- The address field doesn't appear in the Edit dialog
- You get permission errors when saving
- The address doesn't update after saving
- You need to manage multiple job sites for one project

