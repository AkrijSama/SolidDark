import type { RiskPassport } from "@soliddark/spec";

export type PercentileClient = {
  getPercentile(input: { ecosystem: "node" | "python"; metric: string; value: number }): Promise<{
    percentile: number;
    dataset_size: number;
  }>;
};

export interface Enricher {
  enrich(passport: RiskPassport, opts?: { registryClient?: PercentileClient | null }): Promise<{
    status: "ok" | "unknown" | "error";
    percentile_metrics: Record<string, number>;
    notes: string[];
    unknown_reason?: string;
    error_reason?: string;
  }>;
}

export class NoopEnricher implements Enricher {
  async enrich(): ReturnType<Enricher["enrich"]> {
    return {
      status: "unknown" as const,
      percentile_metrics: {} as Record<string, number>,
      notes: [],
      unknown_reason: "registry enrichment not requested",
    };
  }
}

export class RegistryPercentileEnricher implements Enricher {
  async enrich(
    passport: RiskPassport,
    opts?: { registryClient?: PercentileClient | null },
  ): ReturnType<Enricher["enrich"]> {
    if (!opts?.registryClient) {
      return {
        status: "unknown" as const,
        percentile_metrics: {} as Record<string, number>,
        notes: [],
        unknown_reason: "registry client not configured",
      };
    }

    try {
      const metric = await opts.registryClient.getPercentile({
        ecosystem: passport.ecosystems[0] ?? "node",
        metric: "dep_count",
        value: passport.summary.dependency_count,
      });

      return {
        status: "ok" as const,
        percentile_metrics: {
          dep_count_percentile: metric.percentile,
        },
        notes: [`Benchmark dataset size: ${metric.dataset_size}`],
      };
    } catch (error) {
      return {
        status: "unknown" as const,
        percentile_metrics: {} as Record<string, number>,
        notes: [],
        unknown_reason: error instanceof Error ? error.message : "registry percentile lookup failed",
      };
    }
  }
}
