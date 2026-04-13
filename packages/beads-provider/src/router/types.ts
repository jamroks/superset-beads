/**
 * Shared types for the beads tRPC router.
 * Separated so they can be imported without pulling in the full router.
 */

import { z } from 'zod'
import type { NormalisedTask } from '@superset/task-provider'

export const BeadsIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  status: z.enum(['open', 'in_progress', 'blocked', 'closed', 'cancelled']),
  priority: z.number().int().min(0).max(4),
  type: z.enum(['bug', 'feature', 'task', 'chore', 'docs']).optional(),
  assignee: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable().optional(),
  close_reason: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  blocked_by: z.array(z.string()).optional().default([]),
  blocks: z.array(z.string()).optional().default([]),
})

export type BeadsIssue = z.infer<typeof BeadsIssueSchema>

/** NormalisedTask with source fixed to "beads" */
export type NormalisedBeadsTask = NormalisedTask & { source: 'beads' }

export function normaliseIssue(issue: BeadsIssue): NormalisedBeadsTask {
  const ready =
    (issue.status === 'open' || issue.status === 'in_progress') &&
    (issue.blocked_by ?? []).length === 0

  return {
    id: `beads:${issue.id}`,
    title: issue.title,
    description: issue.description ?? null,
    status: issue.status,
    priority: issue.priority as 0 | 1 | 2 | 3 | 4,
    type: issue.type,
    source: 'beads',
    sourceId: issue.id,
    url: null,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    tags: issue.tags ?? [],
    blockedBy: issue.blocked_by ?? [],
    blocks: issue.blocks ?? [],
    ready,
  }
}
