import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone } from "lucide-react";
import { getWorkerColorCoding } from "@/utils/workerColorCoding";

interface WorkerCardProps {
  worker: any;
  variant: "table" | "card";
  onEdit?: (worker: any) => void;
  onUpdate?: () => void;
  onClick?: () => void;
}

const getInitials = (firstName?: string | null, surname?: string | null) => {
  return `${(firstName?.[0] || "").toUpperCase()}${(surname?.[0] || "").toUpperCase()}`;
};

const formatUnionStatus = (status?: string | null) => {
  if (!status) return "";
  return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const CurrentPosition = ({ worker }: { worker: any }) => {
  const placement = worker?.worker_placements?.[0];
  if (!placement) return <span className="text-muted-foreground">—</span>;
  const jobTitle = placement?.job_title || "—";
  const employment = placement?.employment_status || "";
  return (
    <div className="space-y-0.5">
      <div className="text-sm font-medium">{jobTitle}</div>
      {employment && <div className="text-xs text-muted-foreground">{employment}</div>}
    </div>
  );
};

export const WorkerCard = ({ worker, variant, onEdit, onUpdate, onClick }: WorkerCardProps) => {
  const fullName = `${worker?.first_name || ""} ${worker?.surname || ""}`.trim();
  const colorInfo = getWorkerColorCoding(worker?.union_membership_status || null);

  if (variant === "table") {
    return (
      <TableRow className="cursor-pointer" onClick={onClick}>
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className={`${colorInfo.badgeClass} ${colorInfo.textColor} border`} style={{ ...colorInfo.badgeStyle, ...colorInfo.borderStyle }}>
                {getInitials(worker?.first_name, worker?.surname)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-0.5">
              <div className="font-medium leading-none">{fullName || "Unnamed"}</div>
              {worker?.member_number && (
                <div className="text-xs text-muted-foreground">Member #: {worker.member_number}</div>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <div className="space-y-1 text-sm text-muted-foreground">
            {worker?.email && (
              <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{worker.email}</div>
            )}
            {worker?.mobile_phone && (
              <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{worker.mobile_phone}</div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge className={`${colorInfo.badgeClass} ${colorInfo.textColor} border`} style={{ ...colorInfo.badgeStyle, ...colorInfo.borderStyle }}>
            {formatUnionStatus(worker?.union_membership_status)}
          </Badge>
        </TableCell>
        <TableCell>
          <CurrentPosition worker={worker} />
        </TableCell>
        <TableCell>
          {onEdit && (
            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onEdit(worker); }}>
              Edit
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  }

  // Card variant
  return (
    <div className="rounded-lg border bg-card p-4" onClick={onClick}>
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarFallback className={`${colorInfo.badgeClass} ${colorInfo.textColor} border`} style={{ ...colorInfo.badgeStyle, ...colorInfo.borderStyle }}>
            {getInitials(worker?.first_name, worker?.surname)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-medium">{fullName || "Unnamed"}</div>
              {worker?.member_number && (
                <div className="text-xs text-muted-foreground">Member #: {worker.member_number}</div>
              )}
            </div>
            <Badge className={`${colorInfo.badgeClass} ${colorInfo.textColor} border`} style={{ ...colorInfo.badgeStyle, ...colorInfo.borderStyle }}>
              {formatUnionStatus(worker?.union_membership_status)}
            </Badge>
          </div>
          <div className="mt-2 text-sm text-muted-foreground space-y-1">
            {worker?.email && (
              <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{worker.email}</div>
            )}
            {worker?.mobile_phone && (
              <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{worker.mobile_phone}</div>
            )}
          </div>
          <div className="mt-3">
            <CurrentPosition worker={worker} />
          </div>
          {onEdit && (
            <div className="mt-3">
              <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onEdit(worker); }}>
                Edit
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

