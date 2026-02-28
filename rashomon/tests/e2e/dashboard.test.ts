import fs from "node:fs";
import path from "node:path";

import { test, expect } from "@playwright/test";

test("renderer build artifacts exist and reference the Rashomon shell", async () => {
  const appSource = fs.readFileSync(path.join(process.cwd(), "src/renderer/App.tsx"), "utf8");
  const htmlSource = fs.readFileSync(path.join(process.cwd(), "src/renderer/index.html"), "utf8");

  expect(appSource).toContain("Shell");
  expect(appSource).toContain("TrafficFeed");
  expect(appSource).toContain("PolicyEditor");
  expect(htmlSource).toContain("root");
});
