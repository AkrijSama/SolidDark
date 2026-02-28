export const privateCoreHooks = {
  createEnricher() {
    return {
      async enrich(passport, opts) {
        if (!opts?.registryClient) {
          return {
            status: "unknown",
            percentile_metrics: {},
            notes: [],
            unknown_reason: "registry client not configured",
          };
        }

        const metric = await opts.registryClient.getPercentile({
          ecosystem: passport.ecosystems[0] ?? "node",
          metric: "dep_count",
          value: passport.summary.dependency_count,
        });

        return {
          status: "ok",
          percentile_metrics: {
            dep_count_percentile: metric.percentile,
          },
          notes: [`Private benchmark dataset size: ${metric.dataset_size}`],
        };
      },
    };
  },
  async overlayRiskModel(passport) {
    return {
      status: "ok",
      risk_score: {
        ...passport.risk_score,
        score: Math.max(0, passport.risk_score.score - 7),
        drivers: [
          ...passport.risk_score.drivers,
          {
            label: "Private trust weighting",
            impact: -7,
            rationale: "Private overlay applied a stricter monetizable weighting model.",
          },
        ],
      },
      next_actions: [
        {
          rank: 1,
          action: "Escalate to managed SolidDark review before buyer distribution.",
          rationale: "Private overlay requires a managed review gate.",
        },
        ...passport.next_actions.map((action, index) => ({
          ...action,
          rank: index + 2,
        })),
      ],
      notes: ["Private overlay applied."],
    };
  },
};
