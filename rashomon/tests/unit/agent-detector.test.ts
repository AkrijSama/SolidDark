import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPolicyEngine } from "@main/engine/policy-engine";
import { createAgentDetector } from "@main/proxy/agent-detector";

describe("agent detector", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "rashomon-agent-detector-"));
    fs.mkdirSync(path.join(tempDir, "policies"));
    fs.copyFileSync(
      path.join(process.cwd(), "policies/default.yaml"),
      path.join(tempDir, "policies/default.yaml"),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("resolves a Linux process from /proc socket ownership and caches the result for five seconds", async () => {
    const engine = createPolicyEngine({ policiesDir: path.join(tempDir, "policies") });
    await engine.loadPolicies();

    const execFile = vi.fn(async (_file: string, _args: string[]) => ({ stdout: "" }));
    const readFile = vi.fn(async (filePath: string) => {
      if (filePath.endsWith("/net/tcp")) {
        return [
          "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode",
          "   0: 0100007F:8AE1 0100007F:22B8 01 00000000:00000000 00:00000000 00000000   100        0 12345 1 0000000000000000 20 4 30 10 -1",
        ].join("\n");
      }
      if (filePath.endsWith("/net/tcp6")) {
        return "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode";
      }
      if (filePath.endsWith("/4242/comm")) {
        return "claude\n";
      }
      throw new Error(`Unexpected readFile path: ${filePath}`);
    });
    const readDir = vi.fn(async (directoryPath: string) => {
      if (directoryPath === "/proc") {
        return ["4242", "self", "net"];
      }
      if (directoryPath === "/proc/4242/fd") {
        return ["0", "1", "2", "7"];
      }
      return [];
    });
    const readLink = vi.fn(async (filePath: string) => {
      if (filePath === "/proc/4242/fd/7") {
        return "socket:[12345]";
      }
      if (filePath === "/proc/4242/exe") {
        return "/usr/local/bin/claude";
      }
      throw new Error(`Unexpected readLink path: ${filePath}`);
    });

    let currentTime = 1_000;
    const detector = createAgentDetector(engine, {
      platform: "linux",
      procRoot: "/proc",
      now: () => currentTime,
      execFile,
      readFile,
      readDir,
      readLink,
    });

    const first = await detector.getProcessForConnection(35553);
    expect(first).toEqual({
      pid: 4242,
      name: "claude",
      path: "/usr/local/bin/claude",
      sourcePort: 35553,
      resolvedAt: 1_000,
    });

    currentTime = 5_500;
    const second = await detector.getProcessForConnection(35553);
    expect(second?.pid).toBe(4242);
    expect(readFile).toHaveBeenCalledTimes(2);

    currentTime = 6_500;
    const third = await detector.getProcessForConnection(35553);
    expect(third?.pid).toBe(4242);
    expect(readFile).toHaveBeenCalledTimes(4);
  });

  it("falls back to null when no process owns the connection", async () => {
    const engine = createPolicyEngine({ policiesDir: path.join(tempDir, "policies") });
    await engine.loadPolicies();

    const detector = createAgentDetector(engine, {
      platform: "linux",
      procRoot: "/proc",
      now: () => 1_000,
      execFile: async () => ({ stdout: "" }),
      readFile: async (filePath: string) => {
        if (filePath.endsWith("/net/tcp") || filePath.endsWith("/net/tcp6")) {
          return "  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode";
        }
        throw new Error(`Unexpected readFile path: ${filePath}`);
      },
      readDir: async () => [],
      readLink: async () => "",
    });

    await expect(detector.getProcessForConnection(9999)).resolves.toBeNull();
  });
});
