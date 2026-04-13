#!/usr/bin/env bun
/**
 * scripts/sync-upstream.ts
 *
 * Fetches upstream superset-sh/superset, merges into the fork,
 * re-applies patches, verifies, and optionally triggers a build.
 *
 * Usage:
 *   bun run scripts/sync-upstream.ts
 *   bun run scripts/sync-upstream.ts --build
 *   bun run scripts/sync-upstream.ts --dry-run
 */

import { $ } from 'bun'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const UPSTREAM_REMOTE = 'upstream'
const UPSTREAM_URL = 'https://github.com/superset-sh/superset.git'
const UPSTREAM_BRANCH = 'main'
const FORK_BRANCH = 'main'
const SYNC_LOG = '.beads-integration/sync.log'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const BUILD   = args.includes('--build')

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try {
    const existing = existsSync(SYNC_LOG) ? readFileSync(SYNC_LOG, 'utf8') : ''
    writeFileSync(SYNC_LOG, existing + line + '\n')
  } catch { /* non-fatal */ }
}

function die(msg: string, code = 1): never {
  console.error(`\n❌ ${msg}`)
  process.exit(code)
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

async function git(...args: string[]): Promise<string> {
  const result = await $`git ${args}`.text()
  return result.trim()
}

async function gitSafe(...args: string[]): Promise<{ out: string; ok: boolean }> {
  try {
    const out = await git(...args)
    return { out, ok: true }
  } catch (err) {
    return { out: String(err), ok: false }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log('=== sync-upstream start ===')

  if (DRY_RUN) {
    console.log('\n🔍 DRY RUN — no changes will be made\n')
  }

  // ── 1. Ensure clean working tree ──────────────────────────────────────────
  section('1. Checking working tree')

  const status = await git('status', '--porcelain')
  if (status && !DRY_RUN) {
    die(
      'Working tree is dirty. Commit or stash your changes before syncing.\n' +
      `Dirty files:\n${status}`
    )
  }
  if (status) {
    console.log('⚠️  Working tree is dirty (ignored in dry-run)')
  } else {
    console.log('✓ Working tree is clean')
  }

  // ── 2. Ensure upstream remote exists ─────────────────────────────────────
  section('2. Checking upstream remote')

  const remotes = await git('remote')
  if (!remotes.split('\n').includes(UPSTREAM_REMOTE)) {
    console.log(`Adding upstream remote: ${UPSTREAM_URL}`)
    if (!DRY_RUN) await git('remote', 'add', UPSTREAM_REMOTE, UPSTREAM_URL)
  } else {
    console.log(`✓ Upstream remote already configured`)
  }

  // ── 3. Fetch upstream ────────────────────────────────────────────────────
  section('3. Fetching upstream')

  if (!DRY_RUN) {
    await git('fetch', UPSTREAM_REMOTE, '--tags')
  }
  console.log(`✓ Fetched ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`)

  // ── 4. Check how far behind we are ──────────────────────────────────────
  section('4. Comparing with upstream')

  const behind = await git(
    'rev-list', `HEAD..${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`, '--count'
  )
  const ahead = await git(
    'rev-list', `${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}..HEAD`, '--count'
  )
  const upstreamSha = await git('rev-parse', `${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`)

  console.log(`  Upstream SHA : ${upstreamSha.slice(0, 12)}`)
  console.log(`  Behind by    : ${behind} commits`)
  console.log(`  Ahead by     : ${ahead} commits (your fork additions)`)

  if (behind === '0') {
    console.log('\n✅ Already up to date with upstream. Nothing to merge.')
    log('Already up to date')

    if (BUILD) {
      await runBuild()
    }
    return
  }

  // ── 5. Merge upstream ────────────────────────────────────────────────────
  section(`5. Merging upstream/${UPSTREAM_BRANCH}`)

  if (DRY_RUN) {
    console.log(`Would merge: ${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`)
    return
  }

  const mergeResult = await gitSafe(
    'merge',
    `${UPSTREAM_REMOTE}/${UPSTREAM_BRANCH}`,
    '--no-edit',
    '-m',
    `chore: sync upstream ${upstreamSha.slice(0, 12)}`,
  )

  if (!mergeResult.ok) {
    // Check for conflicts
    const conflicted = await git('diff', '--name-only', '--diff-filter=U')
    if (conflicted) {
      die(
        `Merge conflicts detected in:\n${conflicted}\n\n` +
        `Your patches conflict with upstream changes.\n` +
        `Resolve conflicts, then:\n` +
        `  git add .\n` +
        `  git commit\n` +
        `  bun run scripts/update-patches.ts   # regenerate patches\n` +
        `  bun run scripts/sync-upstream.ts    # re-run sync`
      )
    }
    die(`Merge failed:\n${mergeResult.out}`)
  }

  console.log('✓ Merge complete')
  log(`Merged upstream ${upstreamSha.slice(0, 12)}`)

  // ── 6. Reinstall dependencies (patch-package runs via postinstall) ────────
  section('6. Installing dependencies + applying patches')

  await $`bun install`
  console.log('✓ Dependencies installed and patches applied')

  // ── 7. Verify patches ────────────────────────────────────────────────────
  section('7. Verifying patches')

  await $`bun run scripts/verify-patches.ts`
  console.log('✓ All patches verified')

  // ── 8. Type-check ────────────────────────────────────────────────────────
  section('8. Type-checking')

  try {
    await $`bun run typecheck`
    console.log('✓ TypeScript OK')
  } catch (err) {
    die(
      `TypeScript errors after merge. Upstream likely changed types that\n` +
      `your packages depend on. Fix the errors in packages/beads-provider/\n` +
      `then re-run this script.\n\nDetails:\n${err}`
    )
  }

  // ── 9. Push fork ─────────────────────────────────────────────────────────
  section('9. Pushing fork')

  await git('push', 'origin', FORK_BRANCH)
  console.log(`✓ Pushed to origin/${FORK_BRANCH}`)
  log(`Pushed after syncing upstream ${upstreamSha.slice(0, 12)}`)

  // ── 10. Optional build ───────────────────────────────────────────────────
  if (BUILD) {
    await runBuild()
  }

  section('✅ Sync complete')
  console.log(`\nUpstream merged: ${behind} commit(s)`)
  console.log(`Upstream SHA: ${upstreamSha.slice(0, 12)}`)
  if (!BUILD) {
    console.log('\nTo build the app:')
    console.log('  bun run build:desktop')
    console.log('  # or: bun run scripts/sync-upstream.ts --build')
  }
}

async function runBuild() {
  section('Building desktop app')
  await $`bun run build:desktop`
  console.log('✓ Build complete')
  const dmgFiles = await $`find dist -name "*.dmg" 2>/dev/null`.text()
  if (dmgFiles.trim()) {
    console.log(`\nDMG artifacts:`)
    dmgFiles.trim().split('\n').forEach(f => console.log(`  ${f}`))
  }
}

main().catch(err => {
  console.error('\n💥 Unexpected error:', err)
  process.exit(1)
})
