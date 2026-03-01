import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type PackageTarget = "prepare" | "linux-dir" | "linux" | "mac-dmg";

const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, "..", "..");
const stageDir = path.join("/tmp", "rashomon-package");
const releaseDir = path.join(projectRoot, "release");
const sourcePackageJsonPath = path.join(projectRoot, "package.json");
const sourceLockfilePath = path.join(projectRoot, "pnpm-lock.yaml");
const electronBuilderBin = path.join(projectRoot, "node_modules", ".bin", "electron-builder");
const electronRebuildBin = path.join(projectRoot, "node_modules", ".bin", "electron-rebuild");

interface PackageJsonShape {
  name: string;
  version: string;
  private?: boolean;
  description?: string;
  author?: unknown;
  homepage?: string;
  main?: string;
  type?: string;
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function run(command: string, args: string[], cwd: string, extraEnv: Record<string, string> = {}): void {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function resolveInstalledElectronVersion(): string {
  const installedPackageJson = path.join(projectRoot, "node_modules", "electron", "package.json");
  const installed = readJson<{ version: string }>(installedPackageJson);
  if (!installed.version) {
    throw new Error("Could not resolve installed Electron version.");
  }
  return installed.version;
}

function createStagePackageJson(): PackageJsonShape {
  const rootPackageJson = readJson<PackageJsonShape>(sourcePackageJsonPath);
  const electronVersion = resolveInstalledElectronVersion();

  return {
    name: rootPackageJson.name,
    version: rootPackageJson.version,
    private: rootPackageJson.private,
    description: rootPackageJson.description,
    author: rootPackageJson.author,
    homepage: rootPackageJson.homepage,
    main: rootPackageJson.main,
    type: rootPackageJson.type,
    packageManager: rootPackageJson.packageManager,
    dependencies: rootPackageJson.dependencies,
    devDependencies: {
      electron: electronVersion,
    },
  };
}

function prepareStage(): void {
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  fs.cpSync(path.join(projectRoot, "dist"), path.join(stageDir, "dist"), { recursive: true });
  fs.cpSync(path.join(projectRoot, "policies"), path.join(stageDir, "policies"), { recursive: true });
  fs.copyFileSync(sourceLockfilePath, path.join(stageDir, "pnpm-lock.yaml"));
  fs.writeFileSync(
    path.join(stageDir, "package.json"),
    `${JSON.stringify(createStagePackageJson(), null, 2)}\n`,
  );

  run(
    "pnpm",
    [
      "install",
      "--prod",
      "--offline",
      "--ignore-workspace",
      "--no-frozen-lockfile",
      "--store-dir",
      path.join(path.resolve(projectRoot, "..", ".."), ".pnpm-store", "v10"),
      "--package-import-method",
      "copy",
      "--virtual-store-dir",
      "node_modules/.pnpm",
      "--shamefully-hoist",
    ],
    stageDir,
    { CI: "true" },
  );

  run(
    electronRebuildBin,
    [
      "--force",
      "--module-dir",
      stageDir,
      "--which-module",
      "better-sqlite3",
      "--version",
      resolveInstalledElectronVersion(),
      "--arch",
      "x64",
    ],
    stageDir,
  );
}

function syncReleaseArtifacts(): void {
  const stageReleaseDir = path.join(stageDir, "release");
  if (!fs.existsSync(stageReleaseDir)) {
    return;
  }

  fs.mkdirSync(releaseDir, { recursive: true });
  for (const entry of fs.readdirSync(stageReleaseDir)) {
    const sourcePath = path.join(stageReleaseDir, entry);
    const targetPath = path.join(releaseDir, entry);
    fs.rmSync(targetPath, { recursive: true, force: true });
    fs.cpSync(sourcePath, targetPath, { recursive: true });
  }
}

function packageTarget(target: PackageTarget): void {
  prepareStage();

  if (target === "prepare") {
    return;
  }

  if (target === "linux-dir") {
    run(electronBuilderBin, ["--linux", "dir", "--config", path.join(projectRoot, "electron-builder.yml")], stageDir);
    syncReleaseArtifacts();
    return;
  }

  if (target === "linux") {
    run(
      electronBuilderBin,
      ["--linux", "dir", "AppImage", "deb", "--config", path.join(projectRoot, "electron-builder.yml")],
      stageDir,
    );
    syncReleaseArtifacts();
    return;
  }

  if (target === "mac-dmg") {
    run(electronBuilderBin, ["--mac", "dmg", "--config", path.join(projectRoot, "electron-builder.yml")], stageDir);
    syncReleaseArtifacts();
    return;
  }

  throw new Error(`Unsupported target: ${target}`);
}

const target = (process.argv[2] as PackageTarget | undefined) ?? "prepare";
packageTarget(target);
