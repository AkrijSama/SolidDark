export type AgentStatus = "active" | "inactive" | "killed";
export type DomainStatus = "allowed" | "denied" | "pending_approval" | "unknown";
export type DecisionAction = "allow" | "block" | "require_approval" | "throttle";
export type AuditEventType =
  | "request_allowed"
  | "request_blocked"
  | "request_throttled"
  | "approval_requested"
  | "approval_granted"
  | "approval_denied"
  | "agent_detected"
  | "agent_killed"
  | "agent_resumed"
  | "policy_created"
  | "policy_updated"
  | "policy_deleted"
  | "secret_detected"
  | "intent_mismatch"
  | "domain_added"
  | "config_changed"
  | "system_started"
  | "system_stopped";
export type DataClassification = "public" | "internal" | "secret" | "unknown";
export type PolicyDecisionSource = "policy" | "domain" | "rate_limit" | "intent" | "system";
export type IntentProvider = "disabled" | "anthropic" | "ollama";

export interface AgentRecord {
  id: string;
  name: string;
  processName: string;
  pid: number | null;
  declaredPurpose: string | null;
  firstSeen: Date;
  lastSeen: Date;
  status: AgentStatus;
  totalRequests: number;
  blockedRequests: number;
  threatScore: number;
}

export interface DetectedAgent {
  id: string;
  name: string;
  processName: string;
  pid: number;
  declaredPurpose: string | null;
  status: AgentStatus;
  matchedProfile: string | null;
  allowedDomainsExtra: string[];
  maxBodyBytes: number;
  detectedAt: number;
}

export interface SecretMatch {
  type: string;
  detector: "pattern" | "entropy";
  redactedMatch: string;
  location: "headers" | "body";
  start: number;
  end: number;
  confidence: number;
  encoding: "plain" | "base64" | "urlencoded";
}

export interface PolicyViolation {
  ruleId: string;
  category: "domain" | "secret" | "rate_limit" | "agent" | "payload" | "intent";
  message: string;
  severity: "low" | "medium" | "high" | "critical";
}

export interface AnomalyFlag {
  code: string;
  message: string;
  severity: "low" | "medium" | "high";
}

export interface IntentResult {
  provider: IntentProvider;
  model: string;
  mismatchScore: number;
  reasoning: string;
  analyzedAt: number;
}

export interface RequestManifest {
  who: {
    agentId: string;
    agentName: string;
    processName: string;
    pid: number;
  };
  what: {
    method: string;
    url: string;
    domain: string;
    bodySize: number;
    bodyHash: string;
    contentType: string;
    dataClassification: DataClassification;
    bodyPreview?: string;
  };
  where: {
    domain: string;
    port: number;
    domainStatus: DomainStatus;
    isFirstContact: boolean;
  };
  why: {
    secretsDetected: SecretMatch[];
    policyViolations: PolicyViolation[];
    anomalies: AnomalyFlag[];
    intentAnalysis?: IntentResult;
  };
  risk: {
    threatScore: number;
    factors: string[];
  };
  decision: {
    action: DecisionAction;
    reason: string;
    policyRuleId?: string;
    timestamp: number;
    receiptHash: string;
  };
}

export interface PolicyDecision {
  action: DecisionAction;
  reason: string;
  policyRuleId?: string;
  source: PolicyDecisionSource;
  violations: PolicyViolation[];
  anomalies: AnomalyFlag[];
}

export interface RateLimitResult {
  allowed: boolean;
  action: DecisionAction;
  reason: string;
  exceededKey?: string;
  retryAfterSeconds?: number;
}

export interface RequestRecord {
  id: string;
  agentId: string | null;
  timestamp: Date;
  method: string;
  url: string;
  domain: string;
  port: number | null;
  requestHeaders: string | null;
  requestBodySize: number | null;
  requestBodyHash: string | null;
  requestBodyPreview: string | null;
  responseStatus: number | null;
  responseBodySize: number | null;
  decision: DecisionAction;
  decisionReason: string;
  policyRuleId: string | null;
  threatScore: number;
  secretsDetected: string | null;
  intentAnalysis: string | null;
  receiptHash: string | null;
}

export interface DomainRecord {
  domain: string;
  status: DomainStatus;
  addedBy: "policy" | "user" | "auto";
  firstSeen: Date;
  lastSeen: Date;
  requestCount: number;
  notes: string | null;
}

export interface PolicyRecord {
  id: string;
  name: string;
  description: string | null;
  yamlContent: string;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  agentId: string | null;
  requestId: string | null;
  details: string | null;
  receiptHash: string;
  previousHash: string | null;
}

export interface DecisionReceipt {
  id: string;
  timestamp: number;
  requestId: string;
  requestHash: string;
  decision: DecisionAction;
  reason: string;
  policyRuleId?: string;
  chainHash: string;
}

export interface AgentProfile {
  name: string;
  processPatterns: string[];
  allowedDomainsExtra: string[];
  maxBodyBytes: number;
}

export interface SecretPatternRule {
  name: string;
  pattern: string;
}

export interface RashomonPolicy {
  version: string;
  name: string;
  priority?: number;
  global: {
    default_action: DecisionAction;
    log_all_requests: boolean;
    intent_analysis: boolean;
    max_request_body_bytes: number;
    new_domain_action: Exclude<DecisionAction, "throttle">;
  };
  domains: {
    allowed: string[];
    denied: string[];
    require_approval: string[];
  };
  secrets: {
    enabled: boolean;
    action: "block" | "alert" | "log";
    patterns: SecretPatternRule[];
    entropy_detection: {
      enabled: boolean;
      min_length: number;
      min_entropy: number;
      action: "block" | "alert" | "log";
    };
  };
  sensitive_files: {
    enabled: boolean;
    action: "alert" | "block";
    paths: string[];
  };
  rate_limits: {
    enabled: boolean;
    per_agent: {
      requests_per_minute: number;
      requests_per_hour: number;
      max_concurrent: number;
    };
    per_domain: {
      requests_per_minute: number;
      requests_per_hour: number;
    };
  };
  agents: {
    profiles: AgentProfile[];
    unknown_agent: {
      action: Exclude<DecisionAction, "throttle">;
      max_body_bytes: number;
    };
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TrafficEvent {
  requestId: string;
  timestamp: number;
  agentName: string;
  agentId: string;
  method: string;
  domain: string;
  url: string;
  decision: DecisionAction;
  reason: string;
  threatScore: number;
  secretsDetected: string[];
}

export interface DashboardStats {
  requestsToday: number;
  blockedToday: number;
  activeAgents: number;
  threatLevel: number;
}

export interface DomainCheckResult {
  status: DomainStatus;
  matchedRule: string | null;
  isFirstContact: boolean;
}

export interface RequestContext {
  agent: AgentRecord;
  method: string;
  url: string;
  domain: string;
  port: number;
  headers: Record<string, string>;
  body: string;
}

export interface SettingsState {
  proxyPort: number;
  dashboardPort: number;
  autoStart: boolean;
  notificationsEnabled: boolean;
  tlsInterceptionEnabled: boolean;
  intentProvider: IntentProvider;
  anthropicApiKey: string;
  ollamaBaseUrl: string;
  intentModel: string;
  intentThreshold: number;
}

export interface IpcResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface InterceptionInput {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  remoteAddress?: string;
  protocol: "http" | "https";
  connectHost?: string;
  connectPort?: number;
}

export interface InterceptionResult {
  requestId: string;
  manifest: RequestManifest;
  agent: AgentRecord;
  action: DecisionAction;
  statusCode: number;
  responseHeaders: Record<string, string>;
  responseBody?: string;
  targetUrl?: string;
}
