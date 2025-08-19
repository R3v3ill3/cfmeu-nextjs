
export type AppRole = 'admin' | 'lead_organiser' | 'organiser' | 'delegate' | 'viewer';

export const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'lead_organiser', label: 'Lead organiser' },
  { value: 'organiser', label: 'Organiser' },
  { value: 'delegate', label: 'Delegate' },
  { value: 'viewer', label: 'Viewer' },
];
