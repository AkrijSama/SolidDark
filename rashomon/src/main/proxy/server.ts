import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { PassThrough } from "node:stream";
import { URL } from "node:url";

import httpProxy from "http-proxy";

import { createRequestInterceptor, requestInterceptor, type RequestInterceptor } from "./interceptor";
import { ensureCA, generateCertForDomain, getCAPath, getTrustInstructions } from "./tls";

export interface ProxyServerOptions {
  port?: number;
  host?: string;
  tlsInterceptionEnabled?: boolean;
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

export function createProxyServer(
  options: ProxyServerOptions = {},
  interceptor: RequestInterceptor = requestInterceptor,
): ProxyServerController {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? Number(process.env.RASHOMON_PROXY_PORT ?? 8888);
  const proxy = httpProxy.createProxyServer({
    changeOrigin: true,
    secure: false,
    selfHandleResponse: false,
    prependPath: false,
    xfwd: false,
  });

  const requestIds = new WeakMap<http.IncomingMessage, string>();
  const mitmServers = new Set<http.Server>();
  let paused = false;
  let started = false;

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
      protocol,
    });

    if (result.action !== "allow") {
      res.writeHead(result.statusCode, result.responseHeaders);
      res.end(result.responseBody);
      return;
    }

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
    void handleHttpRequest(req, res, "http");
  });

  server.on("connect", async (req, clientSocket, head) => {
    const [connectHost, connectPortRaw] = (req.url ?? "").split(":");
    const connectPort = Number(connectPortRaw || 443);

    if (!connectHost || !connectPort) {
      clientSocket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
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
      protocol: "https",
      connectHost,
      connectPort,
    });

    if (connectResult.action !== "allow") {
      clientSocket.write(
        `HTTP/1.1 ${connectResult.statusCode} Blocked\r\nContent-Type: application/json\r\nConnection: close\r\n\r\n${connectResult.responseBody ?? ""}`,
      );
      clientSocket.destroy();
      return;
    }

    if (!options.tlsInterceptionEnabled) {
      const upstream = net.connect(connectPort, connectHost, () => {
        clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length > 0) {
          upstream.write(head);
        }
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      });

      upstream.on("close", () => {
        void interceptor.finalize(connectResult.requestId, 200, 0);
      });
      upstream.on("error", () => {
        void interceptor.finalize(connectResult.requestId, 502, 0);
        clientSocket.destroy();
      });
      return;
    }

    ensureCA();
    const cert = generateCertForDomain(connectHost);
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

    const secureContext = tls.createSecureContext({
      cert: cert.certPem,
      key: cert.keyPem,
    });

    const mitmHttpServer = http.createServer((innerReq, innerRes) => {
      void handleHttpRequest(innerReq, innerRes, "https", new URL(`https://${connectHost}:${connectPort}`));
    });
    mitmServers.add(mitmHttpServer);

    const tlsSocket = new tls.TLSSocket(clientSocket, {
      isServer: true,
      secureContext,
    });

    tlsSocket.on("error", () => {
      void interceptor.finalize(connectResult.requestId, 502, 0);
      tlsSocket.destroy();
    });

    mitmHttpServer.on("clientError", () => {
      tlsSocket.destroy();
    });
    mitmHttpServer.emit("connection", tlsSocket);
    if (head.length > 0) {
      tlsSocket.unshift(head);
    }
  });

  return {
    async start() {
      if (started) {
        return;
      }

      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
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
      return port;
    },

    getTrustInstructions() {
      return [
        `CA certificate: ${getCAPath()}`,
        ...getTrustInstructions(),
      ];
    },
  };
}

export const proxyServer = createProxyServer();
