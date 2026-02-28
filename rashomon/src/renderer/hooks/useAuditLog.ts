import { startTransition, useDeferredValue, useEffect, useState } from "react";

import { invokeIpc } from "@renderer/lib/ipc";

export interface AuditFilterState {
  eventType: string;
  agentId: string;
  decision: string;
  dateFrom?: number;
  dateTo?: number;
}

export interface AuditEntryView {
  id: string;
  timestamp: string;
  eventType: string;
  agentId: string | null;
  requestId: string | null;
  details: string | null;
  receiptHash: string;
  previousHash: string | null;
}

function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function useAuditLog() {
  const [entries, setEntries] = useState<AuditEntryView[]>([]);
  const [filters, setFilters] = useState<AuditFilterState>({
    eventType: "",
    agentId: "",
    decision: "",
  });
  const deferredFilters = useDeferredValue(filters);

  useEffect(() => {
    void invokeIpc<AuditEntryView[]>("audit:query", deferredFilters).then((nextEntries) => {
      startTransition(() => setEntries(nextEntries));
    });
  }, [deferredFilters]);

  return {
    entries,
    total: entries.length,
    filters,
    setFilters,
    async exportLog(format: "json" | "csv") {
      if (format === "json") {
        downloadFile("rashomon-audit.json", JSON.stringify(entries, null, 2), "application/json");
        return;
      }

      const csv = [
        "timestamp,eventType,agentId,requestId,receiptHash",
        ...entries.map((entry) =>
          [entry.timestamp, entry.eventType, entry.agentId ?? "", entry.requestId ?? "", entry.receiptHash]
            .map((value) => `"${String(value).replaceAll('"', '""')}"`)
            .join(","),
        ),
      ].join("\n");
      downloadFile("rashomon-audit.csv", csv, "text/csv");
    },
  };
}
