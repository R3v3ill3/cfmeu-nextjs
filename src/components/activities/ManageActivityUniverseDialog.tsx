import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

interface ManageActivityUniverseDialogProps {
	activityId: string;
	open: boolean;
	onOpenChange: (v: boolean) => void;
}

export default function ManageActivityUniverseDialog({ activityId, open, onOpenChange }: ManageActivityUniverseDialogProps) {
	const qc = useQueryClient();
	const [search, setSearch] = useState("");
	const [selectedAdd, setSelectedAdd] = useState<Set<string>>(new Set());
	const [selectedRemove, setSelectedRemove] = useState<Set<string>>(new Set());

	// Current universe
	const { data: universe = [], isFetching: fetchingUniverse } = useQuery({
		queryKey: ["activity-universe", activityId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("activity_workers")
				.select("worker_id")
				.eq("activity_id", activityId);
			if (error) throw error;
			return (data || []).map((r: any) => r.worker_id) as string[];
		},
		enabled: !!activityId,
	});

	// Candidate pool from placements
	const { data: placements = [] } = useQuery({
		queryKey: ["worker_placements-candidates", activityId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("worker_placements")
				.select("worker_id, employers(name), job_sites(name)")
				.not("end_date", "lt", new Date().toISOString().split("T")[0]);
			if (error) throw error;
			return data || [];
		},
		enabled: !!activityId,
	});

	// Lightweight workers info for display
	const { data: workers = [] } = useQuery({
		queryKey: ["workers-lite"],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("workers")
				.select("id, first_name, surname, union_membership_status, member_number")
				.order("first_name");
			if (error) throw error;
			return data || [];
		},
	});

	const workerMap = useMemo(() => {
		const map = new Map<string, any>();
		(workers as any[]).forEach((w) => map.set(w.id, w));
		return map;
	}, [workers]);

	const universeSet = useMemo(() => new Set(universe as string[]), [universe]);

	const candidates = useMemo(() => {
		const ids = new Set((placements as any[]).map((p) => p.worker_id as string));
		return Array.from(ids);
	}, [placements]);

	const filteredUniverse = useMemo(() => {
		return (universe as string[]).filter((id) => {
			const w = workerMap.get(id);
			if (!w) return true;
			const name = `${w.first_name || ''} ${w.surname || ''} ${w.member_number || ''}`.toLowerCase();
			return name.includes(search.toLowerCase());
		});
	}, [universe, workerMap, search]);

	const filteredCandidates = useMemo(() => {
		return (candidates as string[]).filter((id) => !universeSet.has(id)).filter((id) => {
			const w = workerMap.get(id);
			if (!w) return true;
			const name = `${w.first_name || ''} ${w.surname || ''} ${w.member_number || ''}`.toLowerCase();
			return name.includes(search.toLowerCase());
		});
	}, [candidates, universeSet, workerMap, search]);

	const addMutation = useMutation({
		mutationFn: async (ids: string[]) => {
			if (!ids.length) return;
			const chunk = (arr: string[], size: number) => arr.reduce<string[][]>((acc, _, i) => (i % size ? acc : [...acc, arr.slice(i, i + size)]), []);
			for (const batch of chunk(ids, 500)) {
				const rows = batch.map((wid) => ({ activity_id: activityId, worker_id: wid }));
				const { error: awErr } = await supabase.from("activity_workers").insert(rows);
				if (awErr) throw awErr;
				// default participation ratings of 3 where missing
				const existing = await supabase
					.from("worker_activity_ratings")
					.select("worker_id")
					.eq("activity_id", activityId)
					.eq("rating_type", "activity_participation");
				if (existing.error) throw existing.error;
				const existingSet = new Set((existing.data || []).map((r: any) => r.worker_id));
				const toInsert = batch.filter((wid) => !existingSet.has(wid)).map((wid) => ({
					worker_id: wid,
					activity_id: activityId,
					rating_type: "activity_participation",
					rating_value: 3,
				}));
				if (toInsert.length > 0) {
					const { error: ratErr } = await supabase.from("worker_activity_ratings").insert(toInsert);
					if (ratErr) throw ratErr;
				}
			}
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["activity-universe", activityId] });
			setSelectedAdd(new Set());
		},
	});

	const removeMutation = useMutation({
		mutationFn: async (ids: string[]) => {
			if (!ids.length) return;
			// Remove only from activity_workers; do not delete ratings
			for (const wid of ids) {
				const { error } = await supabase
					.from("activity_workers")
					.delete()
					.eq("activity_id", activityId)
					.eq("worker_id", wid);
				if (error) throw error;
			}
		},
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ["activity-universe", activityId] });
			setSelectedRemove(new Set());
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl">
				<DialogHeader>
					<DialogTitle>Manage Activity Universe</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex items-center gap-2">
						<Input placeholder="Search by name or member number" value={search} onChange={(e) => setSearch(e.target.value)} />
						<Badge variant="secondary">In universe: {universe?.length || 0}</Badge>
					</div>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="border rounded-md p-3">
							<div className="text-sm font-medium mb-2">Current universe</div>
							<div className="space-y-2 max-h-96 overflow-auto">
								{filteredUniverse.map((id) => {
									const w = workerMap.get(id);
									const checked = selectedRemove.has(id);
									return (
										<div key={id} className="flex items-center gap-2">
											<Checkbox checked={checked} onCheckedChange={(v) => {
												const next = new Set(selectedRemove);
												if (v) next.add(id); else next.delete(id);
												setSelectedRemove(next);
											}} />
											<div className="text-sm">{w ? `${w.first_name} ${w.surname}` : id} {w?.member_number ? `• ${w.member_number}` : ''}</div>
										</div>
									);
								})}
							</div>
							<div className="flex justify-end mt-2">
								<Button variant="outline" size="sm" onClick={() => removeMutation.mutate(Array.from(selectedRemove))} disabled={removeMutation.isPending || selectedRemove.size === 0}>Remove selected</Button>
							</div>
						</div>
						<div className="border rounded-md p-3">
							<div className="text-sm font-medium mb-2">Candidates (from placements)</div>
							<div className="space-y-2 max-h-96 overflow-auto">
								{filteredCandidates.map((id) => {
									const w = workerMap.get(id);
									const checked = selectedAdd.has(id);
									return (
										<div key={id} className="flex items-center gap-2">
											<Checkbox checked={checked} onCheckedChange={(v) => {
												const next = new Set(selectedAdd);
												if (v) next.add(id); else next.delete(id);
												setSelectedAdd(next);
											}} />
											<div className="text-sm">{w ? `${w.first_name} ${w.surname}` : id} {w?.member_number ? `• ${w.member_number}` : ''}</div>
										</div>
									);
								})}
							</div>
							<div className="flex justify-end mt-2">
								<Button size="sm" onClick={() => addMutation.mutate(Array.from(selectedAdd))} disabled={addMutation.isPending || selectedAdd.size === 0}>Add selected</Button>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}