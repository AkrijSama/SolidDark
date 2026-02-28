import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

export async function ensureDir(path: string) {
  await mkdir(path, { recursive: true });
}

export async function writeTextFile(path: string, content: string) {
  await ensureDir(dirname(path));
  await writeFile(path, content, "utf8");
}

export async function writeJsonFile(path: string, value: unknown) {
  await writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(root: string, options?: { exclude?: string[]; maxBytes?: number }) {
  const exclude = new Set(options?.exclude ?? []);
  const files: string[] = [];

  async function visit(current: string) {
    const entries = await readdir(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolute = join(current, entry.name);
      const relativePath = relative(root, absolute);

      if (exclude.has(entry.name) || exclude.has(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }

      if (entry.isFile()) {
        if (options?.maxBytes) {
          const entryStat = await stat(absolute);
          if (entryStat.size > options.maxBytes) {
            continue;
          }
        }

        files.push(resolve(absolute));
      }
    }
  }

  await visit(resolve(root));
  return files.sort();
}
