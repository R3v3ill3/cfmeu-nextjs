"use client"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
	open: boolean;
	onOpenChange: (v: boolean) => void;
	mode: "existing" | "empty"; // existing employer vs no employer
	onRemove?: () => void; // existing only
	onChange?: () => void; // existing only → triggers employer picker
	onAdd?: () => void; // both modes: existing (add another), empty (add)
};

export function ManageTradeCompanyDialog({ open, onOpenChange, mode, onRemove, onChange, onAdd }: Props) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{mode === "existing" ? "Manage employer" : "Add employer"}</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					{mode === "existing" ? (
						<div className="grid grid-cols-1 gap-2">
							<Button variant="destructive" onClick={() => { onOpenChange(false); if (onRemove) onRemove(); }}>Remove</Button>
							<Button variant="secondary" onClick={() => { onOpenChange(false); if (onChange) onChange(); }}>Change</Button>
							<Button onClick={() => { onOpenChange(false); if (onAdd) onAdd(); }}>Add another</Button>
						</div>
					) : (
						<div className="grid grid-cols-1 gap-2">
							<Button onClick={() => { onOpenChange(false); if (onAdd) onAdd(); }}>Add</Button>
						</div>
					)}
				</div>
				<DialogFooter />
			</DialogContent>
		</Dialog>
	);
}

