# iOS Integration Features - Comprehensive Analysis & Implementation Guide

## 🎯 Overview

iOS Safari supports powerful URL schemes that allow web apps to trigger native iOS apps directly. Here's what's possible for your CFMEU app with iOS-only users.

---

## ✅ 1. Apple Calendar Integration

### What's Possible

**Option A: Add to Calendar via URL Scheme** ✅ **Recommended**
- Opens iOS Calendar app directly
- Pre-fills event details
- User taps "Add" to confirm

**Option B: Download .ics File** ✅ **Currently Implemented**
- Downloads calendar file
- User opens file → iOS Calendar imports it
- Works but requires extra tap

**Option C: webcal:// Protocol** ✅ **Advanced**
- Subscribe to calendar feed
- For recurring events or shared calendars

### Implementation for Follow-Up Actions

**Current**: We generate .ics file download
**Better for iOS**: Direct calendar URL scheme

```typescript
// iOS Calendar URL Scheme
const addToCalendar = (followUp: FollowUpAction, visitDetails: {
  siteName: string
  projectName: string
  visitDate: string
}) => {
  const title = encodeURIComponent(`Follow-up: ${followUp.description}`)
  const notes = encodeURIComponent(
    `Site visit follow-up\nProject: ${visitDetails.projectName}\nSite: ${visitDetails.siteName}\nOriginal visit: ${visitDetails.visitDate}`
  )
  const startDate = followUp.due_date || visitDetails.visitDate
  // Format: YYYYMMDD
  const dateFormatted = startDate.replace(/-/g, '')
  
  // For iOS Calendar app
  const calendarUrl = `calshow:${dateFormatted}`
  
  // Alternative: Use data URI for better control
  const icsContent = `
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${dateFormatted}T090000Z
SUMMARY:${followUp.description}
DESCRIPTION:${notes}
END:VEVENT
END:VCALENDAR
  `.trim()
  
  const dataUri = `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`
  
  // iOS will prompt to add to calendar
  window.location.href = dataUri
}
```

**Even Better**: Direct native calendar sheet
```typescript
// iOS 15+ supports this
const calendarUrl = `webcal://[your-server]/api/calendar/event?id=${followUpId}`
// Or simpler:
window.open(`data:text/calendar,...`, '_blank')
```

**Recommendation**: Offer BOTH options
- Button 1: "Add to iOS Calendar" (URL scheme - direct)
- Button 2: "Download .ics" (current implementation - works everywhere)

---

## ✅ 2. Maps & Directions Integration

### What's Possible

**Option A: Apple Maps** ✅ **Native iOS, Best Experience**
```typescript
// Opens Apple Maps with directions
const openAppleMaps = (address: string, siteName: string) => {
  const query = encodeURIComponent(address)
  const mapsUrl = `maps://maps.apple.com/?q=${query}&saddr=Current%20Location`
  window.location.href = mapsUrl
}

// With coordinates (better accuracy)
const openAppleMapsCoords = (lat: number, lon: number, siteName: string) => {
  const label = encodeURIComponent(siteName)
  const mapsUrl = `maps://?ll=${lat},${lon}&q=${label}&saddr=Current%20Location`
  window.location.href = mapsUrl
}
```

**Option B: Google Maps** ✅ **Fallback**
```typescript
// Opens Google Maps app (if installed) or web
const openGoogleMaps = (address: string) => {
  const query = encodeURIComponent(address)
  // Try app first
  const appUrl = `comgooglemaps://?q=${query}&directionsmode=driving`
  // Fallback to web
  const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${query}`
  
  // Try app, fallback to web
  window.location.href = appUrl
  setTimeout(() => {
    window.location.href = webUrl
  }, 250)
}
```

**Option C: Smart Link (Detect User Preference)** ✅ **Best UX**
```typescript
const openDirections = (lat: number, lon: number, address: string, siteName: string) => {
  // iOS automatically opens Apple Maps
  const appleMapsUrl = `maps://?ll=${lat},${lon}&q=${encodeURIComponent(siteName)}&saddr=Current%20Location`
  window.location.href = appleMapsUrl
}
```

### Where to Add This

**1. In Site Visit Form** (When site is selected):
```tsx
<Button 
  variant="outline" 
  onClick={() => openDirections(
    selectedSite.latitude, 
    selectedSite.longitude,
    selectedSite.full_address,
    selectedSite.name
  )}
>
  <MapPin className="h-4 w-4 mr-2" />
  Get Directions
</Button>
```

**2. In Project Site Visits Cards**:
Each visit card could have a "Get Directions" button

**3. In Site Contacts Table**:
Show directions to the site where the contact works

---

## ✅ 3. Phone Call & SMS Integration

### What's Possible

**Direct Calling** ✅ **Universal Support**
```typescript
const makeCall = (phoneNumber: string) => {
  // Cleans and formats number
  const cleaned = phoneNumber.replace(/[^0-9+]/g, '')
  window.location.href = `tel:${cleaned}`
}

// iOS will show confirmation dialog:
// "Call 0412 345 678?"
// [Cancel] [Call]
```

**SMS/iMessage** ✅ **Universal Support**
```typescript
const sendSMS = (phoneNumber: string, message?: string) => {
  const cleaned = phoneNumber.replace(/[^0-9+]/g, '')
  const body = message ? `&body=${encodeURIComponent(message)}` : ''
  window.location.href = `sms:${cleaned}${body}`
}

// Pre-filled message for site visits:
sendSMS('0412345678', 'Hi, this is [organiser] from CFMEU. I visited your site today...')
```

**WhatsApp** ✅ **If Users Have App**
```typescript
const openWhatsApp = (phoneNumber: string, message: string) => {
  // Remove leading 0, add 61 for Australia
  const intl = phoneNumber.replace(/^0/, '61').replace(/[^0-9]/g, '')
  const text = encodeURIComponent(message)
  window.location.href = `https://wa.me/${intl}?text=${text}`
}
```

### Where to Integrate

**In Site Contacts Display**:
```tsx
{contact.phone && (
  <div className="flex gap-2">
    <Button size="sm" onClick={() => makeCall(contact.phone)}>
      <Phone className="h-4 w-4" />
      Call
    </Button>
    <Button size="sm" variant="outline" onClick={() => sendSMS(contact.phone)}>
      <MessageSquare className="h-4 w-4" />
      Text
    </Button>
  </div>
)}
```

**In Site Visit Form** (When site selected):
- Show site contacts
- Click phone number → Call
- Click message icon → SMS

---

## ✅ 4. Email Integration

### What's Possible

**Basic mailto:** ✅ **Universal**
```typescript
const sendEmail = (email: string, subject?: string, body?: string) => {
  let url = `mailto:${email}`
  const params = []
  
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
  if (body) params.push(`body=${encodeURIComponent(body)}`)
  
  if (params.length > 0) {
    url += `?${params.join('&')}`
  }
  
  window.location.href = url
}
```

**Pre-filled Email for Site Visits**:
```typescript
sendEmail(
  'site.manager@builder.com.au',
  'CFMEU Site Visit Follow-up',
  `Hi [Name],

I visited [Site Name] on [Date] and wanted to follow up on:

[Follow-up details]

Regards,
[Organiser Name]
CFMEU`
)
```

### Where to Integrate

**In Site Contacts**:
```tsx
{contact.email && (
  <Button 
    size="sm" 
    variant="outline"
    onClick={() => sendEmail(
      contact.email,
      `Re: ${projectName} - Site Visit`,
      `Hi ${contact.name},\n\nI visited ${siteName} today...`
    )}
  >
    <Mail className="h-4 w-4 mr-2" />
    Email
  </Button>
)}
```

**In Follow-Up Actions**:
- "Email site manager about safety issue" → Pre-fills email with details

---

## 🎁 5. Additional iOS Integration Options

### A. Share Sheet (Native iOS Sharing) ✅ **Highly Recommended**

```typescript
// iOS Share Sheet
const shareVisitSummary = async (visitDetails: {
  projectName: string
  siteName: string
  date: string
  reasons: string[]
  notes: string
}) => {
  const summary = `
Site Visit Summary
Project: ${visitDetails.projectName}
Site: ${visitDetails.siteName}
Date: ${visitDetails.date}
Reasons: ${visitDetails.reasons.join(', ')}

Notes:
${visitDetails.notes}
  `.trim()

  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Site Visit Summary',
        text: summary,
        url: window.location.href,
      })
    } catch (err) {
      // User cancelled
    }
  } else {
    // Fallback: Copy to clipboard
    navigator.clipboard.writeText(summary)
    toast.success('Summary copied to clipboard')
  }
}
```

**Use Cases**:
- Share visit summary with team
- Send notes to colleague
- Forward to email/Messages
- Copy for reporting

### B. Add to Contacts (vCard) ✅ **For Site Contacts**

```typescript
const exportContact = (contact: {
  name: string
  role: string
  phone?: string
  email?: string
  company: string
}) => {
  const vCard = `
BEGIN:VCARD
VERSION:3.0
FN:${contact.name}
ORG:${contact.company}
TITLE:${contact.role}
${contact.phone ? `TEL;TYPE=WORK:${contact.phone}` : ''}
${contact.email ? `EMAIL:${contact.email}` : ''}
NOTE:${contact.company} - ${contact.role}
END:VCARD
  `.trim()

  const blob = new Blob([vCard], { type: 'text/vcard' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${contact.name.replace(/\s+/g, '_')}.vcf`
  a.click()
  URL.revokeObjectURL(url)
}
```

**Use Case**: Quickly add site manager to iOS Contacts

### C. Copy to Clipboard ✅ **Quick Sharing**

```typescript
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    toast.success('Copied to clipboard')
  }
}
```

**Use Cases**:
- Copy address for pasting elsewhere
- Copy phone number
- Copy visit notes

### D. Home Screen Installation (PWA) ✅ **App-Like Experience**

```typescript
// Add to Home Screen prompt
let deferredPrompt: any = null

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferredPrompt = e
  // Show custom "Add to Home Screen" prompt
})

const installApp = async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      toast.success('App installed to home screen!')
    }
    deferredPrompt = null
  }
}
```

**Benefits**:
- App icon on home screen
- Full-screen experience (no Safari UI)
- Faster access
- Feels like native app

### E. Camera Integration ✅ **Photo Attachments**

```typescript
// Direct camera access (for photo attachments)
<input 
  type="file" 
  accept="image/*" 
  capture="environment"  // Rear camera
  onChange={handlePhotoUpload}
/>

// Or for front camera:
capture="user"
```

**Use Case**: Attach photos to site visits (safety issues, compliance evidence)

### F. Vibration API ✅ **Haptic Feedback**

```typescript
// Subtle haptic feedback on important actions
const vibrate = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

// Examples:
vibrate(50)           // Short pulse
vibrate([100, 50, 100]) // Pattern: buzz-pause-buzz

// Use for:
// - Visit recorded successfully
// - Entering geofence
// - Form validation errors
```

### G. Web Push Notifications ✅ **Persistent Notifications**

We already implemented browser notifications. iOS 16.4+ supports Web Push!

**Additional capability**: Rich notifications
```typescript
// With action buttons (iOS 16.4+)
const registration = await navigator.serviceWorker.ready
registration.showNotification('Site Visit Reminder', {
  body: "You're near Main Site",
  actions: [
    { action: 'record', title: 'Record Visit' },
    { action: 'dismiss', title: 'Not Now' },
  ],
  icon: '/icon-192x192.png',
  badge: '/badge-72x72.png',
})
```

### H. Siri Shortcuts / Web App Shortcuts ✅ **iOS 17+**

```html
<!-- In your app's <head> -->
<link rel="apple-touch-icon" href="/icon-180x180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

<!-- Define shortcuts -->
<link rel="manifest" href="/manifest.json">
```

In manifest.json:
```json
{
  "shortcuts": [
    {
      "name": "Record Site Visit",
      "url": "/site-visits?openForm=true",
      "description": "Quickly record a site visit"
    },
    {
      "name": "View Projects",
      "url": "/projects",
      "description": "Browse projects"
    }
  ]
}
```

### I. Biometric Authentication ✅ **Face ID / Touch ID**

```typescript
// Web Authentication API (WebAuthn)
// For secure login without passwords

const authenticateWithBiometrics = async () => {
  if (window.PublicKeyCredential) {
    // User can log in with Face ID / Touch ID
    // More secure than passwords
    // Faster login experience
  }
}
```

**Use Case**: Quick re-authentication after session timeout

### J. iOS Keyboard Shortcuts ✅ **Dictation**

iOS automatically provides:
- 🎤 **Voice dictation** in text fields (microphone button on keyboard)
- ✏️ **Scribble** on iPad (handwriting recognition)
- 📋 **Copy/Paste** with context menu

**No code needed** - just ensure text fields are properly labeled:
```tsx
<Textarea 
  placeholder="Tap microphone on keyboard for voice notes..."
  aria-label="Visit notes"
/>
```

---

## 🚀 Implementation Priority

### High Priority (Implement Now)

| Feature | Complexity | Impact | iOS Support |
|---------|------------|--------|-------------|
| **Phone calling** (tel:) | Very Low | High | 100% |
| **SMS/iMessage** (sms:) | Very Low | High | 100% |
| **Email** (mailto:) | Very Low | High | 100% |
| **Apple Maps directions** | Low | Very High | 100% |
| **Share sheet** | Low | High | iOS 12.2+ |
| **Calendar (improved)** | Medium | Medium | 100% |

### Medium Priority (Next Phase)

| Feature | Complexity | Impact | iOS Support |
|---------|------------|--------|-------------|
| **vCard export** | Low | Medium | 100% |
| **Copy to clipboard** | Very Low | Medium | 100% |
| **Camera integration** | Low | High | 100% |
| **Haptic feedback** | Very Low | Low | 100% |

### Low Priority (Future)

| Feature | Complexity | Impact | iOS Support |
|---------|------------|--------|-------------|
| **PWA home screen** | Medium | Medium | 100% |
| **Siri shortcuts** | High | Low | iOS 17+ |
| **Web push actions** | Medium | Low | iOS 16.4+ |
| **WebAuthn** | High | Medium | iOS 15+ |

---

## 📋 Recommended Implementation Plan

### Phase 1: Communication Links (Easiest, Highest Impact)

**Effort**: 1-2 hours  
**Files**: Create utility functions + update site contacts display

**Create**: `src/utils/iosIntegrations.ts`
```typescript
export const iosIntegrations = {
  call: (phone: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '')
    window.location.href = `tel:${cleaned}`
  },
  
  sms: (phone: string, message?: string) => {
    const cleaned = phone.replace(/[^0-9+]/g, '')
    const body = message ? `&body=${encodeURIComponent(message)}` : ''
    window.location.href = `sms:${cleaned}${body}`
  },
  
  email: (email: string, subject?: string, body?: string) => {
    let url = `mailto:${email}`
    const params = []
    if (subject) params.push(`subject=${encodeURIComponent(subject)}`)
    if (body) params.push(`body=${encodeURIComponent(body)}`)
    if (params.length > 0) url += `?${params.join('&')}`
    window.location.href = url
  },
}
```

**Update**: Site contacts table to use these links

### Phase 2: Navigation Integration (Easy, Very Useful)

**Effort**: 1-2 hours  
**Impact**: Huge - organisers always need directions

**Add to**: `src/utils/iosIntegrations.ts`
```typescript
export const iosIntegrations = {
  // ... existing functions
  
  getDirections: (lat: number, lon: number, placeName: string) => {
    // Apple Maps (iOS default)
    const name = encodeURIComponent(placeName)
    window.location.href = `maps://?ll=${lat},${lon}&q=${name}&saddr=Current%20Location&dirflg=d`
  },
  
  getDirectionsByAddress: (address: string) => {
    const query = encodeURIComponent(address)
    window.location.href = `maps://?q=${query}&saddr=Current%20Location&dirflg=d`
  },
}
```

**Add to**: Site visit form, project detail page, site contacts

### Phase 3: Enhanced Calendar Integration (Medium Effort)

**Effort**: 2-3 hours  
**Impact**: Medium - improves follow-up tracking

**Improve current .ics download** with iOS-specific optimizations:
```typescript
const addToCalendar = {
  // Existing .ics download (keep for cross-platform)
  downloadICS: (event) => { /* current implementation */ },
  
  // New: iOS-optimized
  addToAppleCalendar: (event) => {
    // Better for iOS
    const icsData = generateICS(event)
    const blob = new Blob([icsData], { type: 'text/calendar' })
    const url = URL.createObjectURL(blob)
    
    // On iOS, this opens Calendar app directly
    window.location.href = url
    
    setTimeout(() => URL.revokeObjectURL(url), 100)
  },
}
```

### Phase 4: Share & Export (Easy, Nice-to-Have)

**Effort**: 1 hour  
**Impact**: Medium - convenient for users

**Add**: Share button to visit summary, site contacts, etc.

---

## 💻 Practical Implementation

Let me create the iOS integrations utility and show you how to use it:

### File: `src/utils/iosIntegrations.ts`

```typescript
/**
 * iOS-optimized integrations for web app
 * Handles phone calls, SMS, email, maps, calendar, and sharing
 */

// Phone Call
export function makePhoneCall(phoneNumber: string) {
  const cleaned = phoneNumber.replace(/[^0-9+]/g, '')
  window.location.href = `tel:${cleaned}`
}

// SMS / iMessage
export function sendSMS(phoneNumber: string, message?: string) {
  const cleaned = phoneNumber.replace(/[^0-9+]/g, '')
  const body = message ? `&body=${encodeURIComponent(message)}` : ''
  window.location.href = `sms:${cleaned}${body}`
}

// Email
export function sendEmail(options: {
  to: string
  subject?: string
  body?: string
  cc?: string
  bcc?: string
}) {
  let url = `mailto:${options.to}`
  const params: string[] = []
  
  if (options.subject) params.push(`subject=${encodeURIComponent(options.subject)}`)
  if (options.body) params.push(`body=${encodeURIComponent(options.body)}`)
  if (options.cc) params.push(`cc=${options.cc}`)
  if (options.bcc) params.push(`bcc=${options.bcc}`)
  
  if (params.length > 0) {
    url += `?${params.join('&')}`
  }
  
  window.location.href = url
}

// Apple Maps Directions
export function openAppleMapsDirections(options: {
  latitude: number
  longitude: number
  placeName: string
  address?: string
}) {
  const name = encodeURIComponent(options.placeName)
  // ll = destination coords, q = place name, saddr = start (Current Location), dirflg = d (driving)
  const url = `maps://?ll=${options.latitude},${options.longitude}&q=${name}&saddr=Current%20Location&dirflg=d`
  window.location.href = url
}

// Google Maps (fallback)
export function openGoogleMapsDirections(options: {
  latitude?: number
  longitude?: number
  address?: string
}) {
  let url = 'https://www.google.com/maps/dir/?api=1'
  
  if (options.latitude && options.longitude) {
    url += `&destination=${options.latitude},${options.longitude}`
  } else if (options.address) {
    url += `&destination=${encodeURIComponent(options.address)}`
  }
  
  window.location.href = url
}

// Smart Maps (tries Apple Maps, fallbacks to Google)
export function getDirections(options: {
  latitude?: number
  longitude?: number
  address: string
  placeName: string
}) {
  // iOS will automatically open Apple Maps
  if (options.latitude && options.longitude) {
    openAppleMapsDirections({
      latitude: options.latitude,
      longitude: options.longitude,
      placeName: options.placeName,
      address: options.address,
    })
  } else {
    // Fallback to Google if no coordinates
    openGoogleMapsDirections({ address: options.address })
  }
}

// Share via iOS Share Sheet
export async function shareContent(options: {
  title: string
  text: string
  url?: string
}): Promise<boolean> {
  if (!navigator.share) {
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(options.text)
      return false // Indicate fallback was used
    } catch {
      return false
    }
  }
  
  try {
    await navigator.share(options)
    return true
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // User cancelled, not an error
      return false
    }
    throw err
  }
}

// Add to iOS Calendar (improved)
export function addToAppleCalendar(event: {
  title: string
  startDate: string // YYYY-MM-DD
  endDate?: string
  notes?: string
  location?: string
  allDay?: boolean
}) {
  const startFormatted = event.startDate.replace(/-/g, '')
  const endFormatted = event.endDate?.replace(/-/g, '') || startFormatted
  
  const timeStart = event.allDay ? '' : 'T090000Z'
  const timeEnd = event.allDay ? '' : 'T100000Z'
  
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CFMEU//Site Visit//EN
CALSCALE:GREGORIAN
BEGIN:VEVENT
DTSTART:${startFormatted}${timeStart}
DTEND:${endFormatted}${timeEnd}
SUMMARY:${event.title}
${event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}` : ''}
${event.location ? `LOCATION:${event.location}` : ''}
UID:${Date.now()}@cfmeu.org.au
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
END:VEVENT
END:VCALENDAR`

  // Create blob and trigger download
  // iOS will recognize .ics and offer to add to Calendar
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/\s+/g, '_')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// Export contact as vCard
export function exportAsVCard(contact: {
  firstName: string
  lastName: string
  organization: string
  title: string
  phone?: string
  email?: string
  address?: string
}) {
  const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${contact.firstName} ${contact.lastName}
N:${contact.lastName};${contact.firstName};;;
ORG:${contact.organization}
TITLE:${contact.title}
${contact.phone ? `TEL;TYPE=WORK,VOICE:${contact.phone}` : ''}
${contact.email ? `EMAIL;TYPE=INTERNET:${contact.email}` : ''}
${contact.address ? `ADR;TYPE=WORK:;;${contact.address};;;;` : ''}
END:VCARD`

  const blob = new Blob([vCard], { type: 'text/vcard' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${contact.firstName}_${contact.lastName}.vcf`
  a.click()
  URL.revokeObjectURL(url)
}

// Check if running as PWA
export function isRunningAsPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true
}

// Check if iOS
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

// Haptic feedback (iOS-friendly)
export function hapticFeedback(type: 'success' | 'warning' | 'error' | 'selection' = 'selection') {
  const patterns = {
    success: [50],
    warning: [100, 50, 100],
    error: [100, 50, 100, 50, 100],
    selection: [10],
  }
  
  if ('vibrate' in navigator) {
    navigator.vibrate(patterns[type])
  }
}
```

---

## 🎯 Recommended Integration Points

### 1. Site Visit Form - Add Action Buttons

```tsx
// When a site is selected, show:

<div className="flex flex-wrap gap-2">
  {/* Existing context buttons */}
  <Button onClick={openMappingSheet}>Mapping Sheet</Button>
  <Button onClick={openCompliance}>Compliance</Button>
  
  {/* NEW: Get directions */}
  {selectedSite.latitude && selectedSite.longitude && (
    <Button 
      variant="outline"
      onClick={() => getDirections({
        latitude: selectedSite.latitude,
        longitude: selectedSite.longitude,
        address: selectedSite.full_address,
        placeName: selectedSite.name,
      })}
    >
      <Navigation className="h-4 w-4 mr-2" />
      Get Directions
    </Button>
  )}
  
  {/* NEW: View site contacts */}
  <Button variant="outline" onClick={showSiteContacts}>
    <Users className="h-4 w-4 mr-2" />
    Site Contacts
  </Button>
</div>
```

### 2. Site Contacts - Make Everything Clickable

```tsx
// Current: Plain text phone/email
// New: Clickable links

<TableRow>
  <TableCell>{contact.name}</TableCell>
  <TableCell>{contact.role}</TableCell>
  
  {/* Phone - clickable */}
  <TableCell>
    {contact.phone ? (
      <div className="flex gap-1">
        <Button 
          size="sm" 
          variant="ghost"
          onClick={() => makePhoneCall(contact.phone)}
          className="text-primary hover:underline font-normal justify-start p-0 h-auto"
        >
          <Phone className="h-3 w-3 mr-1" />
          {contact.phone}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => sendSMS(contact.phone)}
          title="Send SMS"
        >
          <MessageSquare className="h-3 w-3" />
        </Button>
      </div>
    ) : '—'}
  </TableCell>
  
  {/* Email - clickable */}
  <TableCell>
    {contact.email ? (
      <Button 
        size="sm" 
        variant="ghost"
        onClick={() => sendEmail({
          to: contact.email,
          subject: `Re: ${projectName}`,
        })}
        className="text-primary hover:underline font-normal justify-start p-0 h-auto"
      >
        <Mail className="h-3 w-3 mr-1" />
        {contact.email}
      </Button>
    ) : '—'}
  </TableCell>
  
  {/* Actions */}
  <TableCell>
    <Button 
      size="sm" 
      variant="outline"
      onClick={() => exportAsVCard(contact)}
    >
      Add to Contacts
    </Button>
  </TableCell>
</TableRow>
```

### 3. Follow-Up Actions - Enhanced Calendar

```tsx
// Current: Download .ics
// Add: iOS-optimized calendar

<div className="flex gap-2">
  <Button onClick={() => addToAppleCalendar(followUp)}>
    <Calendar className="h-4 w-4 mr-2" />
    Add to Calendar
  </Button>
  
  <Button 
    variant="outline"
    onClick={() => downloadICS(followUp)}
  >
    Download .ics
  </Button>
</div>
```

### 4. Project/Site Cards - Quick Actions

```tsx
// Add to project cards:

<div className="flex gap-2 mt-2">
  <Button 
    size="sm" 
    variant="outline"
    onClick={() => getDirections(...)}
  >
    <Navigation className="h-3 w-3 mr-1" />
    Directions
  </Button>
  
  <Button
    size="sm"
    variant="outline"
    onClick={() => shareContent({
      title: project.name,
      text: `Project: ${project.name}\nAddress: ${project.address}`,
      url: `/projects/${project.id}`,
    })}
  >
    <Share className="h-3 w-3 mr-1" />
    Share
  </Button>
</div>
```

---

## 🎨 UI Examples

### Enhanced Site Contacts Table

**Before**:
```
| Name          | Role           | Phone        | Email              |
|---------------|----------------|--------------|---------------------|
| John Smith    | Site Manager   | 0412345678  | john@builder.com.au|
```

**After**:
```
| Name          | Role           | Phone                    | Email                        | Actions        |
|---------------|----------------|--------------------------|------------------------------|----------------|
| John Smith    | Site Manager   | [📞 0412345678] [💬]    | [✉️ john@builder.com.au]    | [Add Contact] |
                                       ↑ tap to call  ↑ SMS       ↑ tap to email        ↑ vCard export
```

### Enhanced Site Visit Form

**Add to form when site is selected**:
```
┌─ Quick Actions ─────────────────────────────────────┐
│ [📄 Open Mapping Sheet] [✓ Audit & Compliance]     │
│ [🧭 Get Directions]     [👥 Site Contacts]         │  ← NEW!
└─────────────────────────────────────────────────────┘
```

**When clicking "Site Contacts"**:
```
┌─ Site Contacts ────────────────────────────────┐
│ John Smith - Site Manager                      │
│ [📞 0412 345 678]  [💬 Text]  [✉️ Email]      │
│                                                 │
│ Sarah Jones - HSR                               │
│ [📞 0423 456 789]  [💬 Text]  [✉️ Email]      │
│                                                 │
│ [Add All to Contacts]                          │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Additional iOS-Specific Suggestions

### 1. Quick Actions from Home Screen ✅ **iOS 13+**

When user adds app to home screen, they can 3D Touch/long-press icon for quick actions:

**manifest.json shortcuts**:
```json
{
  "shortcuts": [
    {
      "name": "Record Site Visit",
      "short_name": "New Visit",
      "description": "Quickly record a site visit",
      "url": "/site-visits?openForm=true",
      "icons": [{ "src": "/icons/visit-96.png", "sizes": "96x96" }]
    },
    {
      "name": "My Projects",
      "short_name": "Projects",
      "url": "/projects",
      "icons": [{ "src": "/icons/projects-96.png", "sizes": "96x96" }]
    }
  ]
}
```

### 2. iOS Widgets (Future) ✅ **iOS 17+**

Web apps can now provide widget data:
- Show "projects needing visits" widget
- Display last visit dates
- Quick access buttons

**Requires**: More complex setup with web app manifest

### 3. Live Activities (Future) ✅ **iOS 16.1+**

Dynamic Island integration for ongoing activities:
- Show "Site visit in progress"
- Timer since arrival
- Quick complete button

**Requires**: Advanced PWA + server setup

### 4. Focus Modes Integration ✅ **iOS 15+**

```html
<!-- Respect iOS Focus modes -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

App won't send notifications during user's Focus time (e.g., "Do Not Disturb")

### 5. Clipboard with Rich Data ✅ **iOS 14+**

```typescript
// Copy rich formatted text
const copyRichText = async (htmlContent: string, plainText: string) => {
  const blob = new Blob([htmlContent], { type: 'text/html' })
  const clipboardItem = new ClipboardItem({
    'text/html': blob,
    'text/plain': new Blob([plainText], { type: 'text/plain' })
  })
  await navigator.clipboard.write([clipboardItem])
}
```

### 6. Picture-in-Picture (Future) ✅ **iOS 15+**

For video tutorials or site diagrams:
```typescript
if (document.pictureInPictureEnabled) {
  videoElement.requestPictureInPicture()
}
```

---

## 🚀 Implementation Roadmap

### Week 1: Core Communication (Highest ROI)
- [ ] Create `iosIntegrations.ts` utility
- [ ] Add tel: links to all phone numbers
- [ ] Add mailto: links to all emails
- [ ] Add SMS buttons next to phone numbers
- [ ] Test on actual iPhone

**Effort**: 3-4 hours  
**Impact**: Immediate value for all iOS users

### Week 2: Maps & Navigation
- [ ] Add "Get Directions" to site visit form
- [ ] Add directions to project cards
- [ ] Add directions to site contacts
- [ ] Test Apple Maps integration

**Effort**: 2-3 hours  
**Impact**: Huge - organisers always need directions

### Week 3: Enhanced Calendar & Contacts
- [ ] Improve calendar export for iOS
- [ ] Add vCard export for contacts
- [ ] Add share button for visit summaries
- [ ] Test on iOS devices

**Effort**: 3-4 hours  
**Impact**: Medium - convenience features

### Week 4: Polish & Advanced Features
- [ ] Add haptic feedback on key actions
- [ ] Implement share sheet
- [ ] Add clipboard utilities
- [ ] PWA optimization

**Effort**: 4-5 hours  
**Impact**: Nice-to-have polish

---

## 📊 Feature Comparison

| Feature | Current State | With iOS Integration | Benefit |
|---------|---------------|----------------------|---------|
| Phone numbers | Plain text | Click to call + SMS | One-tap communication |
| Email addresses | Plain text | Click to email | Pre-filled messages |
| Addresses | Text only | Click for directions | Turn-by-turn navigation |
| Contacts | Manual entry | Export to iOS Contacts | Easy access later |
| Calendar events | Download .ics | Direct calendar add | Faster, more native |
| Visit sharing | Not available | iOS Share Sheet | Easy team collaboration |

---

## 💡 My Recommendations

### Must-Have (Do First)
1. ✅ **tel: links** - Click to call (5 minutes)
2. ✅ **mailto: links** - Click to email (5 minutes)
3. ✅ **sms: links** - Click to text (10 minutes)
4. ✅ **maps:// links** - Click for directions (15 minutes)

**Total effort**: 35 minutes  
**Impact**: Transforms UX for iOS users

### Should-Have (Do Soon)
5. ✅ **Share sheet** - Share visit summaries (30 minutes)
6. ✅ **vCard export** - Add contacts to phone (30 minutes)
7. ✅ **Improved calendar** - Better iOS integration (20 minutes)

**Total effort**: 1.5 hours additional  
**Impact**: Professional, polished experience

### Nice-to-Have (Future)
8. ⏳ Haptic feedback (10 minutes)
9. ⏳ PWA home screen prompts (1 hour)
10. ⏳ Rich clipboard support (30 minutes)

---

## 🎯 Next Steps

Want me to:
1. ✅ **Implement core integrations now?** (tel, mailto, sms, maps) - 35 minutes
2. ✅ **Create utility file only?** - You integrate it yourself
3. ✅ **Full implementation?** - All recommended features

Let me know and I'll build it out for you!


