import { describe, expect, it } from "vitest";

import { sanitizeTelemetryEvent, validateTelemetryBatch } from "@/lib/services/threat-intelligence";

describe("telemetry ingestion helpers", () => {
  const validEvent = {
    installationId: "install-1",
    eventType: "SECRET_DETECTED",
    decision: "blocked",
    domain: "webhook.site",
  };

  it("single event ingestion works", () => {
    expect(validateTelemetryBatch([validEvent])).toEqual({ valid: true });
  });

  it("batch up to 50 works", () => {
    const events = Array.from({ length: 50 }, (_, index) => ({
      ...validEvent,
      installationId: `install-${index}`,
    }));

    expect(validateTelemetryBatch(events)).toEqual({ valid: true });
  });

  it("batch over 50 is rejected", () => {
    const events = Array.from({ length: 51 }, (_, index) => ({
      ...validEvent,
      installationId: `install-${index}`,
    }));

    expect(validateTelemetryBatch(events)).toEqual({ valid: false, error: "Max 50 per batch" });
  });

  it("missing required fields return a validation error", () => {
    expect(validateTelemetryBatch([{ decision: "blocked" }])).toEqual({
      valid: false,
      error: "Each event needs: installationId, eventType, decision",
    });
  });

  it("metadata sanitization strips credential fields", () => {
    const sanitized = sanitizeTelemetryEvent({
      ...validEvent,
      metadata: {
        requestBody: "secret",
        apiKey: "sk-live-123",
        password: "hunter2",
        safe: "keep-me",
      },
    });

    expect(sanitized.metadata).toEqual({ safe: "keep-me" });
  });
});
