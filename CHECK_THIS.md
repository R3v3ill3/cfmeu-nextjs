# CRITICAL DIAGNOSTIC QUESTION

You said "address match works fine, there's just nothing that happens after that"

This means:
1. ✅ Google autocomplete dropdown appears
2. ✅ You can type and see suggestions
3. ✅ You can click/select an address
4. ❌ After selection, the debug panel stays empty

## URGENT: Check Console for These Exact Messages

Open browser console (F12 → Console tab), **clear it**, then select an address.

Do you see **ANY** of these log messages? (Copy/paste what you see):

1. `[GoogleAddressInput] place_changed event fired`
2. `[GoogleAddressInput] Extracted coordinates: { lat: ..., lng: ..., formatted: ... }`
3. `[GoogleAddressInput] Calling onChange with: { hasCoordinates: true, ... }`
4. `[Address Search] handleAddressSelect called`
5. `[Address Search] Setting URL params`

## If You See NONE of These Logs

The onChange callback isn't connected properly. This could be because:
- The GoogleAddressInput is being recreated on every render
- The onChange prop reference is changing
- Something is preventing the callback from being called

## If You See Logs 1-3 But NOT 4-5

The Google autocomplete is working, but the callback chain is broken between GoogleAddressInput and the page component.

## Please Copy/Paste

Copy and paste the ENTIRE console output after selecting an address, even if it looks empty. Include any warnings, info messages, everything.

