import {
  benchmarkIngestSchema,
  registryEnvelopeSchema,
  registryPublishPayloadSchema,
  registryVerifyResponseSchema,
} from "@soliddark/spec";

export type RegistryClientOptions = {
  baseUrl: string;
  apiKey?: string | null;
};

export class RegistryClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor(options: RegistryClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.apiKey = options.apiKey ?? null;
  }

  private async request(path: string, init?: RequestInit) {
    const headers = new Headers(init?.headers ?? {});
    headers.set("Content-Type", "application/json");
    if (this.apiKey) {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const text = await response.text();
    const payload = text ? (JSON.parse(text) as unknown) : null;

    if (!response.ok) {
      throw new Error(
        typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : `Registry request failed with status ${response.status}.`,
      );
    }

    return payload;
  }

  async issue(input: unknown) {
    const payload = registryPublishPayloadSchema.parse(input);
    return registryEnvelopeSchema.parse(await this.request("/v1/issue", {
      method: "POST",
      body: JSON.stringify(payload),
    }));
  }

  async verify(verificationId: string) {
    return registryVerifyResponseSchema.parse(await this.request(`/v1/verify/${verificationId}`));
  }

  async revoke(verificationId: string) {
    return registryVerifyResponseSchema.parse(await this.request(`/v1/revoke/${verificationId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }));
  }

  async ingestBenchmark(input: unknown) {
    const payload = benchmarkIngestSchema.parse(input);
    return await this.request("/v1/bench/ingest", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getPercentile(input: { ecosystem: "node" | "python"; metric: string; value: number }) {
    const query = new URLSearchParams({
      ecosystem: input.ecosystem,
      metric: input.metric,
      value: String(input.value),
    });

    const payload = (await this.request(`/v1/bench/percentiles?${query.toString()}`)) as {
      percentile: number;
      dataset_size: number;
    };

    return payload;
  }
}
