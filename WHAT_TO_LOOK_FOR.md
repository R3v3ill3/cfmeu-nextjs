# What to Look For - Address Search Debug

I've added **visual toast notifications** that will pop up when you select an address.

## Test Process

1. Go to `/projects`
2. Click "Search by Address" tab
3. Type an address (e.g., "1 Martin Place, Sydney")
4. Select an address from the dropdown

## What Should Happen

You should see **TOAST NOTIFICATIONS** appear:

### If Callback IS Firing:
- 🔵 Blue toast: "Callback fired! Has coords: true/false" with lat/lng shown
- Then either:
  - ✅ Green toast: "Searching for projects near: [address]" (if it has coordinates)
  - ❌ Red toast: "No coordinates found in selected address" (if no coordinates)

### If Callback is NOT Firing:
- **No toasts appear at all** - This means GoogleAddressInput's onChange is not connected to handleAddressSelect

## What I Need to Know

**Do you see ANY toast notifications when you select an address?**

1. **YES - I see toasts**:
   - What do they say exactly?
   - Does the debug panel update after the toasts?
   - Copy/paste the console logs (the ones with `[Address Search]`)

2. **NO - No toasts appear**:
   - This means the onChange callback chain is broken
   - Check console for `[GoogleAddressInput]` logs
   - If you see GoogleAddressInput logs but no Address Search logs, the props aren't connected

## Console Logs to Check

Open console (F12), you should see logs with these prefixes:
- `[GoogleAddressInput]` - From the input component itself
- `[Address Search]` - From the page's handleAddressSelect callback  
- `[useAddressSearch]` - From the search hook

**Copy and paste ALL of these logs** - they'll show us exactly where it's breaking.

