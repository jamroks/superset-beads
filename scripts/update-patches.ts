#!/usr/bin/env bun
/**
 * scripts/update-patches.ts
 *
 * Regenerates patches/ from the current working tree state.
 * Run this after manually resolving a patch conflict with upstream.
 *
 * Usage:
 *   bun run scripts/update-patches.ts
 *
 * What it does:
 *   1. Runs `patch-package --create-patch <package>` for each patched file
 *   2. Verifies the new patches pass verify-patches.ts
 *   3. Stages the updated patches/ directory
 */

import { $ } from 'bun'
import { readdirSync } from 'node:fs'

// Files we patch — these are the upstream files we inject into
// If the actual filename in the upstream repo differs, update here
const PATCHED_MODULES = [
  // patch-package uses package names from node_modules; for monorepo
  // apps we use the app name as declared in its package.json "name" field.
  // Adjust these if upstream renames their packages.
  'desktop',  // covers apps/desktop/**
]

console.log('\n─── Updating patches ─────────────────────────────────────────────')
console.log('  This regenerates patches/ from the current working tree.\n')

// patch-package creates patches for each modified module
for (const mod of PATCHED_MODULES) {
  console.log(`  Creating patch for: ${mod}`)
  try {
    await $`bunx patch-package ${mod} --create-patch`
    console.log(`  ✓ ${mod}`)
  } catch (err) {
    console.warn(`  ⚠ patch-package for ${mod} returned non-zero (may be normal if no changes)`)
  }
}

// List what we now have
const patches = readdirSync('patches').filter(f => f.endsWith('.patch'))
console.log(`\n  Patches in patches/:\n${patches.map(p => `    ${p}`).join('\n')}`)

// Verify
console.log('\n  Running verification...')
await $`bun run scripts/verify-patches.ts`

// Stage patches
await $`git add patches/`
console.log('\n  ✅ Patches updated and staged. Review with: git diff --cached patches/')
console.log('  Then commit: git commit -m "chore: update patches for upstream changes"\n')
