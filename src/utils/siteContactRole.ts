export const SITE_CONTACT_ROLES = [
  'project_manager',
  'site_manager',
  'site_delegate',
  'site_hsr',
] as const

export type SiteContactRoleValue = (typeof SITE_CONTACT_ROLES)[number]

export function normalizeSiteContactRole(value: unknown): SiteContactRoleValue | null {
  if (!value) return null
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')

  const match = SITE_CONTACT_ROLES.find((role) => role === normalized)
  return match ?? null
}
