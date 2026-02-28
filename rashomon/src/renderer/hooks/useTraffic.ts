import { startTransition, useEffect, useEffectEvent, useState } from "react";

import { invokeIpc, subscribeIpc } from "@renderer/lib/ipc";
import type { DashboardStats, TrafficEvent } from "@shared/types";

interface TrafficState {
  events: TrafficEvent[];
  stats: DashboardStats;
  isConnected: boolean;
}

export function useTraffic(): TrafficState {
  const [events, setEvents] = useState<TrafficEvent[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    requestsToday: 0,
    blockedToday: 0,
    activeAgents: 0,
    threatLevel: 0,
  });
  const [isConnected, setIsConnected] = useState(false);

  const handleTraffic = useEffectEvent((event: TrafficEvent) => {
    startTransition(() => {
      setEvents((previous) => [event, ...previous].slice(0, 200));
      setStats((previous) => ({
        requestsToday: previous.requestsToday + 1,
        blockedToday: previous.blockedToday + (event.decision === "allow" ? 0 : 1),
        activeAgents: previous.activeAgents,
        threatLevel: Math.max(previous.threatLevel, event.threatScore),
      }));
    });
  });

  useEffect(() => {
    let active = true;
    void invokeIpc<DashboardStats>("stats:summary").then((summary) => {
      if (active) {
        setStats(summary);
      }
    });

    const unsubscribe = subscribeIpc<TrafficEvent>("traffic:stream", (event) => {
      setIsConnected(true);
      handleTraffic(event);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [handleTraffic]);

  return { events, stats, isConnected };
}
