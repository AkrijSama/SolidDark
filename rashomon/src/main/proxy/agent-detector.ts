import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import crypto from "node:crypto";

import { createPolicyEngine, policyEngine, type PolicyEngine } from "../engine/policy-engine";
import type { ConnectionProcessInfo, DetectedAgent } from "../../shared/types";

const execFileAsync = promisify(execFile);
const ESTABLISHED_TCP_STATE = "01";

interface ProcessEntry {
  pid: number;
  processName: string;
  command: string;
  processPath?: string;
}

interface CachedConnectionProcess {
  expiresAt: number;
  value: ConnectionProcessInfo | null;
}

export interface AgentDetectorDependencies {
  platform?: NodeJS.Platform;
  procRoot?: string;
  now?: () => number;
  execFile?: (file: string, args: string[]) => Promise<{ stdout: string }>;
  readFile?: (filePath: string) => Promise<string>;
  readDir?: (directoryPath: string) => Promise<string[]>;
  readLink?: (filePath: string) => Promise<string>;
}

export interface ProcessWatcher {
  stop: () => void;
}

export interface AgentDetector {
  detectAgents: () => Promise<DetectedAgent[]>;
  getAgentForPid: (pid: number) => Promise<DetectedAgent | null>;
  getProcessForConnection: (sourcePort: number) => Promise<ConnectionProcessInfo | null>;
  watchProcesses: (callback: (agents: DetectedAgent[]) => void) => ProcessWatcher;
}

function normalizeProcessList(output: string): ProcessEntry[] {
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

function processIdentity(processInfo: { pid: number; processName: string; processPath?: string }): string {
  return `agent-${crypto
    .createHash("sha256")
    .update(`${processInfo.pid}:${processInfo.processName}:${processInfo.processPath ?? ""}`)
    .digest("hex")
    .slice(0, 16)}`;
}

function matchProfile(
  engine: PolicyEngine,
  processInfo: Pick<ProcessEntry, "processName" | "command">,
): { name: string; allowedDomainsExtra: string[]; maxBodyBytes: number } | null {
  const policyProfiles = engine.getMergedPolicy().agents.profiles.map((profile) => ({
    name: profile.name,
    processPatterns: profile.processPatterns,
    allowedDomainsExtra: profile.allowedDomainsExtra,
    maxBodyBytes: profile.maxBodyBytes,
  }));
  const candidates = [...policyProfiles, ...knownFallbackProfiles().map((candidate) => ({
    ...candidate,
    allowedDomainsExtra: [],
    maxBodyBytes: 1024 * 1024,
  }))];

  return (
    candidates.find((candidate) =>
      candidate.processPatterns.some((pattern) =>
        new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(
          `${processInfo.processName} ${processInfo.command}`,
        ),
      ),
    ) ?? null
  );
}

function parseProcNetEntries(contents: string): Array<{ localPort: number; inode: string; state: string }> {
  return contents
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter((parts) => parts.length >= 10)
    .map((parts) => {
      const [addressHex, portHex] = (parts[1] ?? "00000000:0000").split(":");
      void addressHex;
      return {
        localPort: Number.parseInt(portHex ?? "0", 16),
        state: parts[3] ?? "",
        inode: parts[9] ?? "",
      };
    })
    .filter((entry) => Number.isFinite(entry.localPort) && entry.inode.length > 0);
}

export function createAgentDetector(
  engine: PolicyEngine = policyEngine,
  dependencies: AgentDetectorDependencies = {},
): AgentDetector {
  const platform = dependencies.platform ?? process.platform;
  const procRoot = dependencies.procRoot ?? "/proc";
  const now = dependencies.now ?? (() => Date.now());
  const readFile = dependencies.readFile ?? (async (filePath) => fs.readFile(filePath, "utf8"));
  const readDir = dependencies.readDir ?? (async (directoryPath) => fs.readdir(directoryPath));
  const readLink = dependencies.readLink ?? (async (filePath) => fs.readlink(filePath));
  const runExecFile =
    dependencies.execFile ??
    (async (file, args) => {
      const result = await execFileAsync(file, args);
      return { stdout: result.stdout };
    });

  let cachedAgents: DetectedAgent[] = [];
  const connectionCache = new Map<number, CachedConnectionProcess>();

  async function listProcesses(): Promise<ProcessEntry[]> {
    if (platform === "win32") {
      const { stdout } = await runExecFile("tasklist", ["/fo", "csv", "/v"]);
      return stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("\""))
        .map((line) => line.split("\",\"").map((part) => part.replace(/^"|"$/g, "")))
        .map((parts) => ({
          processName: parts[0] ?? "",
          pid: Number(parts[1]),
          command: parts.join(" "),
          processPath: parts[0] ?? "",
        }))
        .filter((item) => Number.isFinite(item.pid));
    }

    const { stdout } = await runExecFile("ps", ["-eo", "pid=,comm=,args="]);
    return normalizeProcessList(stdout);
  }

  async function readLinuxConnectionProcess(sourcePort: number): Promise<ConnectionProcessInfo | null> {
    const socketTables = ["tcp", "tcp6"];
    let inode: string | null = null;

    for (const socketTable of socketTables) {
      try {
        const table = parseProcNetEntries(await readFile(path.join(procRoot, "net", socketTable)));
        const match = table.find((entry) => entry.localPort === sourcePort && entry.state === ESTABLISHED_TCP_STATE);
        if (match) {
          inode = match.inode;
          break;
        }
      } catch {
        // Fallbacks handle lookup failures.
      }
    }

    if (!inode) {
      return null;
    }

    const procEntries = await readDir(procRoot);
    for (const procEntry of procEntries) {
      if (!/^\d+$/.test(procEntry)) {
        continue;
      }

      const fdDirectory = path.join(procRoot, procEntry, "fd");
      let fds: string[] = [];
      try {
        fds = await readDir(fdDirectory);
      } catch {
        continue;
      }

      for (const fd of fds) {
        try {
          const link = await readLink(path.join(fdDirectory, fd));
          if (link !== `socket:[${inode}]`) {
            continue;
          }

          const pid = Number(procEntry);
          const processPath = await readLink(path.join(procRoot, procEntry, "exe")).catch(() => "");
          const processName =
            (await readFile(path.join(procRoot, procEntry, "comm")).catch(() => "")).trim() ||
            path.basename(processPath) ||
            `pid-${procEntry}`;

          return {
            pid,
            name: processName,
            path: processPath || processName,
            sourcePort,
            resolvedAt: now(),
          };
        } catch {
          // Ignore races with exiting processes and continue scanning.
        }
      }
    }

    return null;
  }

  async function readLsofConnectionProcess(sourcePort: number): Promise<ConnectionProcessInfo | null> {
    try {
      const { stdout } = await runExecFile("lsof", ["-nP", `-iTCP:${sourcePort}`, "-sTCP:ESTABLISHED", "-Fpctn"]);
      let pid = 0;
      let processName = "";
      for (const line of stdout.split("\n")) {
        if (line.startsWith("p")) {
          pid = Number(line.slice(1));
        } else if (line.startsWith("c")) {
          processName = line.slice(1);
        }
      }

      if (!pid) {
        return null;
      }

      let processPath = processName;
      if (platform === "darwin" || platform === "linux") {
        const { stdout: commandStdout } = await runExecFile("ps", ["-p", String(pid), "-o", "command="]);
        processPath = commandStdout.trim().split(/\s+/)[0] || processName;
      }

      return {
        pid,
        name: processName || path.basename(processPath),
        path: processPath,
        sourcePort,
        resolvedAt: now(),
      };
    } catch {
      return null;
    }
  }

  async function readWindowsConnectionProcess(sourcePort: number): Promise<ConnectionProcessInfo | null> {
    try {
      const { stdout } = await runExecFile("netstat", ["-ano", "-p", "tcp"]);
      const line = stdout
        .split("\n")
        .map((entry) => entry.trim())
        .find((entry) => entry.includes(`:${sourcePort}`) && entry.includes("ESTABLISHED"));

      if (!line) {
        return null;
      }

      const parts = line.split(/\s+/);
      const pid = Number(parts.at(-1));
      if (!pid) {
        return null;
      }

      const { stdout: tasklistStdout } = await runExecFile("tasklist", ["/fi", `PID eq ${pid}`, "/fo", "csv", "/nh"]);
      const [processName] = tasklistStdout.replace(/^"|"$/g, "").split("\",\"");

      let processPath = processName ?? "";
      try {
        const { stdout: powerShellStdout } = await runExecFile("powershell", [
          "-NoProfile",
          "-Command",
          `(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path`,
        ]);
        processPath = powerShellStdout.trim() || processPath;
      } catch {
        // Fallback path is the process name on Windows if the full path is unavailable.
      }

      return {
        pid,
        name: processName || `pid-${pid}`,
        path: processPath || processName || `pid-${pid}`,
        sourcePort,
        resolvedAt: now(),
      };
    } catch {
      return null;
    }
  }

  async function resolveConnectionProcess(sourcePort: number): Promise<ConnectionProcessInfo | null> {
    const cached = connectionCache.get(sourcePort);
    if (cached && cached.expiresAt > now()) {
      return cached.value;
    }

    let resolved: ConnectionProcessInfo | null = null;
    if (platform === "linux") {
      resolved = (await readLinuxConnectionProcess(sourcePort)) ?? (await readLsofConnectionProcess(sourcePort));
    } else if (platform === "darwin") {
      resolved = await readLsofConnectionProcess(sourcePort);
    } else if (platform === "win32") {
      resolved = await readWindowsConnectionProcess(sourcePort);
    }

    connectionCache.set(sourcePort, {
      expiresAt: now() + 5_000,
      value: resolved,
    });

    return resolved;
  }

  async function detectAgents(): Promise<DetectedAgent[]> {
    if (engine.getPolicies().length === 0) {
      await engine.loadPolicies();
    }

    const processes = await listProcesses();
    cachedAgents = processes.flatMap((processInfo) => {
      const matched = matchProfile(engine, processInfo);
      if (!matched) {
        return [];
      }

      return [
        {
          id: processIdentity(processInfo),
          name: matched.name,
          processName: processInfo.processName,
          processPath: processInfo.processPath,
          pid: processInfo.pid,
          declaredPurpose: null,
          status: "active",
          matchedProfile: matched.name,
          allowedDomainsExtra: matched.allowedDomainsExtra,
          maxBodyBytes: matched.maxBodyBytes,
          detectedAt: now(),
        } satisfies DetectedAgent,
      ];
    });

    return cachedAgents;
  }

  return {
    detectAgents,

    async getAgentForPid(pid) {
      if (engine.getPolicies().length === 0) {
        await engine.loadPolicies();
      }

      const existing = cachedAgents.find((agent) => agent.pid === pid);
      if (existing) {
        return existing;
      }

      const processes = await listProcesses();
      const processInfo = processes.find((entry) => entry.pid === pid);
      if (!processInfo) {
        return null;
      }

      const matched = matchProfile(engine, processInfo);
      return {
        id: processIdentity(processInfo),
        name: matched?.name ?? "unknown-agent",
        processName: processInfo.processName,
        processPath: processInfo.processPath,
        pid: processInfo.pid,
        declaredPurpose: null,
        status: "active",
        matchedProfile: matched?.name ?? null,
        allowedDomainsExtra: matched?.allowedDomainsExtra ?? [],
        maxBodyBytes: matched?.maxBodyBytes ?? engine.getMergedPolicy().agents.unknown_agent.max_body_bytes,
        detectedAt: now(),
      };
    },

    async getProcessForConnection(sourcePort) {
      if (!Number.isFinite(sourcePort) || sourcePort <= 0) {
        return null;
      }

      return resolveConnectionProcess(sourcePort);
    },

    watchProcesses(callback) {
      let stopped = false;

      const tick = async () => {
        if (stopped) {
          return;
        }

        try {
          callback(await detectAgents());
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
export const getProcessForConnection = agentDetector.getProcessForConnection;
export const watchProcesses = agentDetector.watchProcesses;
