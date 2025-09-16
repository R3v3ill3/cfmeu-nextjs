
export type OrganisingUniverseStatus = 'active' | 'potential' | 'excluded' | null | undefined;

export function getOrganisingUniverseBadgeVariant(status: OrganisingUniverseStatus) {
  switch (status) {
    case 'active':
      return 'desktop-success';
    case 'potential':
      return 'desktop-warning';
    case 'excluded':
      return 'desktop-neutral';
    default:
      return 'secondary';
  }
}
