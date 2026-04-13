/**
 * Task Provider Registry
 *
 * The central registry that decouples Superset's core from any specific
 * task provider. All providers register here at bootstrap time.
 *
 * File: apps/desktop/src/lib/task-providers/registry.ts
 *
 * Core consuming sites:
 *   - apps/desktop/src/lib/trpc/routers/index.ts  (router mounting)
 *   - apps/desktop/src/renderer/.../TasksView.tsx  (UI rendering)
 *   - apps/desktop/src/main/lib/git-hooks.ts       (git lifecycle)
 */

import type { TaskProvider, ProviderRegistry } from '@superset/task-provider'

const registry: ProviderRegistry = new Map()

/**
 * Register a task provider. Call this in bootstrap.ts before the app starts.
 * Throws if a provider with the same id is already registered.
 */
export function registerTaskProvider(provider: TaskProvider): void {
  if (registry.has(provider.id)) {
    throw new Error(
      `[task-providers] Provider with id "${provider.id}" is already registered. ` +
      `Each provider id must be unique.`
    )
  }
  registry.set(provider.id, provider)
  console.debug(`[task-providers] Registered provider: ${provider.id}`)
}

/**
 * Get all registered providers in registration order.
 */
export function getTaskProviders(): TaskProvider[] {
  return Array.from(registry.values())
}

/**
 * Get a specific provider by id. Returns undefined if not registered.
 */
export function getTaskProvider(id: string): TaskProvider | undefined {
  return registry.get(id)
}

/**
 * Get all tRPC routers from registered providers.
 * Used by the root tRPC router to mount provider routes at trpc.<id>.*
 *
 * Example output: { beads: beadsRouter, linear: linearRouter }
 */
export function getProviderRouters(): Record<string, TaskProvider['router']> {
  return Object.fromEntries(
    Array.from(registry.entries()).map(([id, p]) => [id, p.router])
  )
}

/**
 * Run a git hook across all registered providers that implement it.
 * All hooks run in parallel; individual failures are caught and logged.
 * The returned Promise always resolves (never rejects).
 */
export async function runGitHook(
  hook: keyof NonNullable<TaskProvider['gitHooks']>,
  worktreePath: string,
): Promise<void> {
  const providers = getTaskProviders().filter(p => p.gitHooks?.[hook])

  await Promise.allSettled(
    providers.map(async p => {
      try {
        await p.gitHooks![hook]!(worktreePath)
      } catch (err) {
        console.warn(`[task-providers] git hook "${hook}" failed for provider "${p.id}":`, err)
      }
    })
  )
}
