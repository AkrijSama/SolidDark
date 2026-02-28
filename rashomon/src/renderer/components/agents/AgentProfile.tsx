import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@renderer/components/ui/card";
import type { AgentView } from "@renderer/hooks/useAgents";

interface AgentProfileProps {
  agent?: AgentView;
}

function buildChartData(agent?: AgentView) {
  if (!agent) {
    return [];
  }

  return [
    { label: "Requests", value: agent.totalRequests },
    { label: "Blocked", value: agent.blockedRequests },
    { label: "Threat", value: Math.round(agent.threatScore) },
  ];
}

export function AgentProfile({ agent }: AgentProfileProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle>Agent Profile</CardTitle>
      </CardHeader>
      <CardContent>
        {agent ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Behavior</p>
                <p className="mt-3 text-sm text-slate-300">
                  {agent.status === "killed"
                    ? "Outbound proxy access is currently severed."
                    : "Observed through the local proxy with rolling threat scoring."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Dominant Pattern</p>
                <p className="mt-3 text-sm text-slate-300">
                  {agent.blockedRequests > 0 ? "Repeated policy matches were observed." : "Traffic has remained compliant."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="font-code text-xs uppercase tracking-[0.2em] text-slate-500">Timeline</p>
                <p className="mt-3 text-sm text-slate-300">Live request history is captured in the audit stream.</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={buildChartData(agent)}>
                  <XAxis dataKey="label" stroke="#8888A0" />
                  <YAxis stroke="#8888A0" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#10101C",
                      border: "1px solid #2A2A40",
                      borderRadius: 16,
                    }}
                  />
                  <Bar dataKey="value" fill="#06B6D4" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Select an agent to inspect its behavior profile.</p>
        )}
      </CardContent>
    </Card>
  );
}
