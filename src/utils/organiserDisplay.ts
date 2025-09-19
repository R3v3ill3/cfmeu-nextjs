const DEFAULT_STATUS = 'pending'

const capitalize = (value: string) => {
  if (!value) return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

const roleLabel = (role?: string | null) => {
  if (!role) return 'organiser'
  if (role === 'lead_organiser') return 'lead'
  if (role === 'organiser') return 'organiser'
  return role.replace(/_/g, ' ')
}

const statusLabel = (status?: string | null) => {
  const raw = (status || DEFAULT_STATUS).replace(/_/g, ' ').toLowerCase()
  return capitalize(raw)
}

export const PENDING_USER_DASHBOARD_STATUSES = ["draft", "invited", "requested"] as const

export type PendingUserLike = {
  full_name?: string | null
  email?: string | null
  role?: string | null
  status?: string | null
}

export function formatPendingOrganiserName(user: PendingUserLike): string | null {
  const name = user.full_name?.trim() || user.email?.trim()
  if (!name) return null
  const status = statusLabel(user.status)
  const role = roleLabel(user.role)
  return `${name} (${status} ${role})`
}

export function mergeOrganiserNameLists(
  liveNames: string[],
  pendingUsers: PendingUserLike[]
): string[] {
  const seen = new Set<string>()
  const merged: string[] = []

  liveNames.forEach((name) => {
    if (!seen.has(name)) {
      seen.add(name)
      merged.push(name)
    }
  })

  pendingUsers.forEach((user) => {
    const formatted = formatPendingOrganiserName(user)
    if (formatted && !seen.has(formatted)) {
      seen.add(formatted)
      merged.push(formatted)
    }
  })

  return merged
}
