"use client"

import { Button } from "@/components/ui/button"
import { Phone, MessageSquare, Mail, Download, Copy, Share2 } from "lucide-react"
import { ios } from "@/utils/iosIntegrations"
import { cn } from "@/lib/utils"

interface ContactActionsProps {
  phone?: string | null
  email?: string | null
  name?: string
  organization?: string
  title?: string
  variant?: "inline" | "stacked" | "icons-only"
  size?: "sm" | "default"
  emailSubject?: string
  emailBody?: string
  smsMessage?: string
  showLabels?: boolean
  className?: string
}

/**
 * Reusable component for iOS-integrated contact actions
 * Shows clickable phone, SMS, and email buttons with iOS URL schemes
 */
export function ContactActions({
  phone,
  email,
  name,
  organization,
  title,
  variant = "inline",
  size = "sm",
  emailSubject,
  emailBody,
  smsMessage,
  showLabels = false,
  className,
}: ContactActionsProps) {
  const hasAnyContact = phone || email

  if (!hasAnyContact) {
    return null
  }

  const buttonSize = size
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4"

  const buttons = (
    <>
      {phone && (
        <>
          <Button
            size={buttonSize}
            variant="outline"
            onClick={() => ios.call(phone)}
            className={cn("gap-1", variant === "icons-only" && "px-2")}
            title="Call"
          >
            <Phone className={iconSize} />
            {showLabels && <span>Call</span>}
          </Button>

          <Button
            size={buttonSize}
            variant="outline"
            onClick={() => ios.sms(phone, smsMessage)}
            className={cn("gap-1", variant === "icons-only" && "px-2")}
            title="Send SMS"
          >
            <MessageSquare className={iconSize} />
            {showLabels && <span>Text</span>}
          </Button>
        </>
      )}

      {email && (
        <Button
          size={buttonSize}
          variant="outline"
          onClick={() =>
            ios.email({
              to: email,
              subject: emailSubject,
              body: emailBody,
            })
          }
          className={cn("gap-1", variant === "icons-only" && "px-2")}
          title="Send Email"
        >
          <Mail className={iconSize} />
          {showLabels && <span>Email</span>}
        </Button>
      )}
    </>
  )

  if (variant === "stacked") {
    return <div className={cn("flex flex-col gap-1", className)}>{buttons}</div>
  }

  return <div className={cn("flex flex-wrap gap-1", className)}>{buttons}</div>
}

interface PhoneLinkProps {
  phone: string
  className?: string
  showIcon?: boolean
}

/**
 * Clickable phone number link (tel:)
 */
export function PhoneLink({ phone, className, showIcon = true }: PhoneLinkProps) {
  const formatted = ios.formatPhone(phone)

  return (
    <button
      type="button"
      onClick={() => ios.call(phone)}
      className={cn(
        "text-primary hover:underline inline-flex items-center gap-1 font-normal",
        className
      )}
    >
      {showIcon && <Phone className="h-3 w-3" />}
      {formatted}
    </button>
  )
}

interface EmailLinkProps {
  email: string
  subject?: string
  body?: string
  className?: string
  showIcon?: boolean
}

/**
 * Clickable email link (mailto:)
 */
export function EmailLink({ email, subject, body, className, showIcon = true }: EmailLinkProps) {
  return (
    <button
      type="button"
      onClick={() => ios.email({ to: email, subject, body })}
      className={cn(
        "text-primary hover:underline inline-flex items-center gap-1 font-normal",
        className
      )}
    >
      {showIcon && <Mail className="h-3 w-3" />}
      {email}
    </button>
  )
}

interface ContactCardActionsProps {
  contact: {
    name: string
    role?: string
    organization: string
    phone?: string | null
    email?: string | null
    address?: string | null
  }
  projectName?: string
}

/**
 * Complete set of actions for a contact (call, SMS, email, export)
 */
export function ContactCardActions({ contact, projectName }: ContactCardActionsProps) {
  const [firstName, ...lastNameParts] = contact.name.split(" ")
  const lastName = lastNameParts.join(" ") || firstName

  const exportContact = () => {
    ios.exportContact({
      firstName,
      lastName,
      organization: contact.organization,
      title: contact.role || "Contact",
      phone: contact.phone || undefined,
      email: contact.email || undefined,
      address: contact.address || undefined,
    })
  }

  const copyContact = () => {
    const text = `${contact.name}
${contact.role ? `${contact.role}\n` : ''}${contact.organization}
${contact.phone ? `Phone: ${contact.phone}\n` : ''}${contact.email ? `Email: ${contact.email}` : ''}`

    ios.copy(text, "Contact info copied")
  }

  return (
    <div className="space-y-2">
      {/* Communication actions */}
      <div className="flex flex-wrap gap-2">
        <ContactActions
          phone={contact.phone}
          email={contact.email}
          emailSubject={projectName ? `Re: ${projectName}` : undefined}
          showLabels={true}
          size="sm"
        />
      </div>

      {/* Export actions */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={exportContact} className="gap-1">
          <Download className="h-3 w-3" />
          Add to Contacts
        </Button>

        <Button size="sm" variant="outline" onClick={copyContact} className="gap-1">
          <Copy className="h-3 w-3" />
          Copy Info
        </Button>
      </div>
    </div>
  )
}


