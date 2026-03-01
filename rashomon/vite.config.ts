import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(__dirname, "src/renderer"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@main": resolve(__dirname, "src/main"),
      "@renderer": resolve(__dirname, "src/renderer"),
      "@shared": resolve(__dirname, "src/shared"),
      "@sdk": resolve(__dirname, "src/sdk"),
    },
  },
  build: {
    outDir: resolve(__dirname, "dist/renderer"),
    emptyOutDir: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("recharts") || id.includes("victory-vendor") || id.includes("d3-")) {
            return "charts";
          }

          if (id.includes("@radix-ui") || id.includes("sonner")) {
            return "ui-vendor";
          }

          if (id.includes("lucide-react")) {
            return "icons";
          }

          return "vendor";
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 9090,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
} as never);
