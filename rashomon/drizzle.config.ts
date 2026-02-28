import { resolve } from "node:path";

import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/main/db/schema.ts",
  out: "./src/main/db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: resolve(process.env.RASHOMON_DATA_DIR ?? ".rashomon", "data.db"),
  },
  verbose: true,
  strict: true,
});
