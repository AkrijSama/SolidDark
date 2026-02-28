import type { ReactNode } from "react";

import { Sidebar } from "@renderer/components/layout/Sidebar";
import { Topbar } from "@renderer/components/layout/Topbar";

interface ShellProps {
  currentRoute: string;
  onNavigate: (route: "dashboard" | "agents" | "policies" | "audit" | "settings") => void;
  proxyStatus: "running" | "paused";
  activeAgents: number;
  blockedToday: number;
  threatLevel: number;
  children: ReactNode;
}

export function Shell({
  currentRoute,
  onNavigate,
  proxyStatus,
  activeAgents,
  blockedToday,
  threatLevel,
  children,
}: ShellProps) {
  return (
    <div className="flex min-h-screen bg-transparent">
      <Sidebar currentRoute={currentRoute} onNavigate={onNavigate} />
      <main className="flex min-h-screen flex-1 flex-col overflow-hidden">
        <Topbar
          proxyStatus={proxyStatus}
          activeAgents={activeAgents}
          blockedToday={blockedToday}
          threatLevel={threatLevel}
        />
        <div className="flex-1 overflow-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
