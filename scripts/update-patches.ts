#!/usr/bin/env bun
/**
 * patches:update
 *
 * Source patches are defined in scripts/apply-patches.ts.
 *
 * There is nothing to regenerate automatically here like patch-package used to
 * do. This command exists only as a guardrail so old workflows fail loudly and
 * point to the right place.
 */

console.log(`\nSource patches are managed in scripts/apply-patches.ts.\n`)
console.log(`When upstream changes a patched file:`)
console.log(`  1. update the corresponding injection in scripts/apply-patches.ts`)
console.log(`  2. run: bun run patches:apply`)
console.log(`  3. run: bun run patches:verify`)
console.log(`  4. run: bun run typecheck`) 
