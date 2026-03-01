import crypto from "node:crypto";
import os from "node:os";

interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
  batchSize: number;
  flushIntervalMs: number;
}

interface TelemetryEvent {
  installationId: string;
  eventType: string;
  domain?: string;
  agentName?: string;
  secretType?: string;
  decision: string;
  policyRuleId?: string;
  threatScore?: number;
  requestMethod?: string;
  bodySize?: number;
  entropyScore?: number;
  metadata?: Record<string, unknown>;
}

const SENSITIVE_METADATA_KEYS = new Set([
  "requestBody",
  "requestHeaders",
  "credentials",
  "apiKey",
  "password",
  "token",
  "fileContents",
  "secretValue",
]);

function getInstallationId(): string {
  const raw = `${os.hostname()}-${os.userInfo().username}-${os.platform()}-${os.arch()}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function createDefaultConfig(): TelemetryConfig {
  return {
    enabled: true,
    endpoint: process.env.SOLIDDARK_TELEMETRY_URL || "https://soliddark.com/api/telemetry/ingest",
    batchSize: 25,
    flushIntervalMs: 60_000,
  };
}

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const sanitized = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !SENSITIVE_METADATA_KEYS.has(key)),
  );

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

class TelemetryReporter {
  private config: TelemetryConfig;
  private installationId: string;
  private buffer: TelemetryEvent[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(config?: Partial<TelemetryConfig>) {
    this.config = { ...createDefaultConfig(), ...config };
    this.installationId = getInstallationId();
    if (this.config.enabled) {
      this.startTimer();
    }
  }

  private startTimer(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs);
  }

  configure(nextConfig: Partial<TelemetryConfig>): void {
    const previousInterval = this.config.flushIntervalMs;
    this.config = { ...this.config, ...nextConfig };

    if (this.flushTimer && previousInterval !== this.config.flushIntervalMs) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.config.enabled && !this.flushTimer) {
      this.startTimer();
    }
  }

  report(event: Omit<TelemetryEvent, "installationId">): void {
    if (!this.config.enabled) {
      return;
    }

    this.buffer.push({
      ...event,
      installationId: this.installationId,
      metadata: sanitizeMetadata(event.metadata),
    });

    if (this.buffer.length >= this.config.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.config.enabled || this.buffer.length === 0) {
      return;
    }

    const batch = this.buffer.splice(0, this.config.batchSize);

    try {
      const response = await fetch(this.config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: batch }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        if (this.buffer.length < 500) {
          this.buffer.unshift(...batch);
        }
        console.warn(`[Telemetry] Failed to flush events: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (this.buffer.length < 500) {
        this.buffer.unshift(...batch);
      }
      console.warn("[Telemetry] Network flush failed.", error instanceof Error ? error.message : error);
    }
  }

  disable(): void {
    this.config.enabled = false;
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = [];
  }

  enable(): void {
    this.config.enabled = true;
    if (!this.flushTimer) {
      this.startTimer();
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

export const telemetry = new TelemetryReporter();
export type { TelemetryConfig, TelemetryEvent };
