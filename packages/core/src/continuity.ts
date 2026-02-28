import { join } from "node:path";

import type { RiskPassport } from "@soliddark/spec";

import { DISCLAIMERS } from "./constants.js";
import { ensureDir, writeJsonFile, writeTextFile } from "./fs.js";

export async function writeContinuityPack(root: string, passport: RiskPassport) {
  const packRoot = join(root, "continuity-pack");
  await ensureDir(packRoot);

  const hints = {
    status: "ok",
    inferred_from: {
      ecosystems: passport.ecosystems,
      project_types: passport.project_types,
      ci_present: passport.tests_and_ci.ci_files_present,
      repo_commit: passport.repo.commit,
    },
    labels: ["INFERRED", "MVP"],
    notes: [
      "Not legal advice. For information purposes only.",
      "No guarantee of security. This report may be incomplete.",
    ],
  };

  await writeTextFile(
    join(packRoot, "README.md"),
    `# Continuity Pack

${DISCLAIMERS.map((item) => `- ${item}`).join("\n")}

This continuity pack is a starter operating artifact. Any inferred content is explicitly labeled and should be reviewed by a human before use.
`,
  );
  await writeTextFile(
    join(packRoot, "credential-handoff.md"),
    `# Credential Handoff Template

Label: INFERRED

- Critical systems:
- MFA locations:
- Break-glass owner:
- Rotation order:
`,
  );
  await writeTextFile(
    join(packRoot, "incident-contacts.md"),
    `# Incident Contacts

Label: INFERRED

- Primary operator:
- Backup operator:
- Hosting provider:
- Billing owner:
`,
  );
  await writeTextFile(
    join(packRoot, "release-checklist.md"),
    `# Release Checklist

Label: INFERRED

- Attach updated risk passport to release
- Confirm continuity documents reflect current owners
- Confirm rollback path
`,
  );
  await writeJsonFile(join(packRoot, "inference-hints.json"), hints);

  return packRoot;
}
