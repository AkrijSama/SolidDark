import { Table, TableBody, TableHead } from "@renderer/components/ui/table";
import { Badge } from "@renderer/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { Input } from "@renderer/components/ui/input";
import { formatTimestamp } from "@renderer/lib/format";
import type { AuditEntryView, AuditFilterState } from "@renderer/hooks/useAuditLog";

interface AuditLogProps {
  entries: AuditEntryView[];
  filters: AuditFilterState;
  setFilters: (next: AuditFilterState) => void;
  onSelectRequest: (requestId: string) => void;
}

export function AuditLog({ entries, filters, setFilters, onSelectRequest }: AuditLogProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Audit Log</CardTitle>
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="Event type"
              value={filters.eventType}
              onChange={(event) => setFilters({ ...filters, eventType: event.target.value })}
            />
            <Input
              placeholder="Agent ID"
              value={filters.agentId}
              onChange={(event) => setFilters({ ...filters, agentId: event.target.value })}
            />
            <Input
              placeholder="Decision"
              value={filters.decision}
              onChange={(event) => setFilters({ ...filters, decision: event.target.value })}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-auto">
        <Table>
          <TableHead>
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Request</th>
              <th className="px-4 py-3">Receipt</th>
            </tr>
          </TableHead>
          <TableBody>
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-slate-300">{formatTimestamp(entry.timestamp)}</td>
                <td className="px-4 py-3">
                  <Badge variant={entry.eventType.includes("blocked") ? "danger" : "info"}>{entry.eventType}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-300">{entry.agentId ?? "n/a"}</td>
                <td className="px-4 py-3">
                  {entry.requestId ? (
                    <button className="text-cyan-300 hover:text-cyan-200" onClick={() => onSelectRequest(entry.requestId!)}>
                      {entry.requestId}
                    </button>
                  ) : (
                    <span className="text-slate-500">n/a</span>
                  )}
                </td>
                <td className="px-4 py-3 font-code text-xs text-slate-500">{entry.receiptHash.slice(0, 16)}...</td>
              </tr>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
