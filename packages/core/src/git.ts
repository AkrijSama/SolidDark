import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { RepoSignal } from "./scan.js";

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]) {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

export async function collectRepoSignal(cwd: string): Promise<RepoSignal> {
  try {
    const commit = await runGit(cwd, ["rev-parse", "HEAD"]);
    const branch = await runGit(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const status = await runGit(cwd, ["status", "--porcelain"]);
    const remotes = (await runGit(cwd, ["remote", "-v"]))
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      status: "ok",
      commit: commit || null,
      dirty: status.length > 0,
      branch: branch || null,
      remotes,
    };
  } catch (error) {
    return {
      status: "unknown",
      commit: null,
      dirty: null,
      branch: null,
      remotes: [],
      unknown_reason: error instanceof Error ? error.message : "git metadata unavailable",
    };
  }
}
