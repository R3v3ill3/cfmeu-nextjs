import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

export function WorkerQuickPicker({ employerId, value, onChange }: { employerId: string; value?: string; onChange: (id: string) => void; }) {
	const [workers, setWorkers] = useState<{ id: string; first_name: string; surname: string }[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			if (!employerId) return;
			setLoading(true);
			const { data, error } = await (supabase as any)
				.from("workers")
				.select("id, first_name, surname, worker_placements!inner(employer_id)")
				.eq("worker_placements.employer_id", employerId)
				.limit(500);
			if (!cancelled) {
				if (!error) setWorkers((data || []).map((w: any) => ({ id: w.id, first_name: w.first_name, surname: w.surname })));
				setLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [employerId]);

	return (
		<div className="space-y-2">
			<Label>Worker</Label>
			<select className="border rounded h-10 w-full px-2" value={value || ""} onChange={(e) => onChange(e.target.value)} disabled={loading || !employerId}>
				<option value="">Select worker</option>
				{workers.map((w) => (
					<option key={w.id} value={w.id}>{w.first_name} {w.surname}</option>
				))}
			</select>
		</div>
	);
}