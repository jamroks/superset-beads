/**
 * Git lifecycle hooks for beads_rust.
 *
 * These are called by Superset's git operation layer via the provider registry.
 * ALL functions are non-fatal by design — a beads failure must never block
 * Superset's core git operations (pull, commit, workspace create/destroy).
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'

const execAsync = promisify(exec)

function hasBeads(worktreePath: string): boolean {
  return fs.existsSync(path.join(worktreePath, '.beads', 'beads.db'))
}

function hasBeadsJsonl(worktreePath: string): boolean {
  return fs.existsSync(path.join(worktreePath, '.beads', 'issues.jsonl'))
}

async function resolveBr(): Promise<string | null> {
  const candidates = [
    process.env.BR_BIN,
    `${process.env.HOME}/.cargo/bin/br`,
    '/usr/local/bin/br',
    '/opt/homebrew/bin/br',
  ].filter(Boolean) as string[]

  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }

  try {
    const { stdout } = await execAsync('which br')
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function runBrSafe(
  worktreePath: string,
  args: string[],
  label: string,
): Promise<void> {
  const br = await resolveBr()
  if (!br) {
    console.debug(`[beads] ${label}: br not found, skipping`)
    return
  }

  try {
    await execAsync([br, ...args].join(' '), {
      cwd: worktreePath,
      timeout: 15_000,
    })
    console.debug(`[beads] ${label}: done (${worktreePath})`)
  } catch (err) {
    // Non-fatal: log and continue
    console.warn(`[beads] ${label} failed (non-fatal):`, err)
  }
}

/**
 * After git pull: import JSONL into local SQLite.
 * Picks up any issues committed by teammates or other worktrees.
 */
export async function maybeImportBeadsAfterPull(worktreePath: string): Promise<void> {
  if (!hasBeads(worktreePath)) return
  await runBrSafe(worktreePath, ['sync', '--import-only'], 'post-pull import')
}

/**
 * Before git commit: flush SQLite → JSONL so issues.jsonl is always
 * up-to-date in git history.
 */
export async function maybeFlushBeadsBeforeCommit(worktreePath: string): Promise<void> {
  if (!hasBeads(worktreePath)) return
  await runBrSafe(worktreePath, ['sync', '--flush-only'], 'pre-commit flush')
}

/**
 * On workspace create: initialise beads if not present, then import JSONL
 * if it already exists (e.g. the branch being checked out has .beads/).
 */
export async function maybeInitBeadsOnWorkspaceCreate(worktreePath: string): Promise<void> {
  const br = await resolveBr()
  if (!br) return

  if (!hasBeads(worktreePath)) {
    await runBrSafe(worktreePath, ['init', '--prefix', 'bd'], 'workspace-create init')
  }

  // If the checked-out branch already has issues.jsonl, import it
  if (hasBeadsJsonl(worktreePath)) {
    await runBrSafe(worktreePath, ['sync', '--import-only'], 'workspace-create import')
  }
}

/**
 * On workspace destroy: flush SQLite → JSONL so in-flight issues are
 * preserved for other worktrees / future sessions.
 */
export async function maybeFlushBeadsOnWorkspaceDestroy(worktreePath: string): Promise<void> {
  if (!hasBeads(worktreePath)) return
  await runBrSafe(worktreePath, ['sync', '--flush-only'], 'workspace-destroy flush')
}
