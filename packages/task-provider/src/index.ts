/**
 * @superset/task-provider
 *
 * The shared contract between Superset's core and any task provider
 * (beads, linear, github, or future providers).
 *
 * This package has zero runtime dependencies — it is interface definitions only.
 * Neither Superset core nor any provider imports from the other; both import
 * from here. This is the only thing that keeps them decoupled.
 */

import type { AnyRouter } from '@trpc/server'
import type { ComponentType } from 'react'

// ─── Core task shape ─────────────────────────────────────────────────────────

export type TaskStatus =
  | 'open'
  | 'in_progress'
  | 'blocked'
  | 'closed'
  | 'cancelled'

export type TaskPriority = 0 | 1 | 2 | 3 | 4  // 0=critical, 4=backlog

export type TaskSource = string  // "beads" | "linear" | "github" | custom

/** Normalised task shape all providers must produce */
export interface NormalisedTask {
  /** Globally unique within Superset: "<source>:<sourceId>"  e.g. "beads:bd-abc123" */
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  type?: string
  source: TaskSource
  /** The id as the source system knows it */
  sourceId: string
  /** External URL, or null for local-only sources like beads */
  url: string | null
  createdAt: string
  updatedAt: string
  tags: string[]
  /** sourceIds of issues that block this one */
  blockedBy: string[]
  /** sourceIds of issues this one blocks */
  blocks: string[]
  /** true if status is open/in_progress AND blockedBy is empty */
  ready: boolean
}

// ─── Git lifecycle hooks ──────────────────────────────────────────────────────

export interface ProviderGitHooks {
  /**
   * Called by Superset after a successful `git pull` in a workspace.
   * Use to sync remote state into local storage (e.g. br sync --import-only).
   * Must be non-fatal — errors are logged, not re-thrown.
   */
  afterPull?: (worktreePath: string) => Promise<void>

  /**
   * Called by Superset before staging a commit in a workspace.
   * Use to flush local state to a committable format (e.g. br sync --flush-only).
   * Must be non-fatal.
   */
  beforeCommit?: (worktreePath: string) => Promise<void>

  /**
   * Called when a Superset workspace is first created (worktree checked out).
   * Use for first-run initialisation.
   */
  onWorkspaceCreate?: (worktreePath: string) => Promise<void>

  /**
   * Called when a Superset workspace is destroyed.
   * Use to flush/cleanup before the worktree is deleted.
   */
  onWorkspaceDestroy?: (worktreePath: string) => Promise<void>
}

// ─── The provider contract ────────────────────────────────────────────────────

export interface TaskProvider {
  /**
   * Unique stable identifier. Used as the tRPC router key.
   * Must be a valid JS identifier: lowercase, no hyphens.
   * e.g. "beads", "linear", "github"
   */
  id: string

  /** Human-readable name shown in the UI */
  displayName: string

  /**
   * tRPC router exposing this provider's procedures.
   * Mounted at trpc.<id>.* in the root router.
   */
  router: AnyRouter

  /**
   * React component that can be used by the renderer host to display this
   * provider in the Tasks sidebar. In practice the desktop host may choose to
   * render provider sections explicitly rather than via this field, because
   * renderer and main process module state are isolated in Electron.
   */
  SidebarSection: ComponentType

  /**
   * Optional git lifecycle hooks. All are fire-and-forget from Superset's
   * perspective — returning a rejected promise logs a warning but does not
   * interrupt the git operation.
   */
  gitHooks?: ProviderGitHooks
}

// ─── Registry API (consumed by the provider registry module) ─────────────────

export type ProviderRegistry = Map<string, TaskProvider>
