"use client"

import { useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function ProjectPrintPage() {
  const params = useParams();
  const sp = useSearchParams();
  const projectId = params?.projectId as string;

  useEffect(() => {
    if (sp.get("print") === "1") {
      try { setTimeout(() => window.print(), 300); } catch {}
    }
  }, [sp]);

  const Sheet1 = require("@/components/projects/mapping/MappingSheetPage1").MappingSheetPage1;
  const Subs = require("@/components/projects/mapping/MappingSubcontractorsTable").MappingSubcontractorsTable;

  return (
    <div className="space-y-6">
      <div className="print-only" />
      <div className="print-border p-4 break-after-page">
        <Sheet1 projectId={projectId} />
      </div>
      <div className="print-border p-4">
        <Subs projectId={projectId} />
      </div>
    </div>
  );
}

