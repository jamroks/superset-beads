import { exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

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

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate
  }

  try {
    const { stdout } = await execAsync('which br')
    return stdout.trim() || null
  } catch {
    return null
  }
}

async function runBrSafe(worktreePath: string, args: string[], label: string): Promise<void> {
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
    console.warn(`[beads] ${label} failed (non-fatal):`, err)
  }
}

export async function maybeImportBeadsAfterPull(worktreePath: string): Promise<void> {
  if (!hasBeads(worktreePath)) return
  await runBrSafe(worktreePath, ['sync', '--import-only'], 'post-pull import')
}

export async function maybeFlushBeadsBeforeCommit(worktreePath: string): Promise<void> {
  if (!hasBeads(worktreePath)) return
  await runBrSafe(worktreePath, ['sync', '--flush-only'], 'pre-commit flush')
}

export async function maybeInitBeadsOnWorkspaceCreate(worktreePath: string): Promise<void> {
  const br = await resolveBr()
  if (!br) return

  if (!hasBeads(worktreePath)) {
    await runBrSafe(worktreePath, ['init', '--prefix', 'bd'], 'workspace-create init')
  }

  if (hasBeadsJsonl(worktreePath)) {
    await runBrSafe(worktreePath, ['sync', '--import-only'], 'workspace-create import')
  }
}

export async function maybeFlushBeadsOnWorkspaceDestroy(worktreePath: string): Promise<void> {
  if (!hasBeads(worktreePath)) return
  await runBrSafe(worktreePath, ['sync', '--flush-only'], 'workspace-destroy flush')
}
