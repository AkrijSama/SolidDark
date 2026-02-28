import { cp, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runCli } from "../packages/cli/dist/index.js";
import { startRegistryServer } from "../packages/registry/dist/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function makeTempDir(prefix) {
  return await mkdtemp(join(tmpdir(), prefix));
}

async function copyFixture(name) {
  const source = resolve(repoRoot, "fixtures", name);
  const tempRoot = await makeTempDir(`soliddark-proof-${name}-`);
  const target = join(tempRoot, name);
  await cp(source, target, { recursive: true });
  return target;
}

async function captureLogs(fn) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => {
    lines.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
  };

  try {
    await fn();
  } finally {
    console.log = original;
  }

  return lines;
}

async function listFilesRecursive(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(root, absolute)));
      continue;
    }

    files.push(absolute.slice(root.length + 1));
  }

  return files.sort();
}

async function withMockedRegistryFetch(baseUrl, app, fn) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (!url.startsWith(baseUrl)) {
      return originalFetch(input, init);
    }

    const parsed = new URL(url);
    const response = await app.inject({
      method: init?.method ?? "GET",
      url: `${parsed.pathname}${parsed.search}`,
      headers: Object.fromEntries(new Headers(init?.headers).entries()),
      payload: typeof init?.body === "string" ? init.body : undefined,
    });

    return new Response(response.body, { status: response.statusCode });
  };

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const fixtureDir = await copyFixture("node-simple");
const homeDir = await makeTempDir("soliddark-proof-home-");
const outDir = await makeTempDir("soliddark-proof-out-");
const exportDir = await makeTempDir("soliddark-proof-export-");
const registryDir = await makeTempDir("soliddark-proof-registry-");
const baseUrl = "http://127.0.0.1:4013";

process.env.HOME = homeDir;
process.env.USERPROFILE = homeDir;

const server = await startRegistryServer({
  host: "127.0.0.1",
  port: 4013,
  apiKey: "proof-key",
  dataDir: registryDir,
  listen: false,
});

try {
  const commands = [
    "soliddark keys generate",
    `soliddark registry login --api-key proof-key --url ${baseUrl}`,
    `soliddark scan ${fixtureDir} --offline --out ${outDir}`,
    `soliddark continuity ${fixtureDir} --out ${outDir}`,
    `soliddark publish ${join(outDir, "risk-passport.json")} --bench-opt-in`,
    `soliddark verify ${join(outDir, "risk-passport.json")} --sig ${join(outDir, "risk-passport.sig")} --registry-envelope ${join(outDir, "risk-passport.registry.json")}`,
    `soliddark export vendor-packet --passport ${join(outDir, "risk-passport.json")} --continuity ${join(outDir, "continuity-pack")} --out ${exportDir}`,
  ];

  const outputs = await withMockedRegistryFetch(baseUrl, server.app, async () => {
    const collected = [];

    collected.push({
      command: commands[0],
      lines: await captureLogs(() => runCli(["keys", "generate"], repoRoot)),
    });
    collected.push({
      command: commands[1],
      lines: await captureLogs(() => runCli(["registry", "login", "--api-key", "proof-key", "--url", baseUrl], repoRoot)),
    });
    collected.push({
      command: commands[2],
      lines: await captureLogs(() => runCli(["scan", fixtureDir, "--offline", "--out", outDir], repoRoot)),
    });
    collected.push({
      command: commands[3],
      lines: await captureLogs(() => runCli(["continuity", fixtureDir, "--out", outDir], repoRoot)),
    });
    collected.push({
      command: commands[4],
      lines: await captureLogs(() => runCli(["publish", join(outDir, "risk-passport.json"), "--bench-opt-in"], repoRoot)),
    });
    collected.push({
      command: commands[5],
      lines: await captureLogs(() =>
        runCli(
          [
            "verify",
            join(outDir, "risk-passport.json"),
            "--sig",
            join(outDir, "risk-passport.sig"),
            "--registry-envelope",
            join(outDir, "risk-passport.registry.json"),
          ],
          repoRoot,
        ),
      ),
    });
    collected.push({
      command: commands[6],
      lines: await captureLogs(() =>
        runCli(
          [
            "export",
            "vendor-packet",
            "--passport",
            join(outDir, "risk-passport.json"),
            "--continuity",
            join(outDir, "continuity-pack"),
            "--out",
            exportDir,
          ],
          repoRoot,
        ),
      ),
    });

    return collected;
  });

  const markdown = await readFile(join(outDir, "risk-passport.md"), "utf8");
  const vendorPacketFiles = await listFilesRecursive(exportDir);
  const publishOutput = JSON.parse(outputs[4].lines.at(-1) ?? "{}");
  const verifyOutput = JSON.parse(outputs[5].lines.at(-1) ?? "{}");

  console.log(JSON.stringify({
    commands,
    out_dir: outDir,
    export_dir: exportDir,
    publish_output: publishOutput,
    verify_output: verifyOutput,
    vendor_packet_files: vendorPacketFiles,
    markdown,
  }, null, 2));
} finally {
  await server.close();
}
