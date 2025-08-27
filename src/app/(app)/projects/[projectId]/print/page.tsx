"use client"

import { useParams, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ProjectPrintPage() {
  const params = useParams();
  const sp = useSearchParams();
  const projectId = params?.projectId as string;

  useEffect(() => {
    const qp = sp.get("print");
    if (qp === "1") {
      try {
        // Give the page a moment to render, then trigger print
        setTimeout(() => {
          window.print();
        }, 300);
      } catch {}
    }

    // Attempt to auto-close tab/window after printing when opened via window.open
    const handleAfterPrint = () => {
      try {
        // Some browsers block window.close() unless window was opened by script
        window.close();
      } catch {}
    };
    try {
      window.addEventListener("afterprint", handleAfterPrint);
    } catch {}
    return () => {
      try { window.removeEventListener("afterprint", handleAfterPrint); } catch {}
    };
  }, [sp]);

  const Sheet1 = require("@/components/projects/mapping/MappingSheetPage1").MappingSheetPage1;
  const Subs = require("@/components/projects/mapping/MappingSubcontractorsTable").MappingSubcontractorsTable;

  return (
    <div className="space-y-6">
      {/* Screen toolbar (hidden on print) */}
      <div className="no-print flex items-center justify-end gap-2 p-2 border-b">
        <Button variant="outline" onClick={() => { try { window.print(); } catch {} }}>Print</Button>
        <Button variant="outline" onClick={() => { try { window.close(); } catch {} }}>Close</Button>
      </div>

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

