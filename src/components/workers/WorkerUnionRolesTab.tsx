import React from "react";

interface WorkerUnionRolesTabProps {
	workerId: string | null;
	onUpdate: () => void;
}

export const WorkerUnionRolesTab: React.FC<WorkerUnionRolesTabProps> = ({ workerId }) => {
	return (
		<div className="p-4 text-sm text-muted-foreground">
			Union roles view is temporarily unavailable.
		</div>
	);
};