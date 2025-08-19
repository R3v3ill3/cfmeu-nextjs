export function StatusSummary({ visit }: { visit: any }) {
	if (!visit) return null;
	return (
		<div>
			<span className="mr-2">{visit.status_code || "draft_prep"}</span>
			{visit.scheduled_at && <span className="mr-2">Sch: {new Date(visit.scheduled_at).toLocaleString()}</span>}
			{visit.started_at && <span className="mr-2">Start: {new Date(visit.started_at).toLocaleString()}</span>}
			{visit.completed_at && <span>Done: {new Date(visit.completed_at).toLocaleString()}</span>}
		</div>
	);
}