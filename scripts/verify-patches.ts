#!/usr/bin/env bun
/**
 * scripts/verify-patches.ts
 *
 * Verifies that all injections from apply-patches.ts have been correctly
 * applied to the working tree. Checks for the presence of unique markers
 * so CI fails loudly if an injection is missing.
 *
 * Exits 0 on success, 1 on failure.
 * Called from CI and from sync-upstream.ts after bun install.
 */

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

interface Check {
  name: string;
  file: string;
  marker: string;
  /**
   * If true, a missing file is a warning not a failure.
   * Use for injections that are deferred (target file not yet located).
   */
  optional?: boolean;
}

const CHECKS: Check[] = [
  {
    name: "001 — import './bootstrap' in main/index.ts",
    file: "apps/desktop/src/main/index.ts",
    marker: "import './bootstrap'",
  },
  {
    name: "002 — getProviderRouters in tRPC appRouter",
    file: "apps/desktop/src/lib/trpc/routers/index.ts",
    marker: "getProviderRouters",
  },
  {
    name: "003 — ProviderSidebarSections in TasksView",
    file: "apps/desktop/src/renderer/routes/_authenticated/_dashboard/tasks/components/TasksView/TasksView.tsx",
    marker: "ProviderSidebarSections",
  },
  // 004 (git lifecycle hooks) is deferred — target file not yet located in upstream.
  // Add checks here once apply-patches.ts includes that injection.
];

// ─── Run checks ───────────────────────────────────────────────────────────────

const results: {
  name: string;
  status: "pass" | "fail" | "skip";
  reason?: string;
}[] = [];

for (const check of CHECKS) {
  const abs = path.resolve(process.cwd(), check.file);

  if (!existsSync(abs)) {
    results.push({
      name: check.name,
      status: check.optional ? "skip" : "fail",
      reason: `File not found: ${check.file}`,
    });
    continue;
  }

  const content = readFileSync(abs, "utf8");

  if (content.includes(check.marker)) {
    results.push({ name: check.name, status: "pass" });
  } else {
    results.push({
      name: check.name,
      status: "fail",
      reason: `Marker not found in ${check.file}:\n    "${check.marker}"`,
    });
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

console.log(
  "\n─── Patch verification ────────────────────────────────────────────",
);

for (const r of results) {
  const icon = r.status === "pass" ? "✓" : r.status === "skip" ? "⚠" : "✗";
  console.log(`  ${icon}  ${r.name}`);
  if (r.reason) console.log(`       ${r.reason}`);
}

console.log(
  "───────────────────────────────────────────────────────────────────",
);

const failed = results.filter((r) => r.status === "fail").length;
const skipped = results.filter((r) => r.status === "skip").length;

if (failed > 0) {
  console.error(`\n  ❌  ${failed} check(s) failed.\n`);
  console.error(
    "  An injection was not applied correctly.\n" +
      "  Run: bun run patches:apply\n" +
      "  If that fails, the upstream file changed — fix the apply() function\n" +
      "  in scripts/apply-patches.ts for the failing injection.\n",
  );
  process.exit(1);
} else {
  console.log(
    `  ✅  All checks passed (${skipped} skipped — deferred injections)\n`,
  );
}
