import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

process.loadEnvFile?.(".env.local");

const rootDir = path.dirname(fileURLToPath(new URL(import.meta.url)));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globals: true,
  },
});
