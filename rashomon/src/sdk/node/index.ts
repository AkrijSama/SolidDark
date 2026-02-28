const DEFAULT_PROXY_URL = `http://127.0.0.1:${process.env.RASHOMON_PROXY_PORT ?? "8888"}`;

interface ConfigureOptions {
  proxyUrl?: string;
  agentId?: string;
  agentName?: string;
  processName?: string;
  pid?: number;
}

function buildHeaders(options: ConfigureOptions = {}): Record<string, string> {
  return {
    "x-rashomon-agent-id": options.agentId ?? `node-sdk-${process.pid}`,
    "x-rashomon-agent-name": options.agentName ?? "node-sdk",
    "x-rashomon-process-name": options.processName ?? process.title,
    "x-rashomon-agent-pid": String(options.pid ?? process.pid),
  };
}

export function configureProxy(options: ConfigureOptions = {}): Record<string, string> {
  const proxyUrl = options.proxyUrl ?? DEFAULT_PROXY_URL;
  process.env.HTTP_PROXY = proxyUrl;
  process.env.HTTPS_PROXY = proxyUrl;
  process.env.http_proxy = proxyUrl;
  process.env.https_proxy = proxyUrl;
  return buildHeaders(options);
}

export const rashomon = {
  configureProxy,

  async check(url: string, body = "", options: ConfigureOptions = {}) {
    const proxyUrl = options.proxyUrl ?? DEFAULT_PROXY_URL;
    const target = new URL(url);
    return fetch(proxyUrl, {
      method: "POST",
      headers: {
        host: target.host,
        "content-type": "text/plain",
        ...buildHeaders(options),
      },
      body,
    });
  },

  async report(agentId: string, action: string, metadata: Record<string, unknown> = {}) {
    return {
      agentId,
      action,
      metadata,
      reportedAt: Date.now(),
    };
  },
};
