import { useMemo, useState } from "react";

import { Badge } from "@renderer/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { formatTimestamp } from "@renderer/lib/format";
import type { TrafficEvent } from "@shared/types";

interface TrafficFeedProps {
  events: TrafficEvent[];
  onSelectRequest: (requestId: string) => void;
}

export function TrafficFeed({ events, onSelectRequest }: TrafficFeedProps) {
  const [paused, setPaused] = useState(false);
  const visibleEvents = useMemo(() => (paused ? events.slice(0, 40) : events), [events, paused]);

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Traffic Feed</CardTitle>
        <Badge variant={paused ? "warn" : "info"}>{paused ? "Paused" : "Streaming"}</Badge>
      </CardHeader>
      <CardContent
        className="max-h-[520px] overflow-auto"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="space-y-3">
          {visibleEvents.map((event) => (
            <button
              key={event.requestId}
              className="fade-up grid w-full grid-cols-[160px_1fr_120px_120px] items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.025] px-4 py-3 text-left hover:bg-white/[0.06]"
              onClick={() => onSelectRequest(event.requestId)}
            >
              <div>
                <p className="font-code text-xs text-slate-400">{formatTimestamp(event.timestamp)}</p>
                <p className="mt-1 text-sm text-slate-200">{event.agentName}</p>
              </div>
              <div>
                <Badge variant={event.method === "GET" ? "safe" : event.method === "POST" ? "warn" : "danger"}>
                  {event.method}
                </Badge>
                <p className="mt-2 text-sm text-white">{event.domain}</p>
                <p className="mt-1 text-xs text-slate-500">{event.reason}</p>
              </div>
              <div>
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Threat</p>
                <p className="mt-2 text-lg font-semibold text-slate-100">{Math.round(event.threatScore)}</p>
              </div>
              <div>
                <Badge variant={event.decision === "allow" ? "safe" : event.decision === "throttle" ? "warn" : "danger"}>
                  {event.decision}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
