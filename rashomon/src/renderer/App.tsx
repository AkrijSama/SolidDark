import { useEffect, useMemo, useState } from "react";

import { AgentList } from "@renderer/components/agents/AgentList";
import { AgentProfile } from "@renderer/components/agents/AgentProfile";
import { AgentCard } from "@renderer/components/dashboard/AgentCard";
import { BlockedAlert } from "@renderer/components/dashboard/BlockedAlert";
import { StatCard } from "@renderer/components/dashboard/StatCard";
import { TrafficFeed } from "@renderer/components/dashboard/TrafficFeed";
import { Shell } from "@renderer/components/layout/Shell";
import { AuditLog } from "@renderer/components/logs/AuditLog";
import { ExportButton } from "@renderer/components/logs/ExportButton";
import { RequestDetail } from "@renderer/components/logs/RequestDetail";
import { PolicyEditor } from "@renderer/components/policies/PolicyEditor";
import { PolicyList } from "@renderer/components/policies/PolicyList";
import { AISettings } from "@renderer/components/settings/AISettings";
import { CertSettings } from "@renderer/components/settings/CertSettings";
import { GeneralSettings } from "@renderer/components/settings/GeneralSettings";
import { Card, CardContent } from "@renderer/components/ui/card";
import { useAgents } from "@renderer/hooks/useAgents";
import { useAuditLog } from "@renderer/hooks/useAuditLog";
import { usePolicies } from "@renderer/hooks/usePolicies";
import { useTraffic } from "@renderer/hooks/useTraffic";
import { invokeIpc } from "@renderer/lib/ipc";
import type { SettingsState } from "@shared/types";

type RouteId = "dashboard" | "agents" | "policies" | "audit" | "settings";

export default function App() {
  const [route, setRoute] = useState<RouteId>("dashboard");
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>();
  const [selectedRequestId, setSelectedRequestId] = useState<string>();
  const [selectedRequest, setSelectedRequest] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<(SettingsState & { caPath?: string; proxyRunning?: boolean; proxyPaused?: boolean }) | null>(null);

  const { events, stats, isConnected } = useTraffic();
  const { agents, killAgent, resumeAgent } = useAgents();
  const policies = usePolicies();
  const audit = useAuditLog();

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0],
    [agents, selectedAgentId],
  );
  const selectedPolicy = useMemo(
    () => policies.policies.find((policy) => policy.id === selectedPolicyId) ?? policies.policies[0],
    [policies.policies, selectedPolicyId],
  );
  const latestBlockedEvent = useMemo(
    () => events.find((event) => event.decision !== "allow"),
    [events],
  );

  useEffect(() => {
    void invokeIpc<typeof settings>("settings:get").then((nextSettings) => {
      setSettings(nextSettings);
    });
  }, []);

  useEffect(() => {
    if (!selectedRequestId) {
      return;
    }

    void invokeIpc<Record<string, unknown> | null>("requests:detail", selectedRequestId).then((request) => {
      setSelectedRequest(request);
    });
  }, [selectedRequestId]);

  const content = (() => {
    switch (route) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <BlockedAlert
              event={latestBlockedEvent}
              onViewDetail={(requestId) => {
                setSelectedRequestId(requestId);
                setRoute("audit");
              }}
              onKillAgent={(agentId) => void killAgent(agentId)}
            />
            <div className="grid gap-4 xl:grid-cols-4">
              <StatCard label="Requests Today" value={stats.requestsToday} trend={7} colorClass="text-cyan-300" />
              <StatCard label="Blocked Today" value={stats.blockedToday} trend={stats.blockedToday > 0 ? 12 : -4} colorClass="text-red-300" />
              <StatCard label="Active Agents" value={stats.activeAgents} trend={3} colorClass="text-violet-300" />
              <StatCard label="Threat Level" value={Math.round(stats.threatLevel)} trend={stats.threatLevel > 35 ? 18 : -5} colorClass="text-yellow-300" />
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
              <TrafficFeed
                events={events}
                onSelectRequest={(requestId) => {
                  setSelectedRequestId(requestId);
                  setRoute("audit");
                }}
              />
              <div className="space-y-4">
                <Card className="rounded-2xl">
                  <CardContent className="py-5">
                    <p className="font-code text-xs uppercase tracking-[0.24em] text-slate-500">Stream Health</p>
                    <p className="mt-3 text-sm text-slate-300">
                      {isConnected ? "Traffic events are reaching the dashboard in real time." : "Waiting for live traffic."}
                    </p>
                  </CardContent>
                </Card>
                {agents.slice(0, 3).map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>
            </div>
          </div>
        );
      case "agents":
        return (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <AgentList
              agents={agents}
              selectedAgentId={selectedAgent?.id}
              onSelect={setSelectedAgentId}
              onKill={killAgent}
            />
            <AgentProfile agent={selectedAgent} />
          </div>
        );
      case "policies":
        return (
          <div className="grid gap-6 xl:grid-cols-[0.65fr_1.35fr]">
            <PolicyList policies={policies.policies} selectedPolicyId={selectedPolicy?.id} onSelect={setSelectedPolicyId} />
            <PolicyEditor
              policy={selectedPolicy}
              onSave={policies.updatePolicy}
              onCreate={policies.createPolicy}
            />
          </div>
        );
      case "audit":
        return (
          <div className="space-y-6">
            <div className="flex justify-end">
              <ExportButton onExport={audit.exportLog} />
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <AuditLog
                entries={audit.entries}
                filters={audit.filters}
                setFilters={audit.setFilters}
                onSelectRequest={setSelectedRequestId}
              />
              <RequestDetail request={selectedRequest} />
            </div>
          </div>
        );
      case "settings":
        return settings ? (
          <div className="grid gap-6 xl:grid-cols-3">
            <GeneralSettings
              settings={settings}
              onUpdate={async (patch) => {
                const next = await invokeIpc<typeof settings>("settings:update", patch);
                setSettings(next);
              }}
            />
            <AISettings
              settings={settings}
              onUpdate={async (patch) => {
                const next = await invokeIpc<typeof settings>("settings:update", patch);
                setSettings(next);
              }}
            />
            <CertSettings
              caPath={settings.caPath ?? ""}
              instructions={[
                "macOS: import the CA into Keychain Access and mark it Always Trust.",
                "Windows: import the CA into Trusted Root Certification Authorities.",
                "Linux: import the CA into your browser or local trust store.",
              ]}
            />
          </div>
        ) : null;
      default:
        return null;
    }
  })();

  return (
    <Shell
      currentRoute={route}
      onNavigate={setRoute}
      proxyStatus={settings?.proxyPaused ? "paused" : "running"}
      activeAgents={stats.activeAgents}
      blockedToday={stats.blockedToday}
      threatLevel={stats.threatLevel}
    >
      {content}
      {route === "agents" && selectedAgent?.status === "killed" ? (
        <div className="mt-6">
          <button className="text-sm text-cyan-300 hover:text-cyan-200" onClick={() => void resumeAgent(selectedAgent.id)}>
            Resume proxy access for {selectedAgent.name}
          </button>
        </div>
      ) : null}
    </Shell>
  );
}
