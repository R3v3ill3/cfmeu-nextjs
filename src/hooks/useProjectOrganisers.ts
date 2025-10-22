"use client"

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolve organiser full names for a project via linked job sites → patches → organiser assignments.
 * Returns a stable, unique, comma-separated list string and the underlying array.
 */
export function useProjectOrganisers(projectId: string | null | undefined): { names: string[]; label: string } {
	const [names, setNames] = useState<string[]>([]);

	useEffect(() => {
		if (!projectId) { setNames([]); return; }

		const abortController = new AbortController();
		let cancelled = false;

		const load = async () => {
			try {
				// 1) Job sites for project
				const { data: sites, error: sitesError } = await (supabase as any)
					.from("job_sites")
					.select("id")
					.eq("project_id", projectId)
					.abortSignal(abortController.signal);

				if (sitesError) throw sitesError;
				if (cancelled) return;

				const siteIds = ((sites as any[]) || []).map((s: any) => s.id).filter(Boolean);
				if (siteIds.length === 0) { if (!cancelled) setNames([]); return; }

				// 2) Patches for those job sites
				const { data: pjs, error: patchError } = await (supabase as any)
					.from("patch_job_sites")
					.select("patch_id")
					.in("job_site_id", siteIds)
					.abortSignal(abortController.signal);

				if (patchError) throw patchError;
				if (cancelled) return;

				const patchIds = Array.from(new Set(((pjs as any[]) || []).map((r: any) => r.patch_id).filter(Boolean)));
				if (patchIds.length === 0) { if (!cancelled) setNames([]); return; }

				// 3) Organiser assignments (current only)
				const { data: orgs, error: orgsError } = await (supabase as any)
					.from("organiser_patch_assignments")
					.select("profiles:organiser_id(full_name)")
					.is("effective_to", null)
					.in("patch_id", patchIds)
					.abortSignal(abortController.signal);

				if (orgsError) throw orgsError;
				if (cancelled) return;

				const unique = new Set<string>();
				((orgs as any[]) || []).forEach((r: any) => {
					const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
					const n = (p?.full_name as string | undefined) || undefined;
					if (n) unique.add(n);
				});
				if (!cancelled) setNames(Array.from(unique.values()));
			} catch (error: any) {
				// Ignore abort errors as they're expected during cleanup
				if (error?.name === 'AbortError') return;
				console.error('Error loading project organisers:', error);
			}
		};

		load();

		return () => {
			cancelled = true;
			abortController.abort();
		};
	}, [projectId]);

	const label = useMemo(() => (names.length > 0 ? names.join(", ") : "—"), [names]);
	return { names, label };
}

