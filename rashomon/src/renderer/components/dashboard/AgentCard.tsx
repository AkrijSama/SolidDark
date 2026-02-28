import { Badge } from "@renderer/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import { ThreatScore } from "@renderer/components/dashboard/ThreatScore";
import type { AgentView } from "@renderer/hooks/useAgents";

interface AgentCardProps {
  agent: AgentView;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>{agent.name}</CardTitle>
            <p className="mt-2 text-sm text-slate-400">{agent.processName}</p>
          </div>
          <Badge variant={agent.status === "active" ? "safe" : agent.status === "killed" ? "danger" : "neutral"}>
            {agent.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
          <div>
            <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">PID</p>
            <p className="mt-1">{agent.pid}</p>
          </div>
          <div>
            <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Blocked</p>
            <p className="mt-1">{agent.blockedRequests}</p>
          </div>
        </div>
        <ThreatScore score={agent.threatScore} />
      </CardContent>
    </Card>
  );
}
