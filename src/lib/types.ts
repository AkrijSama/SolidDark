import type {
  AIProvider,
  ComplianceFramework,
  HeirAccessLevel,
  LedgerStatus,
  PolicyStatus,
  PolicyType,
  ProjectStatus,
  ServiceType,
  SubscriptionTier,
} from "@prisma/client";

export type AppUser = {
  id: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  jurisdictions: string[];
  subscriptionTier: SubscriptionTier;
  aiProvider: AIProvider;
  localLlmUrl: string | null;
};

export type ApiResult<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string };

export type SoulChatInput = {
  conversationId?: string;
  message: string;
  model?: string;
};

export type SoulMessageDTO = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  model?: string | null;
  jurisdictions: string[];
  createdAt: string;
};

export type VaultPayload = {
  username?: string;
  password?: string;
  apiKey?: string;
  notes?: string;
};

export type VaultEntrySummary = {
  id: string;
  serviceName: string;
  serviceType: ServiceType;
  lastRotated: string | null;
  expiresAt: string | null;
  accessibleBy: string[];
  createdAt: string;
  updatedAt: string;
};

export type VaultEntryDetail = VaultEntrySummary & {
  data: VaultPayload;
};

export type HeirDTO = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  relationship: string;
  accessLevel: HeirAccessLevel;
  notificationOrder: number;
  isVerified: boolean;
  instructions: string | null;
};

export type DeadmanDTO = {
  id: string;
  isEnabled: boolean;
  checkIntervalHours: number;
  lastCheckIn: string;
  gracePeriodHours: number;
  escalationStage: number;
  alertEmail: boolean;
  alertSms: boolean;
  alertPhone: string | null;
};

export type GeneratedDocumentDTO = {
  id: string;
  documentType: string;
  title: string;
  content: string;
  jurisdiction: string;
  createdAt: string;
};

export type ComplianceSummary = {
  id: string;
  projectName: string;
  repositoryUrl: string;
  frameworks: ComplianceFramework[];
  overallScore: number;
  status: string;
};

export type ComplianceIssue = {
  title: string;
  severity: "critical" | "warning" | "info";
  explanation: string;
  recommendation?: string;
};

export type ComplianceScanDTO = ComplianceSummary & {
  criticalIssuesCount: number;
  warningsCount: number;
  passedChecksCount: number;
  summary: string;
  issues: ComplianceIssue[];
  passedChecks: string[];
  auditTrail: Array<{ title: string; detail: string }>;
  createdAt: string;
};

export type InsuranceSummary = {
  id: string;
  policyNumber: string;
  policyType: PolicyType;
  riskScore: number;
  status: PolicyStatus;
};

export type InsuranceFactor = {
  label: string;
  severity: "low" | "medium" | "high";
  explanation: string;
};

export type InsurancePolicyDTO = InsuranceSummary & {
  applicationUrl: string | null;
  premiumMonthly: string | null;
  premiumAnnual: string | null;
  coverageLimit: string | null;
  deductible: string | null;
  summary: string;
  riskFactors: InsuranceFactor[];
  createdAt: string;
  updatedAt: string;
};

export type WorkEntrySummary = {
  id: string;
  projectName: string;
  description: string;
  techStack: string[];
  status: LedgerStatus;
  verifiedAt: string | null;
};

export type WorkEntryDTO = WorkEntrySummary & {
  deploymentUrl: string | null;
  repositoryUrl: string | null;
  platform: string | null;
  evidenceHash: string;
  signature: string;
  publicKey: string;
  metrics: Record<string, unknown> | null;
  verificationMethod: string | null;
  createdAt: string;
  updatedAt: string;
  signatureValid?: boolean;
};

export type CollectiveProjectSummary = {
  id: string;
  name: string;
  clientName: string | null;
  status: ProjectStatus;
};

export type CollectiveMemberDTO = {
  id: string;
  userId: string;
  collectiveId: string;
  fullName: string | null;
  email: string;
  role: "ADMIN" | "LEAD" | "MEMBER";
  revenueShare: string | null;
  skills: string[];
  joinedAt: string;
};

export type CollectiveProjectDTO = CollectiveProjectSummary & {
  collectiveId: string;
  contractValue: string | null;
  startDate: string | null;
  endDate: string | null;
  revenueWaterfall: Array<{ label: string; percentage: number }>;
  createdAt: string;
  updatedAt: string;
};

export type CollectiveDTO = {
  id: string;
  name: string;
  description: string | null;
  entityType: string | null;
  entityState: string | null;
  status: string;
  members: CollectiveMemberDTO[];
  projects: CollectiveProjectDTO[];
};
