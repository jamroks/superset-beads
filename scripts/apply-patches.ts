#!/usr/bin/env bun
/**
 * scripts/apply-patches.ts
 *
 * Surgically injects our additions into upstream Superset source files.
 * Called automatically via postinstall.
 *
 * Why this exists instead of patch-package:
 *   patch-package patches files inside node_modules/ — npm packages.
 *   It cannot patch source files in the repo itself. Wrong tool.
 *   This script does the same job correctly for source files.
 *
 * Each injection is:
 *   - Idempotent  : skipped if marker already present in file
 *   - Loud        : throws with a clear message if anchor not found
 *   - Resilient   : warns but continues if target file doesn't exist
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Injection {
  /** Human-readable name shown in output */
  name: string;
  /** File to patch, relative to repo root */
  file: string;
  /**
   * A unique string that proves this injection is already applied.
   * Checked BEFORE attempting to apply — makes every injection idempotent.
   */
  marker: string;
  /**
   * Transform function. Receives current file content, returns patched content.
   * Only called when marker is absent. Must throw with a clear message if the
   * anchor it expects is missing — never silently produce wrong output.
   */
  apply: (content: string) => string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROOT = process.cwd();

function read(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8");
}

function write(file: string, content: string): void {
  writeFileSync(path.join(ROOT, file), content, "utf8");
}

/** Insert `text` immediately before the first match of `pattern` */
function before(content: string, pattern: RegExp, text: string): string {
  const match = content.match(pattern);
  if (!match || match.index === undefined) {
    throw new Error(`Anchor not found: ${pattern}`);
  }
  return (
    content.slice(0, match.index) + text + "\n" + content.slice(match.index)
  );
}

/** Insert `text` immediately after the first match of `pattern` */
function after(content: string, pattern: RegExp, text: string): string {
  const match = content.match(pattern);
  if (!match || match.index === undefined) {
    throw new Error(`Anchor not found: ${pattern}`);
  }
  const pos = match.index + match[0].length;
  return content.slice(0, pos) + "\n" + text + content.slice(pos);
}

// ─── Injections ───────────────────────────────────────────────────────────────

const INJECTIONS: Injection[] = [
  // ── 001 ─ import bootstrap in main/index.ts ──────────────────────────────────
  //
  // Adds `import './bootstrap'` before the first import in the file.
  // bootstrap.ts registers all task providers at startup.
  {
    name: "001 — import bootstrap in main/index.ts",
    file: "apps/desktop/src/main/index.ts",
    marker: "import './bootstrap'",
    apply(content) {
      return before(
        content,
        /^import /m,
        "// ── Beads fork 001: register task providers before app starts ────────────────\n" +
          "import './bootstrap'\n" +
          "// ─────────────────────────────────────────────────────────────────────────────",
      );
    },
  },

  // ── 002 ─ spread provider routers in trpc/routers/index.ts ───────────────────
  //
  // Adds the import for getProviderRouters and spreads it inside appRouter
  // so that trpc.beads.* procedures are available to the renderer.
  {
    name: "002 — getProviderRouters in tRPC appRouter",
    file: "apps/desktop/src/lib/trpc/routers/index.ts",
    marker: "getProviderRouters",
    apply(content) {
      // Step 1: inject import before the first import statement
      let result = before(
        content,
        /^import /m,
        "// ── Beads fork 002 ──────────────────────────────────────────────────────────\n" +
          "import { getProviderRouters } from '../../../lib/task-providers/registry'\n" +
          "// ─────────────────────────────────────────────────────────────────────────────\n",
      );

      // Step 2: spread provider routers inside the router({}) call
      // Upstream wraps it in createAppRouter(): return router({ ... })
      result = after(
        result,
        /return router\(\{/,
        "  // ── Beads fork 002 ──────────────────────────────────────────────────────\n" +
          "  ...getProviderRouters(),\n" +
          "  // ───────────────────────────────────────────────────────────────────────────",
      );

      return result;
    },
  },

  // ── 003 ─ ProviderSidebarSections in TasksView.tsx ───────────────────────────
  //
  // Adds the import and renders <ProviderSidebarSections /> next to
  // <TableContent /> only in the final ternary branch.
  {
    name: "003 — ProviderSidebarSections in TasksView",
    file: "apps/desktop/src/renderer/routes/_authenticated/_dashboard/tasks/components/TasksView/TasksView.tsx",
    marker: "ProviderSidebarSections",
    apply(content) {
      // Step 1: inject import before the first import statement
      let result = before(
        content,
        /^import /m,
        "// ── Beads fork 003 ──────────────────────────────────────────────────────────\n" +
          "import { ProviderSidebarSections } from '../../../../../../../lib/task-providers/ProviderSidebarSections'\n" +
          "// ─────────────────────────────────────────────────────────────────────────────\n",
      );

      // Step 2: replace the final TableContent branch with a Fragment wrapper.
      const tableBranchPattern =
        /(\)\s*:\s*\(\s*)<TableContent\s*\n([ \t]*)filterTab=\{currentTab\}\s*\n\2searchQuery=\{searchQuery\}\s*\n\2assigneeFilter=\{assigneeFilter\}\s*\n\2onTaskClick=\{handleTaskClick\}\s*\n\2onSelectionChange=\{handleSelectionChange\}\s*\n([ \t]*)\/>(\s*\)\s*\})/m;

      const match = result.match(tableBranchPattern);
      if (!match) {
        throw new Error(
          "Cannot find TableContent else branch in TasksView.tsx.\n" +
            "  Expected the known TableContent prop block.\n" +
            "  Upstream likely changed the prop order or render structure.",
        );
      }

      const [, prefix, propIndent, closingIndent, suffix] = match;
      const fragmentIndent =
        propIndent.length > 0 ? propIndent.slice(0, -1) : propIndent;

      const replacement =
        `${prefix}<>\n` +
        `${propIndent}<TableContent\n` +
        `${propIndent}filterTab={currentTab}\n` +
        `${propIndent}searchQuery={searchQuery}\n` +
        `${propIndent}assigneeFilter={assigneeFilter}\n` +
        `${propIndent}onTaskClick={handleTaskClick}\n` +
        `${propIndent}onSelectionChange={handleSelectionChange}\n` +
        `${closingIndent}/>\n` +
        `${closingIndent}{/* ── Beads fork 003 ─────────────────────────────────────────────── */}\n` +
        `${closingIndent}<ProviderSidebarSections />\n` +
        `${closingIndent}{/* ──────────────────────────────────────────────────────────────────── */}\n` +
        `${fragmentIndent}</>${suffix}`;

      result = result.replace(tableBranchPattern, replacement);
      return result;
    },
  },

  // ── 004 ─ git lifecycle hooks — DEFERRED ─────────────────────────────────────
  //
  // The file apps/desktop/src/lib/trpc/routers/workspaces/git-operations.ts
  // does not exist in upstream. Upstream uses a procedures/ directory structure.
  //
  // Impact: git lifecycle hooks (afterPull, beforeCommit, onWorkspaceCreate,
  // onWorkspaceDestroy) will NOT fire automatically. The beads UI and core
  // task integration work correctly without this — issues are visible and
  // manageable. The only thing missing is automatic JSONL sync on git events.
  //
  // To enable: explore apps/desktop/src/lib/trpc/routers/workspaces/procedures/
  // find the pull, commit, create, and delete handlers, and add the injection here.
];

// ─── Runner ───────────────────────────────────────────────────────────────────

let passed = 0;
let skipped = 0;
let failed = 0;
const failures: string[] = [];

console.log(
  "\n─── Applying patches ──────────────────────────────────────────────",
);

for (const inj of INJECTIONS) {
  const abs = path.join(ROOT, inj.file);

  // Target file missing — warn and continue (upstream may have restructured)
  if (!existsSync(abs)) {
    console.log(`  ⚠  SKIP  ${inj.name}`);
    console.log(`           File not found: ${inj.file}`);
    skipped++;
    continue;
  }

  const content = read(inj.file);

  // Already applied — idempotent skip
  if (content.includes(inj.marker)) {
    console.log(`  ✓  OK    ${inj.name} (already applied)`);
    passed++;
    continue;
  }

  // Apply
  try {
    const patched = inj.apply(content);

    // Safety check — confirm marker is now present
    if (!patched.includes(inj.marker)) {
      throw new Error(`Marker still absent after apply: "${inj.marker}"`);
    }

    write(inj.file, patched);
    console.log(`  ✓  DONE  ${inj.name}`);
    passed++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  FAIL  ${inj.name}`);
    console.error(`           ${msg}`);
    failures.push(`${inj.name}: ${msg}`);
    failed++;
  }
}

console.log(
  "───────────────────────────────────────────────────────────────────",
);

if (failed > 0) {
  console.error(`\n  ❌  ${failed} injection(s) failed.\n`);
  console.error(
    "  Upstream likely changed one of the patched files.\n" +
      "  Fix the apply() function for the failing injection in scripts/apply-patches.ts,\n" +
      "  then re-run: bun run patches:apply\n",
  );
  process.exit(1);
} else {
  console.log(`  ✅  ${passed} applied, ${skipped} skipped\n`);
}
