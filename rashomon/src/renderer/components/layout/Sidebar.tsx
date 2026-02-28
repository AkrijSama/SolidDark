import { Bot, Lock, ScrollText, Settings, Shield } from "lucide-react";

import { Badge } from "@renderer/components/ui/badge";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Shield },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "policies", label: "Policies", icon: Lock },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

interface SidebarProps {
  currentRoute: string;
  onNavigate: (route: (typeof navItems)[number]["id"]) => void;
}

export function Sidebar({ currentRoute, onNavigate }: SidebarProps) {
  return (
    <aside className="panel flex w-72 shrink-0 flex-col rounded-r-3xl border-l-0 border-t-0 border-b-0 px-4 py-5">
      <div className="mb-8 px-3">
        <p className="font-code text-xs uppercase tracking-[0.3em] text-cyan-300">Rashomon</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
          The gate between your agent and the wire.
        </h1>
      </div>

      <nav className="flex flex-1 flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentRoute === item.id;
          return (
            <button
              key={item.id}
              className={`flex items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                active ? "bg-cyan-500/12 text-white status-glow-safe" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="flex items-center gap-3">
                <Icon size={18} />
                <span>{item.label}</span>
              </span>
              {active ? <Badge variant="info">Live</Badge> : null}
            </button>
          );
        })}
      </nav>

      <div className="rounded-2xl border border-white/5 bg-white/3 px-4 py-4">
        <p className="font-code text-xs uppercase tracking-[0.24em] text-slate-400">Operating Mode</p>
        <p className="mt-2 text-sm text-slate-300">
          Local-first. Traffic decisions are enforced on `127.0.0.1` with a tamper-evident receipt trail.
        </p>
      </div>
    </aside>
  );
}
