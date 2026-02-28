import { startTransition, useEffect, useState } from "react";

import { invokeIpc } from "@renderer/lib/ipc";

export interface AgentView {
  id: string;
  name: string;
  processName: string;
  pid: number;
  status: "active" | "inactive" | "killed";
  totalRequests: number;
  blockedRequests: number;
  threatScore: number;
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentView[]>([]);

  useEffect(() => {
    let mounted = true;

    const refresh = async () => {
      const next = await invokeIpc<AgentView[]>("agents:list");
      if (mounted) {
        startTransition(() => setAgents(next));
      }
    };

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5_000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return {
    agents,
    async killAgent(id: string) {
      await invokeIpc("agents:kill", id);
      setAgents((previous) => previous.map((agent) => (agent.id === id ? { ...agent, status: "killed" } : agent)));
    },
    async resumeAgent(id: string) {
      await invokeIpc("agents:resume", id);
      setAgents((previous) => previous.map((agent) => (agent.id === id ? { ...agent, status: "active" } : agent)));
    },
  };
}
