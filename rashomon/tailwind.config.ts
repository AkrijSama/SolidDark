import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/renderer/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        bg: {
          dark: "#080810",
          surface: "#10101C",
          elevated: "#1A1A2E",
        },
        border: "#2A2A40",
        text: {
          primary: "#E8E8F0",
          muted: "#8888A0",
          dim: "#55556A",
        },
        signal: {
          safe: "#22C55E",
          warn: "#EAB308",
          danger: "#EF4444",
          info: "#06B6D4",
          agent: "#8B5CF6",
        },
      },
      fontFamily: {
        heading: ["JetBrains Mono", "monospace"],
        body: ["Inter", "sans-serif"],
        code: ["JetBrains Mono", "monospace"],
      },
    },
  },
};

export default config;
