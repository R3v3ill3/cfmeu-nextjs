import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateInput from "@/components/ui/date-input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Allowed options (exact labels as provided)
const ACTIVITY_TYPES = [
	"Site Visit",
	"Phone Calling",
	"Off-site Meeting",
	"Virtual Town Hall",
	"SMS - Blast",
	"SMS - Peer-to-Peer (P2P)",
	"SMS - Survey",
	"SMS - Action",
	"Online-to-Offline",
	"Email action",
	"Boss meetings",
	"EBA negotiations",
	"EBA signing meetings",
];

const CALLS_TO_ACTION = [
	"stop work meeting",
	"Protected action ballot",
	"EBA Ballot",
	"delegate elections",
	"petition",
	"rally",
	"off-site meeting",
	"grievance",
	"Survey",
	"FSL – financial standing list",
];

const OBJECTIVE_PREFILLS = [
	"Membership growth",
	"FSL's completed (total)",
	"FSL's completed (delegates)",
	"Member leader identification (union role-specific)",
	"Hard assess on participation:",
	"Signatures",
	"Attendance",
	"Soft assess on Commitments",
];

const MEMBERSHIP_STATUSES = ["member", "non_member", "potential", "declined"];

interface CampaignActivityBuilderProps {
	campaignId: string;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}

export function CampaignActivityBuilder({ campaignId, open, onOpenChange }: CampaignActivityBuilderProps) {
	const qc = useQueryClient();
	// Basics
	const [date, setDate] = useState("");
	const [topic, setTopic] = useState("");
	const [notes, setNotes] = useState("");
	const [activityType, setActivityType] = useState<string>("");
	const [callToAction, setCallToAction] = useState<string>("");

	// Rating definitions 1..5 (fixed labels + editable definitions)
	const [ratingDefs, setRatingDefs] = useState<Record<number, string>>({
		1: "",
		2: "",
		3: "",
		4: "",
		5: "",
	});
	const [showRatingDefs, setShowRatingDefs] = useState<boolean>(false);

	// Scope builder
	const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
	const [selectedEmployers, setSelectedEmployers] = useState<string[]>([]);
	const [selectedSites, setSelectedSites] = useState<string[]>([]);
	const [expandVia, setExpandVia] = useState<"project" | "employer">("project");
	const [scopeOpen, setScopeOpen] = useState<boolean>(false);

	// Universe filter hints (UI only for now)
	const [membershipFocus, setMembershipFocus] = useState<string[]>([]);
	const [occupations, setOccupations] = useState<string[]>([]);
	const [prevRatings, setPrevRatings] = useState<number[]>([]);

	// Objectives
	type ObjectiveDraft = { id: string; name: string; kind: "number" | "percent"; value: number };
	const [objectives, setObjectives] = useState<ObjectiveDraft[]>([]);
	// Subgroup overrides keyed by objective id -> { dim, id, value }
	type Override = { dimension: "project" | "employer" | "job_site"; dimension_id: string; value: number };
	const [overrides, setOverrides] = useState<Record<string, Override[]>>({});

	// Reference data
	const { data: projects = [] } = useQuery({
		queryKey: ["projects-min"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("projects")
				.select("id, name")
				.order("name");
			if (error) throw error;
			return data || [];
		},
	});

	const { data: employers = [] } = useQuery({
		queryKey: ["employers-min"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("employers")
				.select("id, name")
				.order("name");
			if (error) throw error;
			return data || [];
		},
	});

	const { data: jobSites = [] } = useQuery({
		queryKey: ["job-sites-min"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("job_sites")
				.select("id, name, location, project_id")
				.order("name");
			if (error) throw error;
			return data || [];
		},
	});

	// Current user id and role
	const { data: userInfo } = useQuery({
		queryKey: ["current-user-role"],
		queryFn: async () => {
			const { data: auth } = await supabase.auth.getUser();
			const uid = (auth as any)?.user?.id as string | undefined;
			if (!uid) return { userId: null as any, role: null as any };
			const { data: prof } = await supabase
				.from("profiles")
				.select("id, role")
				.eq("id", uid)
				.single();
			return { userId: uid, role: (prof as any)?.role || null } as { userId: string; role: string | null };
		},
	});

	// Accessible project ids per role (null => all)
	const { data: accessibleProjectIds } = useQuery({
		queryKey: ["accessible-project-ids", (userInfo as any)?.userId, (userInfo as any)?.role],
		enabled: !!(userInfo as any)?.userId,
		queryFn: async () => {
			const role = (userInfo as any)?.role;
			const uid = (userInfo as any)?.userId as string;
			if (!uid) return [] as string[];
			if (role === "admin") return null as any; // null sentinel => all
			const isLead = role === "lead_organiser";
			const assignmentTable = isLead ? "lead_organiser_patch_assignments" : "organiser_patch_assignments";
			const idColumn = isLead ? "lead_organiser_id" : "organiser_id";
			const { data: assignments } = await (supabase as any)
				.from(assignmentTable)
				.select("patch_id")
				.eq(idColumn, uid)
				.is("effective_to", null);
			const patchIds = ((assignments as any[]) || []).map((r: any) => r.patch_id);
			if (patchIds.length === 0) return [] as string[];
			const { data: pjs } = await (supabase as any)
				.from("patch_job_sites")
				.select("job_site_id")
				.is("effective_to", null)
				.in("patch_id", patchIds);
			const siteIds = Array.from(new Set(((pjs as any[]) || []).map((r: any) => r.job_site_id).filter(Boolean)));
			if (siteIds.length === 0) return [] as string[];
			const { data: sites } = await (supabase as any)
				.from("job_sites")
				.select("id, project_id")
				.in("id", siteIds);
			const projIds = Array.from(new Set(((sites as any[]) || []).map((s: any) => s.project_id).filter(Boolean)));
			return projIds as string[];
		},
	});

	// Derived mappings for filtering
	const jobSitesByProject = useMemo(() => {
		const map: Record<string, { id: string; name: string }[]> = {};
		(jobSites as any[]).forEach((s: any) => {
			const pid = s.project_id || "";
			if (!pid) return;
			if (!map[pid]) map[pid] = [];
			map[pid].push({ id: s.id, name: s.name });
		});
		return map;
	}, [jobSites]);

	const jobSiteById = useMemo(() => {
		const map: Record<string, any> = {};
		(jobSites as any[]).forEach((s: any) => { map[s.id] = s; });
		return map;
	}, [jobSites]);

	// Placements to relate employers <-> projects via job sites
	const { data: placements = [] } = useQuery({
		queryKey: ["worker_placements-lite"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("worker_placements")
				.select("worker_id, employer_id, job_site_id")
				.not("end_date", "lt", new Date().toISOString().split("T")[0]);
			if (error) throw error;
			return data || [];
		},
	});

	const filteredProjects = useMemo(() => {
		if (!accessibleProjectIds) return projects as any[]; // admin => all
		const allow = new Set(accessibleProjectIds as string[]);
		return (projects as any[]).filter((p: any) => allow.has(p.id));
	}, [projects, accessibleProjectIds]);

	// Employer filtering when building by project
	const employersForSelectedProjects = useMemo(() => {
		if ((selectedProjects || []).length === 0) return employers as any[];
		const allowedSiteIds = new Set((selectedProjects || []).flatMap((pid) => (jobSitesByProject[pid] || []).map((s) => s.id)));
		const allowedEmployerIds = new Set((placements as any[])
			.filter((wp: any) => allowedSiteIds.has(wp.job_site_id))
			.map((wp: any) => wp.employer_id)
			.filter(Boolean)
		);
		return (employers as any[]).filter((e: any) => allowedEmployerIds.has(e.id));
	}, [selectedProjects, employers, placements, jobSitesByProject]);

	// Project filtering when building by employer
	const projectsForSelectedEmployers = useMemo(() => {
		if ((selectedEmployers || []).length === 0) return filteredProjects;
		const selectedEmpSet = new Set(selectedEmployers);
		const projectIds = new Set<string>();
		(placements as any[]).forEach((wp: any) => {
			if (!selectedEmpSet.has(wp.employer_id)) return;
			const site = jobSiteById[wp.job_site_id];
			if (site?.project_id) projectIds.add(site.project_id);
		});
		const allow = projectIds;
		return (filteredProjects as any[]).filter((p: any) => allow.has(p.id));
	}, [selectedEmployers, placements, jobSiteById, filteredProjects]);

	// Auto-select single job sites per project
	const requiresSiteChoice = useMemo(() => {
		if ((selectedProjects || []).length === 0) return false;
		const counts = (selectedProjects || []).map((pid) => (jobSitesByProject[pid] || []).length);
		return counts.some((c) => c > 1);
	}, [selectedProjects, jobSitesByProject]);

	useEffect(() => {
		if ((selectedProjects || []).length === 0) return;
		const singles = (selectedProjects || []).map((pid) => (jobSitesByProject[pid] || []))
			.filter((arr) => arr.length === 1)
			.map((arr) => arr[0].id);
		// Only auto-set when all selected projects have single sites or when none selected sites yet
		if (singles.length > 0 && !requiresSiteChoice) {
			setSelectedSites(Array.from(new Set(singles)));
		}
	}, [selectedProjects, jobSitesByProject, requiresSiteChoice]);

	// Derived workers from placements for preview (lightweight, scoped client-side)
	const previewWorkerIds = useMemo(() => {
		const selectedEmployerSet = new Set(selectedEmployers);
		const selectedProjectSet = new Set(selectedProjects);
		const selectedSiteSet = new Set(selectedSites);
		// For projects <-> employers mapping, fetch roles
		// This is a small helper query
		// We keep it local to this component to avoid new shared modules
		return placements
			.filter((wp: any) =>
				(selectedEmployerSet.size === 0 || selectedEmployerSet.has(wp.employer_id)) &&
				(selectedSiteSet.size === 0 || selectedSiteSet.has(wp.job_site_id))
			)
			.map((wp: any) => wp.worker_id);
	}, [placements, selectedEmployers, selectedProjects, selectedSites]);

	// Mutations
	const createActivity = useMutation({
		mutationFn: async () => {
			if (!campaignId || !date || !activityType || !callToAction) throw new Error("Missing required fields");
			// 1) Create activity
			const { data: act, error: actErr } = await supabase
				.from("union_activities")
				.insert({
					campaign_id: campaignId,
					date,
					topic: topic || null,
					notes: notes || null,
					activity_ui_type: activityType,
					activity_call_to_action: callToAction,
				})
				.select()
				.single();
			if (actErr) throw actErr;

			// 2) Insert rating definitions 1..5 with fixed labels and user definitions
			const LABELS: Record<number, string> = {
				1: "supportive leader",
				2: "supporter",
				3: "undecided or unknown",
				4: "anti",
				5: "anti-leader",
			};
			const defsRows = [1,2,3,4,5].map((level) => ({
				activity_id: (act as any).id,
				level,
				label: LABELS[level],
				definition: ratingDefs[level] || null,
			}));
			const { error: defErr } = await supabase.from("activity_rating_definitions").insert(defsRows);
			if (defErr) throw defErr;

			// 3) Insert scopes
			const scopeRows: any[] = [];
			selectedProjects.forEach((p) => scopeRows.push({ activity_id: (act as any).id, project_id: p }));
			selectedEmployers.forEach((e) => scopeRows.push({ activity_id: (act as any).id, employer_id: e }));
			selectedSites.forEach((s) => scopeRows.push({ activity_id: (act as any).id, job_site_id: s }));
			if (scopeRows.length > 0) {
				const { error: scopeErr } = await supabase.from("union_activity_scopes").insert(scopeRows);
				if (scopeErr) throw scopeErr;
			}

			// 4) Build universe from placements and insert activity_workers
			const uniqueWorkerIds = Array.from(new Set(previewWorkerIds));
			if (uniqueWorkerIds.length > 0) {
				const chunk = (arr: string[], size: number) => arr.reduce<string[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
				for (const batch of chunk(uniqueWorkerIds, 500)) {
					const rows = batch.map((wid) => ({ activity_id: (act as any).id, worker_id: wid }));
					const { error: awErr } = await supabase.from("activity_workers").insert(rows);
					if (awErr) throw awErr;
				}

				// 5) Insert default participation ratings (3) where missing
				for (const batch of chunk(uniqueWorkerIds, 500)) {
					const existing = await supabase
						.from("worker_activity_ratings")
						.select("worker_id")
						.eq("activity_id", (act as any).id)
						.eq("rating_type", "activity_participation");
					if (existing.error) throw existing.error;
					const existingSet = new Set(((existing.data || []) as any[]).map((r: any) => r.worker_id));
					const toInsert = batch.filter((wid) => !existingSet.has(wid)).map((wid) => ({
						worker_id: wid,
						activity_id: (act as any).id,
						rating_type: "activity_participation",
						rating_value: 3,
					}));
					if (toInsert.length > 0) {
						const { error: ratErr } = await supabase.from("worker_activity_ratings").insert(toInsert);
						if (ratErr) throw ratErr;
					}
				}
			}

			// 6) Insert objectives and subgroup overrides
			if (objectives.length > 0) {
				// Insert objectives
				const { data: insertedObjs, error: objErr } = await supabase
					.from("activity_objectives")
					.insert(objectives.map((o) => ({
						activity_id: (act as any).id,
						name: o.name,
						target_kind: o.kind,
						target_value: o.value,
					})))
					.select();
				if (objErr) throw objErr;

				// Insert overrides
				for (const obj of (insertedObjs || []) as any[]) {
					const ov = (overrides as any)[(obj as any).id] || [];
					if (ov.length > 0) {
						const { error: ovErr } = await supabase
							.from("activity_objective_targets")
							.insert(ov.map((x: any) => ({
								objective_id: (obj as any).id,
								dimension: x.dimension,
								dimension_id: x.dimension_id,
								target_value: x.value,
							})));
						if (ovErr) throw ovErr;
					}
				}
			}

			return act;
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["campaign-activities", campaignId] });
			onOpenChange(false);
			// reset minimal
			setDate(""); setTopic(""); setNotes(""); setActivityType(""); setCallToAction("");
			setRatingDefs({ 1: "", 2: "", 3: "", 4: "", 5: "" });
			setSelectedProjects([]); setSelectedEmployers([]); setSelectedSites([]);
			setObjectives([]); setOverrides({}); setMembershipFocus([]); setOccupations([]); setPrevRatings([]);
			setShowRatingDefs(false); setScopeOpen(false);
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Create Campaign Activity</DialogTitle>
				</DialogHeader>
				<div className="space-y-6">
					{/* Basics */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<DateInput value={date} onChange={(e) => setDate(e.target.value)} />
						<Input placeholder="Topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
						<Textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="md:col-span-2" />
						<Select value={activityType} onValueChange={setActivityType}>
							<SelectTrigger><SelectValue placeholder="Activity type" /></SelectTrigger>
							<SelectContent>
								{ACTIVITY_TYPES.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
							</SelectContent>
						</Select>
						<Select value={callToAction} onValueChange={setCallToAction}>
							<SelectTrigger><SelectValue placeholder="Call to action" /></SelectTrigger>
							<SelectContent>
								{CALLS_TO_ACTION.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
							</SelectContent>
						</Select>
					</div>

					{/* Rating scale definitions */}
					<div className="space-y-2">
						<div className="text-sm font-medium">Activity ratings (1–5)</div>
						{!showRatingDefs ? (
							<div>
								<Button size="sm" variant="outline" onClick={() => setShowRatingDefs(true)}>Add rating definitions</Button>
							</div>
						) : (
							<div className="space-y-2">
								{[1,2,3,4,5].map((lvl) => (
									<div key={lvl} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
										<div className="text-sm">{lvl}: {({1:"supportive leader",2:"supporter",3:"undecided or unknown",4:"anti",5:"anti-leader"} as any)[lvl]}</div>
										<Input placeholder="Definition (optional)" value={ratingDefs[lvl] || ""} onChange={(e) => setRatingDefs((s) => ({ ...s, [lvl]: e.target.value }))} />
									</div>
								))}
								<div className="flex justify-end">
									<Button size="sm" onClick={() => setShowRatingDefs(false)}>Save</Button>
								</div>
							</div>
						)}
					</div>

					{/* Scope */}
					<div className="space-y-3">
						<div className="text-sm font-medium">Setup campaign scope</div>
						<Popover open={scopeOpen} onOpenChange={setScopeOpen}>
							<PopoverTrigger asChild>
								<Button variant="outline" size="sm">Setup campaign scope</Button>
							</PopoverTrigger>
							<PopoverContent className="w-[520px]">
								<div className="space-y-3">
									<div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
										<div className="text-sm">Build by:</div>
										<Select value={expandVia} onValueChange={(v: any) => setExpandVia(v)}>
											<SelectTrigger><SelectValue placeholder="Pathway" /></SelectTrigger>
											<SelectContent>
												<SelectItem value="project">Project</SelectItem>
												<SelectItem value="employer">Employer</SelectItem>
											</SelectContent>
										</Select>
									</div>

									{expandVia === "project" && (
										<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
											<Select value="" onValueChange={(v) => setSelectedProjects((s) => s.includes(v) ? s : [...s, v])}>
												<SelectTrigger><SelectValue placeholder="Add project" /></SelectTrigger>
												<SelectContent>
													{(filteredProjects as any[]).map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
												</SelectContent>
											</Select>
											<Select value="" onValueChange={(v) => setSelectedEmployers((s) => s.includes(v) ? s : [...s, v])}>
												<SelectTrigger><SelectValue placeholder="Add employer" /></SelectTrigger>
												<SelectContent>
													{(employersForSelectedProjects as any[]).map((e: any) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
												</SelectContent>
											</Select>
											{requiresSiteChoice ? (
												<Select value="" onValueChange={(v) => setSelectedSites((s) => s.includes(v) ? s : [...s, v])}>
													<SelectTrigger><SelectValue placeholder="Add job site" /></SelectTrigger>
													<SelectContent>
														{(selectedProjects || []).flatMap((pid) => jobSitesByProject[pid] || [])
															.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
													</SelectContent>
												</Select>
											) : (
												<div className="text-xs text-muted-foreground md:col-span-1">Job sites auto-selected per project</div>
											)}
										</div>
									)}

									{expandVia === "employer" && (
										<div className="grid grid-cols-1 md:grid-cols-3 gap-2">
											<Select value="" onValueChange={(v) => setSelectedEmployers((s) => s.includes(v) ? s : [...s, v])}>
												<SelectTrigger><SelectValue placeholder="Add employer" /></SelectTrigger>
												<SelectContent>
													{(employers as any[]).map((e: any) => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
												</SelectContent>
											</Select>
											<Select value="" onValueChange={(v) => setSelectedProjects((s) => s.includes(v) ? s : [...s, v])}>
												<SelectTrigger><SelectValue placeholder="Add project" /></SelectTrigger>
												<SelectContent>
													{(projectsForSelectedEmployers as any[]).map((p: any) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
												</SelectContent>
											</Select>
											{requiresSiteChoice ? (
												<Select value="" onValueChange={(v) => setSelectedSites((s) => s.includes(v) ? s : [...s, v])}>
													<SelectTrigger><SelectValue placeholder="Add job site" /></SelectTrigger>
													<SelectContent>
														{(selectedProjects || []).flatMap((pid) => jobSitesByProject[pid] || [])
															.map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
													</SelectContent>
												</Select>
											) : (
												<div className="text-xs text-muted-foreground md:col-span-1">Job sites auto-selected per project</div>
											)}
										</div>
									)}

									<div className="flex justify-end gap-2 pt-2">
										<Button variant="outline" size="sm" onClick={() => setScopeOpen(false)}>Cancel</Button>
										<Button size="sm" onClick={() => setScopeOpen(false)}>Save</Button>
									</div>
								</div>
							</PopoverContent>
						</Popover>
						<div className="flex flex-wrap gap-2">
							{selectedProjects.map((id) => {
								const p = (projects as any[]).find((x) => x.id === id);
								return <Button key={id} size="sm" variant="outline" onClick={() => setSelectedProjects((s) => s.filter((x) => x !== id))}>{p?.name || id} ✕</Button>
							})}
							{selectedEmployers.map((id) => {
								const e = (employers as any[]).find((x) => x.id === id);
								return <Button key={id} size="sm" variant="outline" onClick={() => setSelectedEmployers((s) => s.filter((x) => x !== id))}>{e?.name || id} ✕</Button>
							})}
							{selectedSites.map((id) => {
								const s = (jobSites as any[]).find((x) => x.id === id);
								return <Button key={id} size="sm" variant="outline" onClick={() => setSelectedSites((s2) => s2.filter((x) => x !== id))}>{s?.name || id} ✕</Button>
							})}
						</div>
					</div>

					{/* Objectives */}
					<div className="space-y-2">
						<div className="text-sm font-medium">Objectives</div>
						<div className="grid grid-cols-1 md:grid-cols-5 gap-2">
							<Select value="" onValueChange={(v) => setObjectives((s) => [...s, { id: crypto.randomUUID(), name: v, kind: "number", value: 0 }])}>
								<SelectTrigger><SelectValue placeholder="Add prefilled objective" /></SelectTrigger>
								<SelectContent>
									{OBJECTIVE_PREFILLS.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
								</SelectContent>
							</Select>
							<Input placeholder="Custom objective name" onKeyDown={(e) => {
								if (e.key === 'Enter') {
									const name = (e.target as HTMLInputElement).value.trim();
									if (name) { setObjectives((s) => [...s, { id: crypto.randomUUID(), name, kind: "number", value: 0 }]); (e.target as HTMLInputElement).value = ""; }
								}
							}} />
						</div>
						<div className="space-y-2">
							{objectives.map((o) => (
								<div key={o.id} className="grid grid-cols-1 md:grid-cols-6 gap-2 items-center">
									<div className="md:col-span-2 text-sm">{o.name}</div>
									<Select value={o.kind} onValueChange={(v: any) => setObjectives((s) => s.map((x) => x.id === o.id ? { ...x, kind: v } : x))}>
										<SelectTrigger><SelectValue /></SelectTrigger>
										<SelectContent>
											<SelectItem value="number">Number</SelectItem>
											<SelectItem value="percent">Percent</SelectItem>
										</SelectContent>
									</Select>
									<Input type="number" value={o.value} onChange={(e) => setObjectives((s) => s.map((x) => x.id === o.id ? { ...x, value: Number(e.target.value) } : x))} />
									<Button size="sm" variant="outline" onClick={() => setObjectives((s) => s.filter((x) => x.id !== o.id))}>Remove</Button>
								</div>
							))}
						</div>
					</div>

					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
						<Button onClick={() => createActivity.mutate()} disabled={createActivity.isPending}>Create Activity</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default CampaignActivityBuilder;