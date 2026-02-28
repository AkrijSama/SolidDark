import { z } from "zod";

export const SPEC_VERSION = "0.1.0";

export const statusSchema = z.enum(["ok", "unknown", "error"]);
export type Status = z.infer<typeof statusSchema>;

export const disclaimerSchema = z.string().min(1);
export const standardDisclaimers = [
  "Not legal advice. For information purposes only.",
  "No guarantee of security. This report may be incomplete.",
] as const;

export const unknownRecordSchema = z.object({
  code: z.string().min(1),
  source: z.string().min(1),
  status: z.literal("unknown"),
  message: z.string().min(1),
});
export type UnknownRecord = z.infer<typeof unknownRecordSchema>;

export const errorRecordSchema = z.object({
  code: z.string().min(1),
  source: z.string().min(1),
  status: z.literal("error"),
  message: z.string().min(1),
});
export type ErrorRecord = z.infer<typeof errorRecordSchema>;

export const assumptionSchema = z.object({
  source: z.string().min(1),
  message: z.string().min(1),
});
export type Assumption = z.infer<typeof assumptionSchema>;

export const contradictionSchema = z.object({
  source: z.string().min(1),
  message: z.string().min(1),
});
export type Contradiction = z.infer<typeof contradictionSchema>;

export const ecosystemSchema = z.enum(["node", "python"]);
export type Ecosystem = z.infer<typeof ecosystemSchema>;

export const repoSignalSchema = z.object({
  status: statusSchema,
  commit: z.string().nullable(),
  dirty: z.boolean().nullable(),
  branch: z.string().nullable(),
  remotes: z.array(z.string()),
  unknown_reason: z.string().optional(),
  error_reason: z.string().optional(),
});

export const dependencySchema = z.object({
  name: z.string().min(1),
  version: z.string().nullable(),
  ecosystem: ecosystemSchema,
  source: z.string().min(1),
  license_hint: z.string().nullable().optional(),
});
export type Dependency = z.infer<typeof dependencySchema>;

export const secretFindingSchema = z.object({
  detector: z.string().min(1),
  file: z.string().nullable(),
  line: z.number().int().positive().nullable(),
  preview: z.string().min(1),
});

export const scanStepSchema = z.object({
  step: z.string().min(1),
  status: statusSchema,
  unknown_reason: z.string().optional(),
  error_reason: z.string().optional(),
  details: z.array(z.string()).default([]),
});

export const riskDriverSchema = z.object({
  label: z.string().min(1),
  impact: z.number().int(),
  rationale: z.string().min(1),
});
export type RiskDriver = z.infer<typeof riskDriverSchema>;

export const riskScoreSchema = z.object({
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  status: statusSchema,
  unknown_penalty: z.number().min(0),
  drivers: z.array(riskDriverSchema),
});

export const summarySectionSchema = z.object({
  status: statusSchema,
  dependency_count: z.number().int().min(0),
  vuln_count: z.number().int().min(0).nullable(),
  secret_findings_count: z.number().int().min(0),
  unknowns_count: z.number().int().min(0),
});

export const nextActionSchema = z.object({
  rank: z.number().int().positive(),
  action: z.string().min(1),
  rationale: z.string().min(1),
});
export type NextAction = z.infer<typeof nextActionSchema>;

export const enrichmentSchema = z.object({
  status: statusSchema,
  percentile_metrics: z.record(z.string(), z.number().min(0).max(100)).default({}),
  notes: z.array(z.string()).default([]),
  unknown_reason: z.string().optional(),
  error_reason: z.string().optional(),
});

export const riskPassportSchema = z.object({
  spec_version: z.literal(SPEC_VERSION),
  generated_at: z.string().datetime(),
  tool_version: z.string().min(1),
  target_path: z.string().min(1),
  disclaimers: z.array(disclaimerSchema).min(2),
  repo: repoSignalSchema,
  ecosystems: z.array(ecosystemSchema),
  project_types: z.array(z.string()),
  dependencies: z.array(dependencySchema),
  vulnerabilities: z.object({
    status: statusSchema,
    source: z.string().min(1),
    findings: z.array(
      z.object({
        ecosystem: ecosystemSchema,
        package: z.string().min(1),
        severity: z.string().nullable(),
        advisory_id: z.string().nullable(),
        summary: z.string().min(1),
      }),
    ),
    unknown_reason: z.string().optional(),
    error_reason: z.string().optional(),
  }),
  secrets: z.object({
    status: statusSchema,
    findings: z.array(secretFindingSchema),
    details: z.array(z.string()).default([]),
    unknown_reason: z.string().optional(),
    error_reason: z.string().optional(),
  }),
  licenses: z.object({
    status: statusSchema,
    findings: z.array(
      z.object({
        name: z.string().min(1),
        ecosystem: ecosystemSchema,
        license_hint: z.string().nullable(),
      }),
    ),
    unknown_reason: z.string().optional(),
    error_reason: z.string().optional(),
  }),
  tests_and_ci: z.object({
    status: statusSchema,
    test_files_present: z.boolean(),
    ci_files_present: z.boolean(),
    details: z.array(z.string()).default([]),
    unknown_reason: z.string().optional(),
    error_reason: z.string().optional(),
  }),
  summary: summarySectionSchema,
  risk_score: riskScoreSchema,
  enrichment: enrichmentSchema,
  assumptions: z.array(assumptionSchema),
  contradictions: z.array(contradictionSchema),
  unknowns: z.array(unknownRecordSchema),
  errors: z.array(errorRecordSchema),
  next_actions: z.array(nextActionSchema),
});

export type RiskPassport = z.infer<typeof riskPassportSchema>;

export const registryPublishPayloadSchema = z.object({
  passport_hash: z.string().regex(/^[a-f0-9]{64}$/),
  tool_version: z.string().min(1),
  generated_at: z.string().datetime(),
  ecosystems: z.array(ecosystemSchema),
  dependency_count: z.number().int().min(0),
  vuln_count: z.number().int().min(0).nullable(),
  secret_findings_count: z.number().int().min(0),
  unknowns_count: z.number().int().min(0),
  project_label: z.string().min(1).max(120).optional(),
});

export type RegistryPublishPayload = z.infer<typeof registryPublishPayloadSchema>;

export const verificationTierSchema = z.enum(["baseline", "reviewed", "verified"]);
export type VerificationTier = z.infer<typeof verificationTierSchema>;

export const registryEnvelopeSchema = z.object({
  verification_id: z.string().min(1),
  passport_hash: z.string().regex(/^[a-f0-9]{64}$/),
  issued_at: z.string().datetime(),
  issuer: z.literal("SolidDark Registry"),
  registry_pubkey_id: z.string().min(1),
  verification_tier: verificationTierSchema,
  signature: z.string().min(1),
});

export type RegistryEnvelope = z.infer<typeof registryEnvelopeSchema>;

export const verifyStatusSchema = z.enum(["valid", "revoked", "unknown"]);

export const registryVerifyResponseSchema = z.object({
  status: verifyStatusSchema,
  verification_id: z.string().min(1),
  issued_at: z.string().datetime(),
  passport_hash: z.string().regex(/^[a-f0-9]{64}$/),
  registry_pubkey_id: z.string().min(1),
  verification_tier: verificationTierSchema,
  revoked_at: z.string().datetime().nullable(),
  signature_valid: z.boolean(),
});

export type RegistryVerifyResponse = z.infer<typeof registryVerifyResponseSchema>;

export const benchmarkIngestSchema = z.object({
  ecosystem: ecosystemSchema,
  metrics: z.record(z.string(), z.number().min(0)),
  source: z.string().min(1),
  generated_at: z.string().datetime(),
});

export const scanManifestSchema = z.object({
  spec_version: z.literal(SPEC_VERSION),
  generated_at: z.string().datetime(),
  tool_version: z.string().min(1),
  target_path: z.string().min(1),
  steps: z.array(scanStepSchema),
  unknowns: z.array(unknownRecordSchema),
  errors: z.array(errorRecordSchema),
  disclaimers: z.array(disclaimerSchema).min(2),
});

export type ScanManifest = z.infer<typeof scanManifestSchema>;

export const riskPassportJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://spec.soliddark.dev/risk-passport.schema.json",
  title: "SolidDark Risk Passport",
  type: "object",
  required: [
    "spec_version",
    "generated_at",
    "tool_version",
    "target_path",
    "disclaimers",
    "repo",
    "ecosystems",
    "dependencies",
    "vulnerabilities",
    "secrets",
    "licenses",
    "tests_and_ci",
    "summary",
    "risk_score",
    "enrichment",
    "assumptions",
    "contradictions",
    "unknowns",
    "errors",
    "next_actions",
  ],
  properties: {
    spec_version: { const: SPEC_VERSION },
    generated_at: { type: "string", format: "date-time" },
    tool_version: { type: "string" },
    target_path: { type: "string" },
    disclaimers: { type: "array", items: { type: "string" } },
    ecosystems: { type: "array", items: { enum: ["node", "python"] } },
    dependencies: {
      type: "array",
      items: {
        type: "object",
        required: ["name", "version", "ecosystem", "source"],
        properties: {
          name: { type: "string" },
          version: { type: ["string", "null"] },
          ecosystem: { enum: ["node", "python"] },
          source: { type: "string" },
          license_hint: { type: ["string", "null"] },
        },
      },
    },
    unknowns: {
      type: "array",
      items: {
        type: "object",
        required: ["code", "source", "status", "message"],
        properties: {
          code: { type: "string" },
          source: { type: "string" },
          status: { const: "unknown" },
          message: { type: "string" },
        },
      },
    },
  },
} as const;

export const scanManifestJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://spec.soliddark.dev/scan-manifest.schema.json",
  title: "SolidDark Scan Manifest",
  type: "object",
  required: ["spec_version", "generated_at", "tool_version", "target_path", "steps", "unknowns", "errors", "disclaimers"],
} as const;
