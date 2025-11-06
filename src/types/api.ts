// API-specific Type Definitions
// Replaces 'as any' assertions with proper TypeScript interfaces

import { Database } from './database';

// Profile and User Types
export interface UserProfile {
  id: string;
  role: 'admin' | 'lead_organiser' | 'organiser' | 'delegate' | 'viewer';
  first_name?: string;
  surname?: string;
  last_seen_projects_at?: string | null;
}

export type ProfileSelect = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'role' | 'full_name' | 'last_seen_projects_at'>;

// Organiser Patch Assignment Types
export interface OrganiserPatchAssignment {
  organiser_id: string;
  patch_id: string;
}

export interface LeadOrganiserPatchAssignment {
  lead_organiser_id: string;
  patch_id: string;
}

// Patch Project Mapping Types
export interface PatchProjectMapping {
  patch_id: string;
  project_id: string;
}

// Project List Comprehensive View Types
export interface ProjectListComprehensive {
  id: string;
  created_at: string;
}

// Scan Processing Types
export interface ScanProjectDecision {
  name?: string;
  value?: number;
  proposed_start_date?: string;
  proposed_finish_date?: string;
  roe_email?: string;
  project_type?: string | null;
  state_funding?: boolean;
  federal_funding?: boolean;
  address?: string;
  address_latitude?: number;
  address_longitude?: number;
  builder?: {
    matchedEmployer?: {
      id: string;
      name: string;
      abn?: string;
    };
    createNew?: boolean;
    newEmployerData?: any;
    displayName?: string;
    matchConfidence?: number;
    matchNotes?: string;
  };
}

export interface ScanContactDecision {
  role: string;
  existingId?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  action: 'update' | 'create' | 'skip';
}

export interface NormalizedContact {
  role: string;
  existingId?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface EmployerCreation {
  name: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
  trade_type?: string;
}

// RPC Response Types
export interface CreateProjectFromScanResult {
  success: boolean;
  projectId?: string;
  jobSiteId?: string;
  error?: string;
  status?: number;
}

export interface OrganisingUniverseResult {
  success: boolean;
  error?: string;
}

// API Response Wrapper Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status?: number;
  success?: boolean;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  count: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
}

// Utility Types for Common Operations
export type EmployerSelect = Pick<Database['public']['Tables']['employers']['Row'], 'id' | 'name' | 'abn'>;

// Type guards and validation helpers
export function isValidRole(role: string | null): role is UserProfile['role'] {
  return role === 'admin' || role === 'lead_organiser' || role === 'organiser' || role === 'delegate' || role === 'viewer';
}

export function asUserProfile(profile: ProfileSelect | null): UserProfile | null {
  if (!profile) return null;
  if (!isValidRole(profile.role)) return null;

  const nameParts = profile.full_name?.split(' ') || [];
  const firstName = nameParts[0];
  const surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

  return {
    id: profile.id,
    role: profile.role,
    first_name: firstName || undefined,
    surname: surname || undefined,
    last_seen_projects_at: profile.last_seen_projects_at,
  };
}

// Array helpers for type-safe operations
export function mapPatchAssignments<T extends { patch_id: string }>(assignments: T[] | null): string[] {
  if (!assignments) return [];
  return Array.from(new Set(assignments.map((r: T) => r.patch_id).filter((id): id is string => Boolean(id))));
}

export function mapProjectIds<T extends { project_id: string }>(projects: T[] | null): string[] {
  if (!projects) return [];
  return Array.from(new Set((projects || []).map((r: T) => r.project_id).filter((id): id is string => Boolean(id))));
}