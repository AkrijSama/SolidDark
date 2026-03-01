import type { IpcResponse } from "@shared/types";

type Listener<T> = (payload: T) => void;

interface RashomonBridge {
  invoke: <T>(channel: string, payload?: unknown) => Promise<IpcResponse<T>>;
  on: <T>(channel: string, callback: Listener<T>) => () => void;
}

declare global {
  interface Window {
    rashomon?: RashomonBridge;
  }
}

const fallbackData: Record<string, unknown> = {
  "stats:summary": {
    requestsToday: 0,
    blockedToday: 0,
    activeAgents: 0,
    threatLevel: 0,
  },
  "agents:list": [],
  "policies:list": [],
  "domains:list": [],
  "audit:query": [],
  "settings:get": {
    proxyPort: 8888,
    dashboardPort: 9090,
    autoStart: false,
    notificationsEnabled: true,
    tlsInterceptionEnabled: false,
    telemetryEnabled: true,
    intentProvider: "disabled",
    anthropicApiKey: "",
    ollamaBaseUrl: "http://127.0.0.1:11434",
    intentModel: "claude-sonnet-4-5-20250929",
    intentThreshold: 30,
    caPath: "",
    proxyRunning: false,
    proxyPaused: false,
  },
};

export async function invokeIpc<T>(channel: string, payload?: unknown): Promise<T> {
  if (!window.rashomon) {
    return (fallbackData[channel] ?? null) as T;
  }

  const response = await window.rashomon.invoke<T>(channel, payload);
  if (!response.ok) {
    throw new Error(response.error ?? `IPC call failed for ${channel}.`);
  }

  return response.data as T;
}

export function subscribeIpc<T>(channel: string, callback: Listener<T>): () => void {
  if (!window.rashomon) {
    return () => undefined;
  }

  return window.rashomon.on(channel, callback);
}
