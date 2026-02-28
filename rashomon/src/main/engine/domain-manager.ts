import { desc, eq } from "drizzle-orm";

import { createDatabaseConnection, database, type DatabaseServices } from "../db/connection";
import { domains } from "../db/schema";
import { createPolicyEngine, policyEngine, type PolicyEngine } from "./policy-engine";
import type { DomainCheckResult, DomainRecord, DomainStatus } from "../../shared/types";

function matchesGlob(pattern: string, value: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}$`, "i").test(value);
}

export interface DomainManager {
  checkDomain: (domain: string) => Promise<DomainCheckResult>;
  recordDomainContact: (domain: string, status?: DomainStatus) => Promise<DomainRecord>;
  approveDomain: (domain: string) => Promise<DomainRecord>;
  denyDomain: (domain: string) => Promise<DomainRecord>;
  getUnknownDomains: () => Promise<DomainRecord[]>;
  getDomainStats: () => Promise<DomainRecord[]>;
}

export function createDomainManager(
  services: DatabaseServices = database,
  engine: PolicyEngine = policyEngine,
): DomainManager {
  async function getDomainRule(domain: string): Promise<{ status: DomainStatus; matchedRule: string | null }> {
    const policy = engine.getMergedPolicy();

    for (const pattern of policy.domains.denied) {
      if (matchesGlob(pattern, domain)) {
        return {
          status: "denied",
          matchedRule: pattern,
        };
      }
    }

    for (const pattern of policy.domains.allowed) {
      if (matchesGlob(pattern, domain)) {
        return {
          status: "allowed",
          matchedRule: pattern,
        };
      }
    }

    for (const pattern of policy.domains.require_approval) {
      if (matchesGlob(pattern, domain)) {
        return {
          status: "pending_approval",
          matchedRule: pattern,
        };
      }
    }

    return {
      status: "unknown",
      matchedRule: null,
    };
  }

  return {
    async checkDomain(domain) {
      if (engine.getPolicies().length === 0) {
        await engine.loadPolicies();
      }

      const existing = services.db.select().from(domains).where(eq(domains.domain, domain)).get();
      const rule = await getDomainRule(domain);

      if (existing) {
        return {
          status: existing.status,
          matchedRule: existing.addedBy === "policy" ? rule.matchedRule : `${existing.addedBy}:${existing.domain}`,
          isFirstContact: false,
        };
      }

      return {
        status: rule.status,
        matchedRule: rule.matchedRule,
        isFirstContact: true,
      };
    },

    async recordDomainContact(domain, status) {
      const now = new Date();
      const existing = services.db.select().from(domains).where(eq(domains.domain, domain)).get();
      const resolvedStatus = status ?? (await getDomainRule(domain)).status;

      if (existing) {
        services.db
          .update(domains)
          .set({
            lastSeen: now,
            requestCount: existing.requestCount + 1,
            status: existing.addedBy === "user" ? existing.status : resolvedStatus,
          })
          .where(eq(domains.domain, domain))
          .run();
      } else {
        services.db.insert(domains).values({
          domain,
          status: resolvedStatus,
          addedBy: resolvedStatus === "unknown" ? "auto" : "policy",
          firstSeen: now,
          lastSeen: now,
          requestCount: 1,
          notes: null,
        }).run();
      }

      return services.db.select().from(domains).where(eq(domains.domain, domain)).get() as DomainRecord;
    },

    async approveDomain(domain) {
      const now = new Date();
      const existing = services.db.select().from(domains).where(eq(domains.domain, domain)).get();

      if (existing) {
        services.db.update(domains).set({
          status: "allowed",
          addedBy: "user",
          lastSeen: now,
        }).where(eq(domains.domain, domain)).run();
      } else {
        services.db.insert(domains).values({
          domain,
          status: "allowed",
          addedBy: "user",
          firstSeen: now,
          lastSeen: now,
          requestCount: 0,
          notes: "Approved by user",
        }).run();
      }

      return services.db.select().from(domains).where(eq(domains.domain, domain)).get() as DomainRecord;
    },

    async denyDomain(domain) {
      const now = new Date();
      const existing = services.db.select().from(domains).where(eq(domains.domain, domain)).get();

      if (existing) {
        services.db.update(domains).set({
          status: "denied",
          addedBy: "user",
          lastSeen: now,
        }).where(eq(domains.domain, domain)).run();
      } else {
        services.db.insert(domains).values({
          domain,
          status: "denied",
          addedBy: "user",
          firstSeen: now,
          lastSeen: now,
          requestCount: 0,
          notes: "Denied by user",
        }).run();
      }

      return services.db.select().from(domains).where(eq(domains.domain, domain)).get() as DomainRecord;
    },

    async getUnknownDomains() {
      return services.db
        .select()
        .from(domains)
        .where(eq(domains.status, "unknown"))
        .orderBy(desc(domains.lastSeen))
        .all();
    },

    async getDomainStats() {
      return services.db.select().from(domains).orderBy(desc(domains.lastSeen)).all();
    },
  };
}

export const domainManager = createDomainManager(createDatabaseConnection(), createPolicyEngine());
export const checkDomain = domainManager.checkDomain;
export const approveDomain = domainManager.approveDomain;
export const denyDomain = domainManager.denyDomain;
export const getUnknownDomains = domainManager.getUnknownDomains;
export const getDomainStats = domainManager.getDomainStats;
