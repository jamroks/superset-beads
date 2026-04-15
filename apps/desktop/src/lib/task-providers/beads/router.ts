import { exec } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { TRPCError } from '@trpc/server'
import { publicProcedure, router } from 'lib/trpc'
import { z } from 'zod'
import { BeadsIssueSchema, normaliseIssue } from './types'

const execAsync = promisify(exec)

async function resolveBr(): Promise<string> {
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
    const resolved = stdout.trim()
    if (resolved) return resolved
  } catch {}

  throw new TRPCError({
    code: 'PRECONDITION_FAILED',
    message:
      '`br` binary not found. Install beads_rust: https://github.com/Dicklesworthstone/beads_rust',
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
    const message = err instanceof Error ? err.message : String(err)
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message })
  }
}

export function isBeadsInitialised(worktreePath: string): boolean {
  return fs.existsSync(path.join(worktreePath, '.beads', 'beads.db'))
}

export const beadsRouter = router({
  status: publicProcedure
    .input(z.object({ worktreePath: z.string() }))
    .query(async ({ input }) => {
      let brAvailable = false
      let brVersion: string | null = null

      try {
        const br = await resolveBr()
        const { stdout } = await execAsync(`${br} --version`)
        brAvailable = true
        brVersion = stdout.trim()
      } catch {}

      return {
        brAvailable,
        brVersion,
        initialised: isBeadsInitialised(input.worktreePath),
      }
    }),

  init: publicProcedure
    .input(
      z.object({
        worktreePath: z.string(),
        prefix: z.string().optional().default('bd'),
      }),
    )
    .mutation(async ({ input }) => {
      if (isBeadsInitialised(input.worktreePath)) {
        return { success: true, alreadyInitialised: true }
      }
      await runBr(input.worktreePath, ['init', '--prefix', input.prefix])
      return { success: true, alreadyInitialised: false }
    }),

  list: publicProcedure
    .input(
      z.object({
        worktreePath: z.string(),
        status: z
          .enum(['open', 'in_progress', 'blocked', 'closed', 'cancelled', 'all'])
          .optional()
          .default('open'),
        priority: z.number().int().min(0).max(4).optional(),
        assignee: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      if (!isBeadsInitialised(input.worktreePath)) return []

      const args = ['list']
      if (input.status !== 'all') args.push('--status', input.status)
      if (input.priority !== undefined) args.push('--priority', String(input.priority))
      if (input.assignee) args.push('--assignee', input.assignee)

      const raw = await runBr(input.worktreePath, args)
      return z.array(BeadsIssueSchema).parse(raw).map(normaliseIssue)
    }),

  ready: publicProcedure
    .input(z.object({ worktreePath: z.string() }))
    .query(async ({ input }) => {
      if (!isBeadsInitialised(input.worktreePath)) return []
      const raw = await runBr(input.worktreePath, ['ready'])
      return z.array(BeadsIssueSchema).parse(raw).map(normaliseIssue)
    }),

  show: publicProcedure
    .input(z.object({ worktreePath: z.string(), issueId: z.string() }))
    .query(async ({ input }) => {
      const raw = await runBr(input.worktreePath, ['show', input.issueId])
      return normaliseIssue(BeadsIssueSchema.parse(raw))
    }),

  create: publicProcedure
    .input(
      z.object({
        worktreePath: z.string(),
        title: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(['bug', 'feature', 'task', 'chore', 'docs']).optional(),
        priority: z.number().int().min(0).max(4).optional().default(2),
        assignee: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
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

  update: publicProcedure
    .input(
      z.object({
        worktreePath: z.string(),
        issueId: z.string(),
        status: z.enum(['open', 'in_progress', 'blocked', 'closed', 'cancelled']).optional(),
        priority: z.number().int().min(0).max(4).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        assignee: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
    )
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

  close: publicProcedure
    .input(
      z.object({
        worktreePath: z.string(),
        issueId: z.string(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const args = ['close', input.issueId]
      if (input.reason) args.push('--reason', input.reason)
      const raw = await runBr(input.worktreePath, args)
      return normaliseIssue(BeadsIssueSchema.parse(raw))
    }),

  dependency: router({
    add: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          issueId: z.string(),
          blockedBy: z.string(),
        }),
      )
      .mutation(async ({ input }) => {
        await runBr(input.worktreePath, ['dep', 'add', input.issueId, input.blockedBy])
        return { success: true }
      }),

    remove: publicProcedure
      .input(
        z.object({
          worktreePath: z.string(),
          issueId: z.string(),
          blockedBy: z.string(),
        }),
      )
      .mutation(async ({ input }) => {
        await runBr(input.worktreePath, ['dep', 'remove', input.issueId, input.blockedBy])
        return { success: true }
      }),
  }),

  sync: publicProcedure
    .input(z.object({ worktreePath: z.string() }))
    .mutation(async ({ input }) => {
      await runBr(input.worktreePath, ['sync', '--flush-only'])
      return { success: true }
    }),

  import: publicProcedure
    .input(z.object({ worktreePath: z.string() }))
    .mutation(async ({ input }) => {
      await runBr(input.worktreePath, ['sync', '--import-only'])
      return { success: true }
    }),

  doctor: publicProcedure
    .input(z.object({ worktreePath: z.string() }))
    .query(async ({ input }) => {
      return runBr(input.worktreePath, ['doctor'])
    }),
})
