# iOS Geofencing Setup Guide for CFMEU App

## Required iOS Settings for Geofencing

For geofencing to work properly on iPhone, users must ensure the following settings are configured correctly:

### 1. Install as PWA (Progressive Web App)
- Open Safari on iPhone
- Navigate to `https://cfmeu.uconstruct.app`
- Sign in as organiser/admin
- Tap the Share button (square with arrow)
- Select "Add to Home Screen"
- Name it "CFMEU" and tap "Add"
- **Always launch from the home screen icon**, not Safari bookmarks

### 2. Location Services Settings
Go to: **Settings > Privacy & Security > Location Services**

1. **Enable Location Services** (must be ON)
2. Find **CFMEU** in the app list
3. Set location access to: **"While Using the App"**
4. **DO NOT** set to "Never" or "Ask Next Time"

### 3. Safari Settings (Critical for PWA)
Go to: **Settings > Safari**

1. **Location** → Set to **"Ask"** or **"Allow"**
2. **Prevent Cross-Site Tracking** → Turn **OFF** (can interfere with PWA)
3. **Block All Cookies** → Turn **OFF** (PWA needs cookies for auth)

### 4. Notification Settings (for reminders)
Go to: **Settings > Notifications > CFMEU**
- **Allow Notifications** → ON
- **Alerts** → Enable Banners
- **Sounds** → Optional, but helpful
- **Badges** → Optional

### 5. Background App Refresh (Optional but helpful)
Go to: **Settings > General > Background App Refresh**
- Find **CFMEU** and ensure it's **ON**
- This helps maintain location checks when switching apps

## Troubleshooting

### If toggle is greyed out in Settings:

1. **Check if you're in the PWA**
   - Must be launched from home screen icon
   - Not in regular Safari browser tab

2. **Verify Location Permission Flow**
   - The first tap should trigger iOS permission dialog
   - Must select "While Using"
   - If you accidentally denied, go to Settings to reset

3. **Clear Safari Data if needed**
   - Settings > Safari > Clear History and Website Data
   - This will reset all permissions

4. **Reinstall PWA**
   - Remove from home screen (long press > Remove App)
   - Clear Safari data
   - Re-add to home screen

### iOS Version Requirements
- **iOS 16.4+** recommended for best PWA experience
- iOS 13+ minimum requirement for geolocation API

### Safari-specific Notes
- Safari doesn't support the Permissions API for geolocation
- The permission dialog only appears on first location request
- Once denied in Safari, must be reset in iOS Settings

## Testing Steps

1. Launch CFMEU PWA from home screen
2. Go to Settings
3. Tap "Enable Geofencing"
4. Should see iOS location permission dialog
5. Select "While Using the App"
6. Toggle should now be active
7. Move near a job site to test notifications

## Common Issues

### Issue: "Your browser doesn't expose foreground geolocation"
**Solution**: You're likely in Safari, not the PWA. Install from home screen.

### Issue: Toggle not clickable
**Solution**: Check iOS Location Services settings, ensure CFMEU has permission.

### Issue: No location permission dialog
**Solution**: Go to Settings > Privacy > Location Services > CFMEU and set to "While Using".

### Issue: Permission denied message
**Solution**: Reset permission in iOS Settings, then retry in the app.

## Developer Debugging

To add debug logging, open console on connected Mac:
```javascript
// In Safari Web Inspector on connected Mac
localStorage.setItem('debug-geofencing', 'true')
```

This will enable detailed logging in the geofencing hook.