import http from "node:http";
import net from "node:net";
import tls from "node:tls";
import { PassThrough } from "node:stream";
import { URL } from "node:url";

import httpProxy from "http-proxy";

import { createRequestInterceptor, requestInterceptor, type RequestInterceptor } from "./interceptor";
import { ensureCA, generateCertForDomain, getCAPath, getTrustInstructions, parseSniFromClientHello, shouldBypassMitm } from "./tls";

export interface ProxyServerOptions {
  port?: number;
  host?: string;
  tlsInterceptionEnabled?: boolean;
  connectionTimeoutMs?: number;
  maxConcurrentConnectionsPerAgent?: number;
  mitmBypassDomains?: string[];
  mitmFailureMode?: "passthrough" | "block";
}

export interface ProxyServerController {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  isRunning: () => boolean;
  isPaused: () => boolean;
  getPort: () => number;
  getTrustInstructions: () => string[];
}

function parseAbsoluteUrl(req: http.IncomingMessage, protocol: "http" | "https"): URL {
  if (!req.url) {
    throw new Error("Request is missing a URL.");
  }

  if (/^https?:\/\//i.test(req.url)) {
    return new URL(req.url);
  }

  const host = req.headers.host;
  if (!host) {
    throw new Error("Request is missing a Host header.");
  }

  return new URL(`${protocol}://${host}${req.url}`);
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function onceEvent<T>(emitter: NodeJS.EventEmitter, eventName: string, errorEvents: string[] = []): Promise<T> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      emitter.removeListener(eventName, onEvent);
      for (const errorEvent of errorEvents) {
        emitter.removeListener(errorEvent, onError);
      }
    };

    const onEvent = (value: T) => {
      cleanup();
      resolve(value);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    emitter.once(eventName, onEvent);
    for (const errorEvent of errorEvents) {
      emitter.once(errorEvent, onError);
    }
  });
}

async function collectClientHello(
  socket: net.Socket,
  head: Buffer,
  timeoutMs: number,
): Promise<Buffer> {
  if (head.length > 0) {
    return head;
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(Buffer.alloc(0));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeListener("data", onData);
      socket.removeListener("close", onClose);
      socket.removeListener("error", onClose);
    };

    const onData = (chunk: Buffer) => {
      cleanup();
      resolve(chunk);
    };

    const onClose = () => {
      cleanup();
      resolve(Buffer.alloc(0));
    };

    socket.once("data", onData);
    socket.once("close", onClose);
    socket.once("error", onClose);
  });
}

export function createProxyServer(
  options: ProxyServerOptions = {},
  interceptor: RequestInterceptor = requestInterceptor,
): ProxyServerController {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? Number(process.env.RASHOMON_PROXY_PORT ?? 8888);
  const connectionTimeoutMs = options.connectionTimeoutMs ?? 30_000;
  const maxConcurrentConnectionsPerAgent = options.maxConcurrentConnectionsPerAgent ?? 20;
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    secure: true,
    selfHandleResponse: false,
    prependPath: false,
    xfwd: false,
  });

  const requestIds = new WeakMap<http.IncomingMessage, string>();
  const mitmServers = new Set<http.Server>();
  const activeAgentConnections = new Map<string, number>();
  let paused = false;
  let started = false;
  let boundPort = requestedPort;

  function noteConnectionStart(agentId: string): boolean {
    const nextCount = (activeAgentConnections.get(agentId) ?? 0) + 1;
    if (nextCount > maxConcurrentConnectionsPerAgent) {
      return false;
    }
    activeAgentConnections.set(agentId, nextCount);
    return true;
  }

  function noteConnectionEnd(agentId: string): void {
    const nextCount = Math.max(0, (activeAgentConnections.get(agentId) ?? 1) - 1);
    if (nextCount === 0) {
      activeAgentConnections.delete(agentId);
      return;
    }
    activeAgentConnections.set(agentId, nextCount);
  }

  function applySocketTimeout(socket: net.Socket): void {
    socket.setTimeout(connectionTimeoutMs, () => {
      socket.destroy(new Error("Proxy connection timed out."));
    });
  }

  async function establishTunnel(
    clientSocket: net.Socket,
    connectHost: string,
    connectPort: number,
    bufferedHead: Buffer,
    requestId: string,
  ): Promise<void> {
    const upstream = net.connect(connectPort, connectHost, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (bufferedHead.length > 0) {
        upstream.write(bufferedHead);
      }
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });

    applySocketTimeout(clientSocket);
    applySocketTimeout(upstream);

    const finalize = (statusCode: number) => {
      void interceptor.finalize(requestId, statusCode, 0);
    };

    upstream.on("close", () => finalize(200));
    upstream.on("error", () => {
      finalize(502);
      clientSocket.destroy();
    });
    clientSocket.on("error", () => {
      finalize(499);
      upstream.destroy();
    });
    clientSocket.on("close", () => {
      upstream.destroy();
    });
  }

  proxy.on("proxyReq", (proxyReq, req) => {
    const body = (req as http.IncomingMessage & { rashomonBody?: Buffer }).rashomonBody;
    if (body && body.length > 0) {
      proxyReq.setHeader("content-length", String(body.length));
      proxyReq.write(body);
    }
  });

  proxy.on("proxyRes", (proxyRes, req) => {
    const requestId = requestIds.get(req);
    if (!requestId) {
      return;
    }

    let responseBodySize = 0;
    proxyRes.on("data", (chunk) => {
      responseBodySize += Buffer.byteLength(chunk);
    });
    proxyRes.on("end", () => {
      void interceptor.finalize(requestId, proxyRes.statusCode ?? 0, responseBodySize);
    });
  });

  proxy.on("error", (error, req, res) => {
    const response = res as http.ServerResponse | undefined;
    if (response && !response.headersSent) {
      response.writeHead(502, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          error: "proxy_error",
          reason: error.message,
        }),
      );
    }

    const requestId = req ? requestIds.get(req) : undefined;
    if (requestId) {
      void interceptor.finalize(requestId, 502, 0);
    }
  });

  async function handleHttpRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    protocol: "http" | "https",
    forcedOrigin?: URL,
  ): Promise<void> {
    if (paused) {
      res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "paused", reason: "Rashomon monitoring is paused." }));
      return;
    }

    const targetUrl = forcedOrigin ? new URL(req.url ?? "/", forcedOrigin) : parseAbsoluteUrl(req, protocol);
    const bodyBuffer = await readBody(req);
    const headers = Object.fromEntries(
      Object.entries(req.headers)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [key, value as string]),
    );

    const result = await interceptor.intercept({
      method: req.method ?? "GET",
      url: targetUrl.toString(),
      headers,
      body: bodyBuffer.toString("utf8"),
      remoteAddress: req.socket.remoteAddress,
      sourcePort: req.socket.remotePort,
      protocol,
    });

    if (result.action !== "allow") {
      res.writeHead(result.statusCode, result.responseHeaders);
      res.end(result.responseBody);
      return;
    }

    if (!noteConnectionStart(result.agent.id)) {
      res.writeHead(429, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "throttle", reason: "Maximum concurrent agent connections exceeded." }));
      await interceptor.finalize(result.requestId, 429, 0);
      return;
    }

    let finished = false;
    const cleanup = () => {
      if (finished) {
        return;
      }
      finished = true;
      noteConnectionEnd(result.agent.id);
    };

    res.once("close", cleanup);
    res.once("finish", cleanup);
    req.socket.once("close", cleanup);
    applySocketTimeout(req.socket as net.Socket);

    requestIds.set(req, result.requestId);
    (req as http.IncomingMessage & { rashomonBody?: Buffer }).rashomonBody = bodyBuffer;
    req.url = `${targetUrl.pathname}${targetUrl.search}`;

    const buffer = new PassThrough();
    buffer.end(bodyBuffer);

    proxy.web(req, res, {
      target: `${targetUrl.protocol}//${targetUrl.host}`,
      buffer,
    });
  }

  const server = http.createServer((req, res) => {
    void handleHttpRequest(req, res, "http").catch((error) => {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "proxy_internal_error", reason: error.message }));
      }
    });
  });

  server.setTimeout(connectionTimeoutMs);
  server.on("clientError", (error, socket) => {
    socket.end(`HTTP/1.1 400 Bad Request\r\n\r\n${error.message}`);
  });

  server.on("connect", (req, clientSocket, head) => {
    const inboundSocket = clientSocket as net.Socket;
    applySocketTimeout(inboundSocket);

    void (async () => {
      const [connectHost, connectPortRaw] = (req.url ?? "").split(":");
      const connectPort = Number(connectPortRaw || 443);

      if (!connectHost || !connectPort) {
        inboundSocket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
        return;
      }

      const connectResult = await interceptor.intercept({
        method: "CONNECT",
        url: `https://${connectHost}:${connectPort}`,
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([, value]) => typeof value === "string")
            .map(([key, value]) => [key, value as string]),
        ),
        body: "",
        remoteAddress: req.socket.remoteAddress,
        sourcePort: inboundSocket.remotePort,
        protocol: "https",
        connectHost,
        connectPort,
      });

      if (connectResult.action !== "allow") {
        inboundSocket.write(
          `HTTP/1.1 ${connectResult.statusCode} Blocked\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n${connectResult.responseBody ?? ""}`,
        );
        inboundSocket.destroy();
        return;
      }

      if (!noteConnectionStart(connectResult.agent.id)) {
        inboundSocket.write(
          "HTTP/1.1 429 Too Many Requests\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n" +
            JSON.stringify({ error: "throttle", reason: "Maximum concurrent agent connections exceeded." }),
        );
        inboundSocket.destroy();
        await interceptor.finalize(connectResult.requestId, 429, 0);
        return;
      }

      let released = false;
      const release = () => {
        if (released) {
          return;
        }
        released = true;
        noteConnectionEnd(connectResult.agent.id);
      };

      inboundSocket.once("close", release);
      inboundSocket.once("error", release);

      if (!options.tlsInterceptionEnabled) {
        await establishTunnel(inboundSocket, connectHost, connectPort, head, connectResult.requestId);
        return;
      }

      inboundSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      const clientHello = await collectClientHello(inboundSocket, head, Math.min(connectionTimeoutMs, 1_500));
      const sniHost = parseSniFromClientHello(clientHello) ?? connectHost;
      const bypassMitm = shouldBypassMitm(sniHost, options.mitmBypassDomains);

      if (bypassMitm) {
        await establishTunnel(inboundSocket, connectHost, connectPort, clientHello, connectResult.requestId);
        return;
      }

      try {
        ensureCA();
        const cert = generateCertForDomain(sniHost);
        const secureContext = tls.createSecureContext({
          cert: cert.certPem,
          key: cert.keyPem,
        });

        const mitmHttpServer = http.createServer((innerReq, innerRes) => {
          void handleHttpRequest(innerReq, innerRes, "https", new URL(`https://${sniHost}:${connectPort}`)).catch(
            (error) => {
              if (!innerRes.headersSent) {
                innerRes.writeHead(502, { "content-type": "application/json; charset=utf-8" });
                innerRes.end(JSON.stringify({ error: "https_proxy_error", reason: error.message }));
              }
            },
          );
        });
        mitmServers.add(mitmHttpServer);

        const tlsSocket = new tls.TLSSocket(inboundSocket, {
          isServer: true,
          secureContext,
        });
        applySocketTimeout(tlsSocket);

        const failMitm = async () => {
          release();
          if (options.mitmFailureMode === "block") {
            await interceptor.finalize(connectResult.requestId, 502, 0);
            tlsSocket.destroy();
            return;
          }
          tlsSocket.destroy();
        };

        tlsSocket.on("error", () => {
          void failMitm();
        });
        mitmHttpServer.on("clientError", () => {
          tlsSocket.destroy();
        });
        tlsSocket.once("close", release);

        mitmHttpServer.emit("connection", tlsSocket);
        if (clientHello.length > 0) {
          tlsSocket.unshift(clientHello);
        }
      } catch (error) {
        if (options.mitmFailureMode === "block") {
          inboundSocket.end(
            "HTTP/1.1 502 Bad Gateway\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n" +
              JSON.stringify({ error: "mitm_setup_failed", reason: error instanceof Error ? error.message : "unknown" }),
          );
          await interceptor.finalize(connectResult.requestId, 502, 0);
          release();
          return;
        }

        await establishTunnel(inboundSocket, connectHost, connectPort, clientHello, connectResult.requestId);
      }
    })().catch((error) => {
      inboundSocket.end(
        "HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n" +
          JSON.stringify({ error: "proxy_connect_error", reason: error instanceof Error ? error.message : "unknown" }),
      );
    });
  });

  return {
    async start() {
      if (started) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(requestedPort, host, () => {
          server.off("error", reject);
          const address = server.address();
          if (address && typeof address === "object") {
            boundPort = address.port;
          }
          started = true;
          resolve();
        });
      });
    },

    async stop() {
      if (!started) {
        return;
      }

      for (const mitmServer of mitmServers) {
        mitmServer.close();
      }

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          started = false;
          resolve();
        });
      });
    },

    pause() {
      paused = true;
    },

    resume() {
      paused = false;
    },

    isRunning() {
      return started;
    },

    isPaused() {
      return paused;
    },

    getPort() {
      return boundPort;
    },

    getTrustInstructions() {
      return [`CA certificate: ${getCAPath()}`, ...getTrustInstructions()];
    },
  };
}

export const proxyServer = createProxyServer();
