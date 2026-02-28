import { createPolicyEngine, policyEngine, type PolicyEngine } from "./policy-engine";
import type { RateLimitResult } from "../../shared/types";

interface CounterState {
  minute: number[];
  hour: number[];
  concurrent: number;
}

interface UsageSnapshot {
  requestsLastMinute: number;
  requestsLastHour: number;
  concurrent: number;
}

export interface RateLimiter {
  checkLimit: (agentId: string, domain: string) => Promise<RateLimitResult>;
  complete: (agentId: string, domain: string) => void;
  getUsage: (agentId: string) => UsageSnapshot;
  reset: () => void;
}

export function createRateLimiter(engine: PolicyEngine = policyEngine): RateLimiter {
  const agentCounters = new Map<string, CounterState>();
  const domainCounters = new Map<string, CounterState>();

  function now(): number {
    return Date.now();
  }

  function getCounter(map: Map<string, CounterState>, key: string): CounterState {
    const existing = map.get(key);
    if (existing) {
      return existing;
    }

    const counter: CounterState = {
      minute: [],
      hour: [],
      concurrent: 0,
    };
    map.set(key, counter);
    return counter;
  }

  function pruneCounter(counter: CounterState): void {
    const current = now();
    counter.minute = counter.minute.filter((timestamp) => current - timestamp < 60_000);
    counter.hour = counter.hour.filter((timestamp) => current - timestamp < 3_600_000);
  }

  async function ensureLoaded(): Promise<void> {
    if (engine.getPolicies().length === 0) {
      await engine.loadPolicies();
    }
  }

  return {
    async checkLimit(agentId, domain) {
      await ensureLoaded();
      const policy = engine.getMergedPolicy();

      if (!policy.rate_limits.enabled) {
        return {
          allowed: true,
          action: "allow",
          reason: "Rate limiting is disabled.",
        };
      }

      const agentCounter = getCounter(agentCounters, agentId);
      const domainCounter = getCounter(domainCounters, domain);
      pruneCounter(agentCounter);
      pruneCounter(domainCounter);

      if (agentCounter.minute.length >= policy.rate_limits.per_agent.requests_per_minute) {
        return {
          allowed: false,
          action: "throttle",
          reason: `Agent ${agentId} exceeded the per-minute request limit.`,
          exceededKey: `agent:${agentId}:minute`,
          retryAfterSeconds: 60,
        };
      }

      if (agentCounter.hour.length >= policy.rate_limits.per_agent.requests_per_hour) {
        return {
          allowed: false,
          action: "throttle",
          reason: `Agent ${agentId} exceeded the per-hour request limit.`,
          exceededKey: `agent:${agentId}:hour`,
          retryAfterSeconds: 300,
        };
      }

      if (agentCounter.concurrent >= policy.rate_limits.per_agent.max_concurrent) {
        return {
          allowed: false,
          action: "throttle",
          reason: `Agent ${agentId} exceeded the concurrent request limit.`,
          exceededKey: `agent:${agentId}:concurrent`,
          retryAfterSeconds: 1,
        };
      }

      if (domainCounter.minute.length >= policy.rate_limits.per_domain.requests_per_minute) {
        return {
          allowed: false,
          action: "throttle",
          reason: `Domain ${domain} exceeded the per-minute request limit.`,
          exceededKey: `domain:${domain}:minute`,
          retryAfterSeconds: 60,
        };
      }

      if (domainCounter.hour.length >= policy.rate_limits.per_domain.requests_per_hour) {
        return {
          allowed: false,
          action: "throttle",
          reason: `Domain ${domain} exceeded the per-hour request limit.`,
          exceededKey: `domain:${domain}:hour`,
          retryAfterSeconds: 300,
        };
      }

      const current = now();
      agentCounter.minute.push(current);
      agentCounter.hour.push(current);
      agentCounter.concurrent += 1;
      domainCounter.minute.push(current);
      domainCounter.hour.push(current);
      domainCounter.concurrent += 1;

      return {
        allowed: true,
        action: "allow",
        reason: "Request is within configured rate limits.",
      };
    },

    complete(agentId, domain) {
      const agentCounter = agentCounters.get(agentId);
      if (agentCounter) {
        agentCounter.concurrent = Math.max(0, agentCounter.concurrent - 1);
      }

      const domainCounter = domainCounters.get(domain);
      if (domainCounter) {
        domainCounter.concurrent = Math.max(0, domainCounter.concurrent - 1);
      }
    },

    getUsage(agentId) {
      const counter = getCounter(agentCounters, agentId);
      pruneCounter(counter);
      return {
        requestsLastMinute: counter.minute.length,
        requestsLastHour: counter.hour.length,
        concurrent: counter.concurrent,
      };
    },

    reset() {
      agentCounters.clear();
      domainCounters.clear();
    },
  };
}

export const rateLimiter = createRateLimiter(createPolicyEngine());
export const checkLimit = rateLimiter.checkLimit;
export const getUsage = rateLimiter.getUsage;
