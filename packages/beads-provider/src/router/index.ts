/**
 * beadsRouter
 *
 * tRPC router for the beads_rust (br) integration.
 * All procedures invoke the `br` CLI binary with --json and parse output
 * through Zod schemas.
 *
 * Mounted at: trpc.beads.* (via the provider registry)
 */

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import { router, procedure } from '../../../../apps/desktop/src/lib/trpc/trpc'
import { TRPCError } from '@trpc/server'
import { BeadsIssueSchema, normaliseIssue } from './types'

const execAsync = promisify(exec)

// ─── br binary resolution ────────────────────────────────────────────────────

async function resolveBr(): Promise<string> {
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
    const resolved = stdout.trim()
    if (resolved) return resolved
  } catch { /* not in PATH */ }

  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message:
      '`br` binary not found. Install beads_rust: ' +
      'https://github.com/Dicklesworthstone/beads_rust',
  })
}

async function runBr(worktreePath: string, args: string[]): Promise<unknown> {
  const br = await resolveBr()
  const cmd = [br, ...args, '--json'].join(' ')

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: worktreePath,
      env: { ...process.env },
      timeout: 10_000,
    })

    if (!stdout.trim() && stderr) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `br error: ${stderr.trim()}`,
      })
    }

    return JSON.parse(stdout.trim())
  } catch (err) {
    if (err instanceof TRPCError) throw err
    const msg = err instanceof Error ? err.message : String(err)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: msg })
  }
}

export function isBeadsInitialised(worktreePath: string): boolean {
  return fs.existsSync(path.join(worktreePath, '.beads', 'beads.db'))
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const beadsRouter = router({

  status: procedure
    .input(z.object({ worktreePath: z.string() }))
    .query(async ({ input }) => {
      let brAvailable = false
      let brVersion: string | null = null

      try {
        const br = await resolveBr()
        const { stdout } = await execAsync(`${br} --version`)
        brAvailable = true
        brVersion = stdout.trim()
      } catch { /* br not installed */ }

      return {
        brAvailable,
        brVersion,
        initialised: isBeadsInitialised(input.worktreePath),
      }
    }),

  init: procedure
    .input(z.object({
      worktreePath: z.string(),
      prefix: z.string().optional().default('bd'),
    }))
    .mutation(async ({ input }) => {
      if (isBeadsInitialised(input.worktreePath)) {
        return { success: true, alreadyInitialised: true }
      }
      await runBr(input.worktreePath, ['init', '--prefix', input.prefix])
      return { success: true, alreadyInitialised: false }
    }),

  list: procedure
    .input(z.object({
      worktreePath: z.string(),
      status: z.enum(['open', 'in_progress', 'blocked', 'closed', 'cancelled', 'all'])
        .optional().default('open'),
      priority: z.number().int().min(0).max(4).optional(),
      assignee: z.string().optional(),
    }))
    .query(async ({ input }) => {
      if (!isBeadsInitialised(input.worktreePath)) return []

      const args = ['list']
      if (input.status !== 'all') args.push('--status', input.status)
      if (input.priority !== undefined) args.push('--priority', String(input.priority))
      if (input.assignee) args.push('--assignee', input.assignee)

      const raw = await runBr(input.worktreePath, args)
      return z.array(BeadsIssueSchema).parse(raw).map(normaliseIssue)
    }),

  ready: procedure
    .input(z.object({ worktreePath: z.string() }))
    .query(async ({ input }) => {
      if (!isBeadsInitialised(input.worktreePath)) return []
      const raw = await runBr(input.worktreePath, ['ready'])
      return z.array(BeadsIssueSchema).parse(raw).map(normaliseIssue)
    }),

  show: procedure
    .input(z.object({ worktreePath: z.string(), issueId: z.string() }))
    .query(async ({ input }) => {
      const raw = await runBr(input.worktreePath, ['show', input.issueId])
      return normaliseIssue(BeadsIssueSchema.parse(raw))
    }),

  create: procedure
    .input(z.object({
      worktreePath: z.string(),
      title: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(['bug', 'feature', 'task', 'chore', 'docs']).optional(),
      priority: z.number().int().min(0).max(4).optional().default(2),
      assignee: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const args = ['create', input.title]
      if (input.type) args.push('--type', input.type)
      args.push('--priority', String(input.priority))
      if (input.assignee) args.push('--assignee', input.assignee)
      if (input.description) args.push('--description', input.description)
      if (input.tags?.length) args.push('--tags', input.tags.join(','))

      const raw = await runBr(input.worktreePath, args)
      return normaliseIssue(BeadsIssueSchema.parse(raw))
    }),

  update: procedure
    .input(z.object({
      worktreePath: z.string(),
      issueId: z.string(),
      status: z.enum(['open', 'in_progress', 'blocked', 'closed', 'cancelled']).optional(),
      priority: z.number().int().min(0).max(4).optional(),
      title: z.string().optional(),
      description: z.string().optional(),
      assignee: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const args = ['update', input.issueId]
      if (input.status) args.push('--status', input.status)
      if (input.priority !== undefined) args.push('--priority', String(input.priority))
      if (input.title) args.push('--title', input.title)
      if (input.description) args.push('--description', input.description)
      if (input.assignee) args.push('--assignee', input.assignee)
      if (input.tags?.length) args.push('--tags', input.tags.join(','))

      const raw = await runBr(input.worktreePath, args)
      return normaliseIssue(BeadsIssueSchema.parse(raw))
    }),

  close: procedure
    .input(z.object({
      worktreePath: z.string(),
      issueId: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const args = ['close', input.issueId]
      if (input.reason) args.push('--reason', input.reason)
      const raw = await runBr(input.worktreePath, args)
      return normaliseIssue(BeadsIssueSchema.parse(raw))
    }),

  dependency: router({
    add: procedure
      .input(z.object({
        worktreePath: z.string(),
        issueId: z.string(),
        blockedBy: z.string(),
      }))
      .mutation(async ({ input }) => {
        await runBr(input.worktreePath, ['dep', 'add', input.issueId, input.blockedBy])
        return { success: true }
      }),

    remove: procedure
      .input(z.object({
        worktreePath: z.string(),
        issueId: z.string(),
        blockedBy: z.string(),
      }))
      .mutation(async ({ input }) => {
        await runBr(input.worktreePath, ['dep', 'remove', input.issueId, input.blockedBy])
        return { success: true }
      }),
  }),

  sync: procedure
    .input(z.object({ worktreePath: z.string() }))
    .mutation(async ({ input }) => {
      await runBr(input.worktreePath, ['sync', '--flush-only'])
      return { success: true }
    }),

  import: procedure
    .input(z.object({ worktreePath: z.string() }))
    .mutation(async ({ input }) => {
      await runBr(input.worktreePath, ['sync', '--import-only'])
      return { success: true }
    }),

  doctor: procedure
    .input(z.object({ worktreePath: z.string() }))
    .query(async ({ input }) => {
      return runBr(input.worktreePath, ['doctor'])
    }),
})
