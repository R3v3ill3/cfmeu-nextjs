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
  showSiteColumn: boolean;
  ebaEmployers: Set<string>;
  onEmployerClick: (employerId: string) => void;
  onEbaClick: (employerId: string) => void;
  projectId: string;
}

const ContractorsSummary = ({
  rows,
  showSiteColumn,
  ebaEmployers,
  onEmployerClick,
  onEbaClick,
  projectId,
}: ContractorsSummaryProps) => {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employer</TableHead>
          {showSiteColumn && <TableHead>Site</TableHead>}
          <TableHead>Trade</TableHead>
          <TableHead>EBA</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
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
            {showSiteColumn && (
              <TableCell>
                {row.siteName ? (
                  row.siteId ? (
                    <Link
                      href={`/patch/walls?projectId=${projectId}&siteId=${row.siteId}`}
                      className="text-primary hover:underline"
                      aria-label={`Open Patch Wall for site ${row.siteName}`}
                    >
                      {row.siteName}
                    </Link>
                  ) : (
                    row.siteName
                  )
                ) : (
                  "-"
                )}
              </TableCell>
            )}
            <TableCell>{row.tradeLabel}</TableCell>
            <TableCell>
              <button
                type="button"
                className={`cursor-pointer ${ebaEmployers.has(row.employerId) ? '' : 'opacity-60 cursor-not-allowed'}`}
                onClick={() => {
                  if (ebaEmployers.has(row.employerId)) onEbaClick(row.employerId)
                }}
                aria-label="View EBA details"
                disabled={!ebaEmployers.has(row.employerId)}
              >
                {ebaEmployers.has(row.employerId) ? (
                  <Badge variant="default">EBA</Badge>
                ) : (
                  <Badge variant="destructive">No EBA</Badge>
                )}
              </button>
            </TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={showSiteColumn ? 4 : 3} className="text-center text-sm text-muted-foreground">
              No contractors recorded for this project yet.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
};

export default ContractorsSummary;
