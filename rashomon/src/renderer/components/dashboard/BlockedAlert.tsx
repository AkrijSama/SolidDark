import { ShieldBan } from "lucide-react";

import { Button } from "@renderer/components/ui/button";
import { Card, CardContent } from "@renderer/components/ui/card";
import type { TrafficEvent } from "@shared/types";

interface BlockedAlertProps {
  event?: TrafficEvent;
  onViewDetail: (requestId: string) => void;
  onKillAgent: (agentId: string) => void;
}

export function BlockedAlert({ event, onViewDetail, onKillAgent }: BlockedAlertProps) {
  if (!event) {
    return null;
  }

  return (
    <Card className="status-glow-danger rounded-2xl border-red-400/25 bg-red-500/8">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-red-500/20 p-3 text-red-300">
            <ShieldBan size={20} />
          </div>
          <div>
            <p className="font-code text-xs uppercase tracking-[0.24em] text-red-200">Blocked Request</p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {event.agentName} attempted outbound traffic to {event.domain}
            </h3>
            <p className="mt-2 text-sm text-red-100/80">{event.reason}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => onViewDetail(event.requestId)}>
            View Detail
          </Button>
          <Button variant="danger" onClick={() => onKillAgent(event.agentId)}>
            Kill Agent
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
