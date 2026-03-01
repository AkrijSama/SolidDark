"use client";

import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";

type DailyStat = {
  date: string;
  totalEvents: number;
  secretsDetected?: number;
  domainsBlocked?: number;
  exfiltrationAttempts?: number;
  promptInjections?: number;
  intentMismatches?: number;
};

type ThreatDomain = {
  id: string;
  domain: string;
  totalBlocks: number;
  reportedBy: number;
  confidence: number;
  isConfirmed: boolean;
  category: string | null;
};

type ThreatIntelData = {
  dailyStats: DailyStat[];
  topDomains: ThreatDomain[];
  totalEvents: number;
  todayEvents: number;
  confirmedDomains: number;
  uniqueInstallations: number;
  topSecretTypes: Array<{ type: string; count: number }>;
  topAgents: Array<{ name: string; events: number }>;
};

const PIE_COLORS = ["#c9a13f", "#5dd4c4", "#ef4444", "#64748b", "#8b5cf6"];

function OverviewCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">{label}</p>
      <p className="mt-3 font-heading text-3xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{hint}</p>
    </div>
  );
}

export function ThreatIntelDashboard({ data }: { data: ThreatIntelData }) {
  const eventTypeBreakdown = [
    { name: "Secrets", value: data.dailyStats.reduce((sum, day) => sum + Number(day.secretsDetected ?? 0), 0) },
    { name: "Blocked domains", value: data.dailyStats.reduce((sum, day) => sum + Number(day.domainsBlocked ?? 0), 0) },
    { name: "Exfiltration", value: data.dailyStats.reduce((sum, day) => sum + Number(day.exfiltrationAttempts ?? 0), 0) },
    { name: "Prompt injection", value: data.dailyStats.reduce((sum, day) => sum + Number(day.promptInjections ?? 0), 0) },
    { name: "Intent mismatch", value: data.dailyStats.reduce((sum, day) => sum + Number(day.intentMismatches ?? 0), 0) },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OverviewCard label="Total events" value={data.totalEvents} hint="All reported Rashomon telemetry events." />
        <OverviewCard label="Events today" value={data.todayEvents} hint="Fresh reports since midnight UTC." />
        <OverviewCard label="Installations" value={data.uniqueInstallations} hint="Distinct anonymous Rashomon installations." />
        <OverviewCard label="Confirmed domains" value={data.confirmedDomains} hint="Reviewed malicious domains in the network feed." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">30-day trend</p>
            <h3 className="mt-2 font-heading text-2xl font-semibold">Threat event volume</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyStats}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#8b93a7", fontSize: 12 }} tickFormatter={(value) => value.slice(5)} />
                <YAxis tick={{ fill: "#8b93a7", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "#10101C", borderColor: "rgba(255,255,255,0.08)", borderRadius: 16 }} />
                <Bar dataKey="totalEvents" fill="#c9a13f" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Event mix</p>
            <h3 className="mt-2 font-heading text-2xl font-semibold">Network profile</h3>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={eventTypeBreakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={88} paddingAngle={3}>
                  {eventTypeBreakdown.map((entry, index) => (
                    <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "#10101C", borderColor: "rgba(255,255,255,0.08)", borderRadius: 16 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Top blocked domains</p>
            <h3 className="mt-2 font-heading text-2xl font-semibold">Community deny candidates</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[var(--text-tertiary)]">
                <tr className="border-b border-[var(--border-default)]">
                  <th className="pb-3">Domain</th>
                  <th className="pb-3">Blocks</th>
                  <th className="pb-3">Installations</th>
                  <th className="pb-3">Confidence</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.topDomains.map((domain) => (
                  <tr key={domain.id} className="border-b border-[var(--border-default)]/60">
                    <td className="py-3 font-mono text-[var(--text-primary)]">{domain.domain}</td>
                    <td className="py-3">{domain.totalBlocks}</td>
                    <td className="py-3">{domain.reportedBy}</td>
                    <td className="py-3">{(domain.confidence * 100).toFixed(0)}%</td>
                    <td className="py-3">
                      {domain.isConfirmed ? (
                        <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Confirmed</Badge>
                      ) : (
                        <Badge variant="outline" className="border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                          Watching
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Top secret types</p>
              <h3 className="mt-2 font-heading text-2xl font-semibold">What leaks most</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topSecretTypes} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fill: "#8b93a7", fontSize: 12 }} />
                  <YAxis dataKey="type" type="category" tick={{ fill: "#e5e7eb", fontSize: 12 }} width={120} />
                  <Tooltip contentStyle={{ backgroundColor: "#10101C", borderColor: "rgba(255,255,255,0.08)", borderRadius: 16 }} />
                  <Bar dataKey="count" fill="#5dd4c4" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-tertiary)]">Agent leaderboard</p>
              <h3 className="mt-2 font-heading text-2xl font-semibold">Who trips policies most</h3>
            </div>
            <div className="space-y-3">
              {data.topAgents.map((agent, index) => (
                <div key={agent.name} className="flex items-center justify-between rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-[var(--text-tertiary)]">{String(index + 1).padStart(2, "0")}</span>
                    <span className="text-[var(--text-primary)]">{agent.name}</span>
                  </div>
                  <Badge variant="outline" className="border-[var(--accent-cyan)]/30 bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)]">
                    {agent.events} events
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
