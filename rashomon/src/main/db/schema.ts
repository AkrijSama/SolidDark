import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  processName: text("process_name").notNull(),
  pid: integer("pid"),
  declaredPurpose: text("declared_purpose"),
  firstSeen: integer("first_seen", { mode: "timestamp" }).notNull(),
  lastSeen: integer("last_seen", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["active", "inactive", "killed"] }).notNull().default("active"),
  totalRequests: integer("total_requests").notNull().default(0),
  blockedRequests: integer("blocked_requests").notNull().default(0),
  threatScore: real("threat_score").notNull().default(0),
});

export const requests = sqliteTable("requests", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").references(() => agents.id),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  method: text("method").notNull(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  port: integer("port"),
  requestHeaders: text("request_headers"),
  requestBodySize: integer("request_body_size"),
  requestBodyHash: text("request_body_hash"),
  requestBodyPreview: text("request_body_preview"),
  responseStatus: integer("response_status"),
  responseBodySize: integer("response_body_size"),
  decision: text("decision", { enum: ["allow", "block", "require_approval", "throttle"] }).notNull(),
  decisionReason: text("decision_reason").notNull(),
  policyRuleId: text("policy_rule_id"),
  threatScore: real("threat_score").notNull().default(0),
  secretsDetected: text("secrets_detected"),
  intentAnalysis: text("intent_analysis"),
  receiptHash: text("receipt_hash"),
});

export const domains = sqliteTable("domains", {
  domain: text("domain").primaryKey(),
  status: text("status", { enum: ["allowed", "denied", "pending_approval", "unknown"] }).notNull().default("unknown"),
  addedBy: text("added_by", { enum: ["policy", "user", "auto"] }).notNull(),
  firstSeen: integer("first_seen", { mode: "timestamp" }).notNull(),
  lastSeen: integer("last_seen", { mode: "timestamp" }).notNull(),
  requestCount: integer("request_count").notNull().default(0),
  notes: text("notes"),
});

export const policies = sqliteTable("policies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  yamlContent: text("yaml_content").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull().default(100),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  eventType: text("event_type", {
    enum: [
      "request_allowed",
      "request_blocked",
      "request_throttled",
      "approval_requested",
      "approval_granted",
      "approval_denied",
      "agent_detected",
      "agent_killed",
      "agent_resumed",
      "policy_created",
      "policy_updated",
      "policy_deleted",
      "secret_detected",
      "intent_mismatch",
      "domain_added",
      "config_changed",
      "system_started",
      "system_stopped",
    ],
  }).notNull(),
  agentId: text("agent_id"),
  requestId: text("request_id"),
  details: text("details"),
  receiptHash: text("receipt_hash").notNull(),
  previousHash: text("previous_hash"),
});
