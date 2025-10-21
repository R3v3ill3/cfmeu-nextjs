/**
 * iOS-optimized integrations for web app
 * Handles phone calls, SMS, email, maps, calendar, contacts, and sharing
 */

import { toast } from "sonner"

// ============================================
// Phone & Messaging
// ============================================

/**
 * Initiate phone call via tel: URL scheme
 * iOS will show "Call [number]?" confirmation dialog
 */
export function makePhoneCall(phoneNumber: string) {
  const cleaned = phoneNumber.replace(/[^0-9+]/g, '')
  if (!cleaned) {
    toast.error("Invalid phone number")
    return
  }
  window.location.href = `tel:${cleaned}`
}

/**
 * Open SMS/iMessage app with optional pre-filled message
 */
export function sendSMS(phoneNumber: string, message?: string) {
  const cleaned = phoneNumber.replace(/[^0-9+]/g, '')
  if (!cleaned) {
    toast.error("Invalid phone number")
    return
  }
  const body = message ? `&body=${encodeURIComponent(message)}` : ''
  window.location.href = `sms:${cleaned}${body}`
}

/**
 * Open WhatsApp (if installed) with pre-filled message
 */
export function sendWhatsApp(phoneNumber: string, message: string) {
  // Convert Australian number (04xx xxx xxx) to international (+61 4xx xxx xxx)
  const intl = phoneNumber.replace(/^0/, '61').replace(/[^0-9]/g, '')
  const text = encodeURIComponent(message)
  window.location.href = `https://wa.me/${intl}?text=${text}`
}

// ============================================
// Email
// ============================================

export interface EmailOptions {
  to: string
  subject?: string
  body?: string
  cc?: string
  bcc?: string
}

/**
 * Open default email client with pre-filled email
 */
export function sendEmail(options: EmailOptions) {
  if (!options.to) {
    toast.error("Email address required")
    return
  }
  
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

// ============================================
// Maps & Navigation
// ============================================

export interface DirectionsOptions {
  latitude?: number
  longitude?: number
  address: string
  placeName: string
}

/**
 * Open Apple Maps with directions (iOS default)
 */
export function openAppleMapsDirections(options: DirectionsOptions) {
  if (options.latitude && options.longitude) {
    const name = encodeURIComponent(options.placeName)
    // ll = destination coords, q = place name, saddr = start location, dirflg = d (driving)
    const url = `maps://?ll=${options.latitude},${options.longitude}&q=${name}&saddr=Current%20Location&dirflg=d`
    window.location.href = url
  } else {
    // Fallback to address if no coordinates
    const query = encodeURIComponent(options.address)
    const url = `maps://?q=${query}&saddr=Current%20Location&dirflg=d`
    window.location.href = url
  }
}

/**
 * Open Google Maps (fallback)
 */
export function openGoogleMapsDirections(options: DirectionsOptions) {
  let url = 'https://www.google.com/maps/dir/?api=1'
  
  if (options.latitude && options.longitude) {
    url += `&destination=${options.latitude},${options.longitude}`
  } else {
    url += `&destination=${encodeURIComponent(options.address)}`
  }
  
  window.open(url, '_blank')
}

/**
 * Smart maps launcher - tries Apple Maps first, provides fallback
 */
export function getDirections(options: DirectionsOptions) {
  // iOS will open Apple Maps automatically
  openAppleMapsDirections(options)
}

// ============================================
// Calendar Integration
// ============================================

export interface CalendarEvent {
  title: string
  startDate: string // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  endDate?: string
  notes?: string
  location?: string
  allDay?: boolean
}

/**
 * Add event to iOS Calendar (improved for native feel)
 */
export function addToAppleCalendar(event: CalendarEvent) {
  // Parse dates
  const startDate = new Date(event.startDate)
  const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 3600000) // +1 hour
  
  // Format for iCalendar
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }
  
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CFMEU//Organizer App//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
${event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}` : ''}
${event.location ? `LOCATION:${event.location}` : ''}
UID:${Date.now()}@cfmeu.org.au
DTSTAMP:${formatDate(new Date())}
END:VEVENT
END:VCALENDAR`

  // Create blob
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  // Create temporary link and trigger download
  // iOS will recognize .ics and offer to add to Calendar
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100)
  
  toast.success("Calendar event ready - tap to add to your calendar")
}

// ============================================
// Contacts (vCard)
// ============================================

export interface ContactInfo {
  firstName: string
  lastName: string
  organization: string
  title: string
  phone?: string
  email?: string
  address?: string
}

/**
 * Export contact as vCard for iOS Contacts
 */
export function exportAsVCard(contact: ContactInfo) {
  const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${contact.firstName} ${contact.lastName}
N:${contact.lastName};${contact.firstName};;;
ORG:${contact.organization}
TITLE:${contact.title}
${contact.phone ? `TEL;TYPE=WORK,VOICE:${contact.phone}` : ''}
${contact.email ? `EMAIL;TYPE=INTERNET:${contact.email}` : ''}
${contact.address ? `ADR;TYPE=WORK:;;${contact.address};;;;Australia` : ''}
END:VCARD`

  const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `${contact.firstName}_${contact.lastName}.vcf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  setTimeout(() => URL.revokeObjectURL(url), 100)
  
  toast.success("Contact card ready - tap to add to your contacts")
}

// ============================================
// Sharing (iOS Share Sheet)
// ============================================

export interface ShareOptions {
  title: string
  text: string
  url?: string
  fallbackMessage?: string
}

/**
 * Share content via iOS Share Sheet
 * Falls back to clipboard if not supported
 */
export async function shareContent(options: ShareOptions): Promise<boolean> {
  // Check if Web Share API is supported
  if (!navigator.share) {
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(options.text)
      toast.success(options.fallbackMessage || "Copied to clipboard")
      return false
    } catch (err) {
      toast.error("Sharing not supported on this device")
      return false
    }
  }
  
  try {
    await navigator.share({
      title: options.title,
      text: options.text,
      url: options.url,
    })
    return true
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // User cancelled, not an error
      return false
    }
    // Fallback to clipboard
    try {
      await navigator.clipboard.writeText(options.text)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to share")
    }
    return false
  }
}

// ============================================
// Clipboard
// ============================================

/**
 * Copy text to clipboard with iOS fallback
 */
export async function copyToClipboard(text: string, successMessage?: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage || "Copied to clipboard")
    return true
  } catch (err) {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      
      if (success) {
        toast.success(successMessage || "Copied to clipboard")
        return true
      }
    } catch {
      // Silent fail
    }
    toast.error("Failed to copy")
    return false
  }
}

/**
 * Copy with rich formatting (HTML + plain text)
 */
export async function copyRichText(htmlContent: string, plainText: string): Promise<boolean> {
  try {
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
    const textBlob = new Blob([plainText], { type: 'text/plain' })
    
    const clipboardItem = new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob,
    })
    
    await navigator.clipboard.write([clipboardItem])
    toast.success("Copied with formatting")
    return true
  } catch {
    // Fallback to plain text
    return copyToClipboard(plainText)
  }
}

// ============================================
// Device Detection
// ============================================

/**
 * Check if running on iOS device
 */
export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
}

/**
 * Check if running as PWA (installed to home screen)
 */
export function isRunningAsPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://')
}

/**
 * Check if Web Share API is supported
 */
export function canShare(): boolean {
  return 'share' in navigator
}

// ============================================
// Haptic Feedback
// ============================================

export type HapticType = 'success' | 'warning' | 'error' | 'light' | 'medium' | 'heavy'

/**
 * Trigger haptic feedback (vibration) on iOS
 */
export function hapticFeedback(type: HapticType = 'light') {
  const patterns: Record<HapticType, number | number[]> = {
    success: [50],
    warning: [100, 50, 100],
    error: [100, 50, 100, 50, 100],
    light: [10],
    medium: [25],
    heavy: [50],
  }
  
  if ('vibrate' in navigator) {
    navigator.vibrate(patterns[type])
  }
}

// ============================================
// PWA Installation
// ============================================

/**
 * Check if app can be installed to home screen
 */
export function canInstallPWA(): boolean {
  // iOS doesn't support beforeinstallprompt
  // Users must manually add via Safari share button
  return isIOS() && !isRunningAsPWA()
}

/**
 * Show instructions for adding to home screen (iOS)
 */
export function showIOSInstallInstructions(): string {
  return `To add this app to your home screen:
1. Tap the Share button (square with arrow) in Safari
2. Scroll down and tap "Add to Home Screen"
3. Tap "Add" in the top-right corner`
}

// ============================================
// Utility Helpers
// ============================================

/**
 * Format phone number for display (Australian)
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '')
  
  // Mobile: 04XX XXX XXX
  if (cleaned.startsWith('04') && cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`
  }
  
  // Landline: (0X) XXXX XXXX
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)} ${cleaned.slice(6)}`
  }
  
  // International or other
  return phone
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate phone number (Australian format)
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '')
  // Australian mobile (04XX XXX XXX) or landline (0X XXXX XXXX)
  return /^0[2-9]\d{8}$/.test(cleaned)
}

// ============================================
// Export All
// ============================================

export const ios = {
  // Communication
  call: makePhoneCall,
  sms: sendSMS,
  whatsapp: sendWhatsApp,
  email: sendEmail,
  
  // Navigation
  getDirections: openAppleMapsDirections,
  getDirectionsGoogle: openGoogleMapsDirections,
  openMaps: getDirections,
  
  // Calendar
  addToCalendar: addToAppleCalendar,
  
  // Contacts
  exportContact: exportAsVCard,
  
  // Sharing
  share: shareContent,
  copy: copyToClipboard,
  copyRich: copyRichText,
  
  // Haptics
  haptic: hapticFeedback,
  
  // Device
  isIOS,
  isPWA: isRunningAsPWA,
  canShare,
  canInstall: canInstallPWA,
  installInstructions: showIOSInstallInstructions,
  
  // Formatting
  formatPhone: formatPhoneNumber,
  isValidEmail,
  isValidPhone: isValidPhoneNumber,
}

export default ios

// ============================================
// Helper function declarations for direct use
// ============================================

function openAppleMapsDirections(options: DirectionsOptions) {
  if (options.latitude && options.longitude) {
    const name = encodeURIComponent(options.placeName)
    const url = `maps://?ll=${options.latitude},${options.longitude}&q=${name}&saddr=Current%20Location&dirflg=d`
    window.location.href = url
  } else {
    const query = encodeURIComponent(options.address)
    const url = `maps://?q=${query}&saddr=Current%20Location&dirflg=d`
    window.location.href = url
  }
}

function openGoogleMapsDirections(options: DirectionsOptions) {
  let url = 'https://www.google.com/maps/dir/?api=1'
  
  if (options.latitude && options.longitude) {
    url += `&destination=${options.latitude},${options.longitude}`
  } else {
    url += `&destination=${encodeURIComponent(options.address)}`
  }
  
  window.open(url, '_blank')
}

function getDirections(options: DirectionsOptions) {
  openAppleMapsDirections(options)
}

function addToAppleCalendar(event: CalendarEvent) {
  const startDate = new Date(event.startDate)
  const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 3600000)
  
  const formatDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  }
  
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//CFMEU//Organizer App//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
${event.notes ? `DESCRIPTION:${event.notes.replace(/\n/g, '\\n')}` : ''}
${event.location ? `LOCATION:${event.location}` : ''}
UID:${Date.now()}@cfmeu.org.au
DTSTAMP:${formatDate(new Date())}
STATUS:CONFIRMED
SEQUENCE:0
END:VEVENT
END:VCALENDAR`

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  setTimeout(() => URL.revokeObjectURL(url), 100)
  
  toast.success("Calendar event ready - tap to add to Calendar")
}

function exportAsVCard(contact: ContactInfo) {
  const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${contact.firstName} ${contact.lastName}
N:${contact.lastName};${contact.firstName};;;
ORG:${contact.organization}
TITLE:${contact.title}
${contact.phone ? `TEL;TYPE=WORK,VOICE:${contact.phone}` : ''}
${contact.email ? `EMAIL;TYPE=INTERNET:${contact.email}` : ''}
${contact.address ? `ADR;TYPE=WORK:;;${contact.address};;;;Australia` : ''}
NOTE:Added from CFMEU Organizer App
END:VCARD`

  const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const a = document.createElement('a')
  a.href = url
  a.download = `${contact.firstName}_${contact.lastName}.vcf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  
  setTimeout(() => URL.revokeObjectURL(url), 100)
  
  toast.success("Contact card ready - tap to add to your contacts")
}

async function shareContent(options: ShareOptions): Promise<boolean> {
  if (!navigator.share) {
    try {
      await navigator.clipboard.writeText(options.text)
      toast.success(options.fallbackMessage || "Copied to clipboard")
      return false
    } catch {
      toast.error("Sharing not supported")
      return false
    }
  }
  
  try {
    await navigator.share({
      title: options.title,
      text: options.text,
      url: options.url,
    })
    return true
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return false
    }
    try {
      await navigator.clipboard.writeText(options.text)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to share")
    }
    return false
  }
}

async function copyToClipboard(text: string, successMessage?: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(successMessage || "Copied to clipboard")
    return true
  } catch {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      
      if (success) {
        toast.success(successMessage || "Copied to clipboard")
        return true
      }
    } catch {
      // Silent fail
    }
    toast.error("Failed to copy")
    return false
  }
}

async function copyRichText(htmlContent: string, plainText: string): Promise<boolean> {
  try {
    const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
    const textBlob = new Blob([plainText], { type: 'text/plain' })
    
    const clipboardItem = new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob,
    })
    
    await navigator.clipboard.write([clipboardItem])
    toast.success("Copied with formatting")
    return true
  } catch {
    return copyToClipboard(plainText)
  }
}


