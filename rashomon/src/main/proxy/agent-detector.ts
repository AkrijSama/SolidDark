import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { v4 as uuidv4 } from "uuid";

import { createPolicyEngine, policyEngine, type PolicyEngine } from "../engine/policy-engine";
import type { DetectedAgent } from "../../shared/types";

const execFileAsync = promisify(execFile);

function normalizeProcessList(output: string): Array<{ pid: number; processName: string; command: string }> {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/\s+/, 3);
      return {
        pid: Number(parts[0]),
        processName: parts[1] ?? "",
        command: parts[2] ?? "",
      };
    })
    .filter((item) => Number.isFinite(item.pid));
}

function knownFallbackProfiles(): Array<{ name: string; processPatterns: string[] }> {
  return [
    { name: "cursor", processPatterns: ["cursor"] },
    { name: "claude-code", processPatterns: ["claude", "claude-code"] },
    { name: "aider", processPatterns: ["aider"] },
    { name: "github-copilot", processPatterns: ["copilot"] },
    { name: "codex", processPatterns: ["codex"] },
  ];
}

export interface ProcessWatcher {
  stop: () => void;
}

export interface AgentDetector {
  detectAgents: () => Promise<DetectedAgent[]>;
  getAgentForPid: (pid: number) => Promise<DetectedAgent | null>;
  watchProcesses: (callback: (agents: DetectedAgent[]) => void) => ProcessWatcher;
}

export function createAgentDetector(engine: PolicyEngine = policyEngine): AgentDetector {
  let cachedAgents: DetectedAgent[] = [];

  async function listProcesses(): Promise<Array<{ pid: number; processName: string; command: string }>> {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("tasklist", ["/fo", "csv", "/v"]);
      return stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("\""))
        .map((line) => line.split("\",\"").map((part) => part.replace(/^"|"$/g, "")))
        .map((parts) => ({
          processName: parts[0] ?? "",
          pid: Number(parts[1]),
          command: parts.join(" "),
        }))
        .filter((item) => Number.isFinite(item.pid));
    }

    const { stdout } = await execFileAsync("ps", ["-eo", "pid=,comm=,args="]);
    return normalizeProcessList(stdout);
  }

  return {
    async detectAgents() {
      if (engine.getPolicies().length === 0) {
        await engine.loadPolicies();
      }

      const policyProfiles = engine.getMergedPolicy().agents.profiles.map((profile) => ({
        name: profile.name,
        processPatterns: profile.processPatterns,
        allowedDomainsExtra: profile.allowedDomainsExtra,
        maxBodyBytes: profile.maxBodyBytes,
      }));

      const candidates = [...policyProfiles, ...knownFallbackProfiles()];
      const processes = await listProcesses();

      cachedAgents = processes.flatMap((processInfo) => {
        const matched = candidates.find((candidate) =>
          candidate.processPatterns.some((pattern) =>
            new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(
              `${processInfo.processName} ${processInfo.command}`,
            ),
          ),
        );

        if (!matched) {
          return [];
        }

        return [
          {
            id: uuidv4(),
            name: matched.name,
            processName: processInfo.processName,
            pid: processInfo.pid,
            declaredPurpose: null,
            status: "active",
            matchedProfile: matched.name,
            allowedDomainsExtra:
              "allowedDomainsExtra" in matched ? (matched.allowedDomainsExtra as string[]) : [],
            maxBodyBytes: "maxBodyBytes" in matched ? (matched.maxBodyBytes as number) : 1024 * 1024,
            detectedAt: Date.now(),
          } satisfies DetectedAgent,
        ];
      });

      return cachedAgents;
    },

    async getAgentForPid(pid) {
      const agents = cachedAgents.length > 0 ? cachedAgents : await this.detectAgents();
      return agents.find((agent) => agent.pid === pid) ?? null;
    },

    watchProcesses(callback) {
      let stopped = false;

      const tick = async () => {
        if (stopped) {
          return;
        }

        try {
          callback(await this.detectAgents());
        } catch {
          callback([]);
        }
      };

      void tick();
      const timer = setInterval(() => {
        void tick();
      }, 5_000);

      return {
        stop() {
          stopped = true;
          clearInterval(timer);
        },
      };
    },
  };
}

export const agentDetector = createAgentDetector(createPolicyEngine());
export const detectAgents = agentDetector.detectAgents;
export const getAgentForPid = agentDetector.getAgentForPid;
export const watchProcesses = agentDetector.watchProcesses;
