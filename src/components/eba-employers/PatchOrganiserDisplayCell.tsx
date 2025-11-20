"use client"

type PatchAssignment = {
  patch_id: string
  patch_name: string
  organiser_names: string[]
}

interface PatchOrganiserDisplayCellProps {
  assignments: PatchAssignment[]
}

export function PatchOrganiserDisplayCell({ assignments }: PatchOrganiserDisplayCellProps) {
  if (!assignments || assignments.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  return (
    <div className="space-y-2">
      {assignments.map((assignment) => (
        <div key={assignment.patch_id} className="space-y-1">
          <div className="text-sm font-medium text-foreground">{assignment.patch_name}</div>
          {assignment.organiser_names.length > 0 ? (
            <div className="text-xs text-muted-foreground break-words">
              {assignment.organiser_names.join(", ")}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground italic">No organisers assigned</div>
          )}
        </div>
      ))}
    </div>
  )
}


