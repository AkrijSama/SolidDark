import { Activity, ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Badge } from "@renderer/components/ui/badge";

interface TopbarProps {
  proxyStatus: "running" | "paused";
  activeAgents: number;
  blockedToday: number;
  threatLevel: number;
}

export function Topbar({ proxyStatus, activeAgents, blockedToday, threatLevel }: TopbarProps) {
  const threatVariant = threatLevel >= 70 ? "danger" : threatLevel >= 35 ? "warn" : "safe";
  const ThreatIcon = threatLevel >= 70 ? ShieldAlert : threatLevel >= 35 ? ShieldQuestion : ShieldCheck;

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
      <div>
        <p className="font-code text-xs uppercase tracking-[0.24em] text-slate-500">Proxy Status</p>
        <div className="mt-2 flex items-center gap-3">
          <Badge variant={proxyStatus === "running" ? "safe" : "warn"}>{proxyStatus}</Badge>
          <span className="text-sm text-slate-400">Local proxy at 127.0.0.1:8888</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="agent">
          <Activity size={12} className="mr-1" />
          {activeAgents} active agents
        </Badge>
        <Badge variant={blockedToday > 0 ? "danger" : "safe"}>{blockedToday} blocked today</Badge>
        <Badge variant={threatVariant}>
          <ThreatIcon size={12} className="mr-1" />
          Threat {Math.round(threatLevel)}
        </Badge>
      </div>
    </header>
  );
}
