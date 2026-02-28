import { AgentKillSwitch } from "@renderer/components/agents/AgentKillSwitch";
import { ThreatScore } from "@renderer/components/dashboard/ThreatScore";
import { Badge } from "@renderer/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import type { AgentView } from "@renderer/hooks/useAgents";

interface AgentListProps {
  agents: AgentView[];
  selectedAgentId?: string;
  onSelect: (agentId: string) => void;
  onKill: (agentId: string) => Promise<void>;
}

export function AgentList({ agents, selectedAgentId, onSelect, onKill }: AgentListProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <Card
          key={agent.id}
          className={`rounded-2xl transition hover:border-cyan-400/35 ${selectedAgentId === agent.id ? "border-cyan-400/40" : ""}`}
        >
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
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Requests</p>
                <p className="mt-1">{agent.totalRequests}</p>
              </div>
              <div>
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Blocked</p>
                <p className="mt-1">{agent.blockedRequests}</p>
              </div>
            </div>
            <ThreatScore score={agent.threatScore} />
            <div className="flex flex-wrap justify-between gap-2">
              <button className="text-sm text-cyan-300 hover:text-cyan-200" onClick={() => onSelect(agent.id)}>
                View Profile
              </button>
              <AgentKillSwitch agentId={agent.id} agentName={agent.name} onKill={onKill} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
