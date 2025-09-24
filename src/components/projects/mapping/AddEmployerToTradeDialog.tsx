"use client"

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { supabase } from "@/integrations/supabase/client";

type Stage = "early_works" | "structure" | "finishing" | "other";

type Props = {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	defaultStage: Stage;
	defaultTradeValue: string;
	defaultTradeLabel: string;
	onSubmit: (opts: { stage: Stage; employerId: string; employerName: string }) => void;
};

export function AddEmployerToTradeDialog({ open, onOpenChange, defaultStage, defaultTradeValue, defaultTradeLabel, onSubmit }: Props) {
	const [stage, setStage] = useState<Stage>(defaultStage);
	const [employerId, setEmployerId] = useState<string>("");
	const [employerName, setEmployerName] = useState<string>("");

	useEffect(() => {
		if (open) {
			setStage(defaultStage);
			setEmployerId("");
			setEmployerName("");
		}
	}, [open, defaultStage]);

	// Fetch employer name when employer ID changes
	useEffect(() => {
		if (employerId) {
			const fetchEmployerName = async () => {
				const { data: employer } = await supabase
					.from("employers")
					.select("name")
					.eq("id", employerId)
					.maybeSingle();
				if (employer) {
					setEmployerName(employer.name);
				}
			};
			fetchEmployerName();
		} else {
			setEmployerName("");
		}
	}, [employerId]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add employer to {defaultTradeLabel}</DialogTitle>
				</DialogHeader>
				<div className="space-y-3">
					<div>
						<Label>Stage</Label>
						<Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="early_works">Early works</SelectItem>
								<SelectItem value="structure">Structure</SelectItem>
								<SelectItem value="finishing">Finishing</SelectItem>
								<SelectItem value="other">Other</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div>
						<Label>Employer</Label>
						<SingleEmployerDialogPicker
							label=""
							hideLabel
							selectedId={employerId}
							onChange={(id: string) => setEmployerId(id)}
							triggerText={employerId ? "Change employer" : "Select employer"}
						/>
					</div>
				</div>
				<DialogFooter>
					<Button
						disabled={!employerId}
						onClick={() => {
							onOpenChange(false);
							onSubmit({ stage, employerId, employerName: employerName });
						}}
					>
						Add
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

