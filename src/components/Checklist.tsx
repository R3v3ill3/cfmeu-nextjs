import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";

export function Checklist({ svId, onChanged }: { svId: string; onChanged?: (map: Record<string,string>) => void }) {
	const [items, setItems] = useState<any[]>([]);
	const [responses, setResponses] = useState<Record<string, string>>({});
	useEffect(() => {
		(async () => {
			const [{ data: its }, { data: existing }] = await Promise.all([
				(supabase as any).from("checklist_item").select("code,label").eq("is_active", true),
				(supabase as any).from("site_visit_checklist_response").select("checklist_item_code,response_option_code").eq("site_visit_id", svId),
			]);
			setItems(its || []);
			const map: Record<string, string> = {};
			(existing || []).forEach((r: any) => { map[r.checklist_item_code] = r.response_option_code; });
			setResponses(map);
			onChanged?.(map);
		})();
	}, [svId, onChanged]);

	async function saveResponse(itemCode: string, option: string) {
		const next = { ...responses, [itemCode]: option };
		setResponses(next);
		await (supabase as any)
			.from("site_visit_checklist_response")
			.upsert({ site_visit_id: svId, checklist_item_code: itemCode, response_option_code: option });
		onChanged?.(next);
	}

	return (
		<div className="space-y-2">
			<div className="text-sm font-medium">Prep checklist</div>
			<div className="space-y-2">
				{items.map((it) => (
					<div key={it.code} className="grid grid-cols-2 gap-2 items-center">
						<Label>{it.label}</Label>
						<div className="flex items-center gap-3">
							<label className="flex items-center gap-1 text-sm"><input type="radio" name={it.code} checked={responses[it.code] === "yes"} onChange={()=> saveResponse(it.code, "yes")} /> Yes</label>
							<label className="flex items-center gap-1 text-sm"><input type="radio" name={it.code} checked={responses[it.code] === "no"} onChange={()=> saveResponse(it.code, "no")} /> No</label>
							<label className="flex items-center gap-1 text-sm"><input type="radio" name={it.code} checked={responses[it.code] === "na"} onChange={()=> saveResponse(it.code, "na")} /> N/A</label>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}