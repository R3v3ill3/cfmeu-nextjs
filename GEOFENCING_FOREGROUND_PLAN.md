# Foreground Geofencing Rollout

## Summary
- Geofencing reminders now run entirely in the foreground to align with iOS WebKit limitations.
- The feature is available to **organisers, lead organisers, and administrators**.
- The experience is optimized for users who install the CFMEU mobile PWA (Safari → Share → Add to Home Screen) from the production domain `https://cfmeu.uconstruct.app`.
- The same build also runs locally at `http://localhost:3000` for development, with service worker registration enabled on `localhost`.
- When the app/PWA is open, a lightweight service worker & manifest cache keep site data available and geolocation runs every ~60 seconds.

## Role-based behaviour
| Role | Sites visible | Info card |
|------|--------------|-----------|
| Admin | All job sites | "All Sites Visible" |
| Lead Organiser | All job sites | "All Sites Visible" + assigned patches shown |
| Organiser | Only sites in assigned patches | "Patch-Specific Notifications" |

## Behaviour Changes
- `useGeofencing` no longer depends on the Notification API. It only requires `navigator.geolocation`, tracks permission errors, and uses in-app toasts/banners instead of push notifications.
- Nearby site hits update `sessionStorage.pendingSiteVisit` so the `/site-visits` form can prefill the job site when launched.
- The settings screen now:
  - Prompts iOS users to install the PWA (re-usable `IosInstallPrompt` component with localStorage dismissal).
  - Shows real-time location permission status plus actionable error copy.
  - Surfaces nearby sites with a `Start visit` CTA that routes directly to the form.
  - Explains that reminders are foreground-only and require the app to stay open.

## Testing Checklist
1. Safari (iOS 16.4+) – standard tab hitting `https://cfmeu.uconstruct.app`:
   - Enable geofencing, grant “While Using the App” location.
   - Confirm nearby toast displays and in-card count updates.
2. Installed PWA (iOS home screen) from the same domain:
   - Launch from icon, verify install prompt no longer shows.
   - Confirm reminders still appear in-app while moving/using simulator location overrides.
3. Chrome/Android (either production domain or localhost for development):
   - Ensure prompt does not show; geolocation + toasts still fire.
4. Desktop fallback (localhost or Vercel preview):
   - Feature can be toggled but toasts appear only if location supported; unsupported browsers render the updated message.

Documented November 2025.

