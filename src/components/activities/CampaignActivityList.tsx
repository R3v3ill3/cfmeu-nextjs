import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface CampaignActivityListProps {
	campaignId: string;
	onCreateClick: () => void;
}

export default function CampaignActivityList({ campaignId, onCreateClick }: CampaignActivityListProps) {
	const { data: activities = [], isFetching } = useQuery({
		queryKey: ["campaign-activities", campaignId],
		queryFn: async () => {
			const { data, error } = await supabase
				.from("union_activities")
				.select("id, date, activity_ui_type, activity_call_to_action, topic, notes")
				.eq("campaign_id", campaignId)
				.order("date", { ascending: false });
			if (error) throw error;
			return data || [];
		},
		enabled: !!campaignId,
	});

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle>Activities</CardTitle>
				<Button size="sm" onClick={onCreateClick}>New Activity</Button>
			</CardHeader>
			<CardContent>
				{isFetching && <div className="text-sm text-muted-foreground">Loading…</div>}
				{!isFetching && (activities as any[]).length === 0 && (
					<div className="text-sm text-muted-foreground">No activities for this campaign.</div>
				)}
				<div className="space-y-3">
					{(activities as any[]).map((a) => (
						<Card key={a.id}>
							<CardHeader className="pb-2">
								<CardTitle className="text-base">{a.activity_ui_type || "Activity"} • {a.activity_call_to_action || "—"}</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground">
								<div>{format(new Date(a.date), 'dd/MM/yyyy')}</div>
								{a.topic && <div>Topic: {a.topic}</div>}
								{a.notes && <div className="line-clamp-2">{a.notes}</div>}
							</CardContent>
						</Card>
					))}
				</div>
			</CardContent>
		</Card>
	);
}