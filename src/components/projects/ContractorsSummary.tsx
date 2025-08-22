import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface ContractorRow {
  id: string;
  employerId: string;
  employerName: string;
  siteName?: string | null;
  siteId?: string | null;
  tradeLabel: string;
  ebaRecordId?: string | null;
}

interface ContractorsSummaryProps {
  rows: ContractorRow[];
  ebaEmployers?: Set<string>; // kept optional for backward compat, but superseded by ebaCategoryByEmployer
  onEmployerClick: (employerId: string) => void;
  onEbaClick: (employerId: string) => void;
  projectId: string;
  groupBySite?: boolean;
  membershipByEmployerSite?: Record<string, { members: number; total: number }>;
  ebaCategoryByEmployer?: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }>; 
}

function GradientBar({ percent, baseRgb, heightClass = "h-1.5" }: { percent: number; baseRgb: string; heightClass?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const stops: string[] = [];
  for (let i = 0; i < 10; i++) {
    const start = i * 10;
    const end = start + 10;
    const alpha = (i + 1) / 10; // 0.1 .. 1.0
    stops.push(`rgba(${baseRgb},${alpha}) ${start}%`, `rgba(${baseRgb},${alpha}) ${end}%`);
  }
  const gradient = `linear-gradient(to right, ${stops.join(', ')})`;
  return (
    <div className={`w-full ${heightClass} rounded bg-muted/30 overflow-hidden`}>
      <div className="h-full" style={{ width: `${pct}%`, background: gradient }} />
    </div>
  );
}

const memberRedRgb = '222,27,18';

export default function ContractorsSummary({
  rows,
  ebaEmployers,
  onEmployerClick,
  onEbaClick,
  projectId,
  groupBySite = false,
  membershipByEmployerSite = {},
  ebaCategoryByEmployer = {},
}: ContractorsSummaryProps) {
  const groups = groupBySite
    ? Object.values(
        rows.reduce((acc: Record<string, { key: string; name: string; rows: ContractorRow[] }>, r) => {
          const key = r.siteId ? String(r.siteId) : "__none__";
          if (!acc[key]) acc[key] = { key, name: r.siteName || "Project", rows: [] };
          acc[key].rows.push(r);
          return acc;
        }, {})
      )
    : [{ key: "all", name: "", rows }];

  const hasMultipleGroups = groupBySite && groups.length > 1;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employer</TableHead>
          <TableHead>Membership</TableHead>
          <TableHead>Trade</TableHead>
          <TableHead>EBA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((g) => (
          <>
            {hasMultipleGroups && (
              <TableRow key={`hdr-${g.key}`}>
                <TableCell colSpan={4} className="text-xs text-muted-foreground font-medium">
                  {g.name || "Project"}
                </TableCell>
              </TableRow>
            )}
            {g.rows.map((row) => {
              const key = `${row.siteId ?? "__none__"}:${row.employerId}`;
              const mem = membershipByEmployerSite[key] || { members: 0, total: 0 };
              const pct = mem.total > 0 ? (mem.members / mem.total) * 100 : 0;

              const ebaInfo = ebaCategoryByEmployer[row.employerId];
              // Backward fallback: if category map not provided, use simple EBA/No EBA based on ebaEmployers
              const hasEba = ebaInfo ? ebaInfo.variant !== 'destructive' : !!ebaEmployers?.has(row.employerId);
              const ebaLabel = ebaInfo ? ebaInfo.label : (hasEba ? 'EBA' : 'No EBA');
              const ebaVariant = ebaInfo ? ebaInfo.variant : (hasEba ? 'default' : 'destructive');

              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => onEmployerClick(row.employerId)}
                    >
                      {row.employerName}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="min-w-[140px]">
                      <GradientBar percent={pct} baseRgb={memberRedRgb} />
                      <div className="mt-1 text-[10px] text-muted-foreground">{mem.members}/{mem.total}</div>
                    </div>
                  </TableCell>
                  <TableCell>{row.tradeLabel}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className={`cursor-pointer ${hasEba ? '' : 'opacity-60 cursor-not-allowed'}`}
                      onClick={() => { if (hasEba) onEbaClick(row.employerId) }}
                      aria-label="View EBA details"
                      disabled={!hasEba}
                    >
                      <Badge variant={ebaVariant}>{ebaLabel}</Badge>
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
              No contractors recorded for this project yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
