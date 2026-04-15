/**
 * Main-process task provider registry.
 *
 * This registry is intentionally main-process only. It is consumed by the root
 * tRPC router and, later, optional git lifecycle hooks.
 */

import type { TaskProvider, ProviderRegistry } from '@superset/task-provider'

const registry: ProviderRegistry = new Map()

export function registerTaskProvider(provider: TaskProvider): void {
  if (registry.has(provider.id)) {
    throw new Error(
      `[task-providers] Provider with id "${provider.id}" is already registered. ` +
        'Each provider id must be unique.',
    )
  }

  registry.set(provider.id, provider)
  console.debug(`[task-providers] Registered provider: ${provider.id}`)
}

export function getTaskProviders(): TaskProvider[] {
  return [...registry.values()]
}

export function getTaskProvider(id: string): TaskProvider | undefined {
  return registry.get(id)
}

export function getProviderRouters(): Record<string, TaskProvider['router']> {
  const entries = [...registry.entries()].map(
    ([id, provider]) => [id, provider.router] as const,
  )
  return Object.fromEntries(entries)
}

export async function runGitHook(
  hook: keyof NonNullable<TaskProvider['gitHooks']>,
  worktreePath: string,
): Promise<void> {
  const providers = getTaskProviders().filter((provider) => provider.gitHooks?.[hook])

  await Promise.allSettled(
    providers.map(async (provider) => {
      try {
        await provider.gitHooks?.[hook]?.(worktreePath)
      } catch (err) {
        console.warn(
          `[task-providers] git hook "${String(hook)}" failed for provider "${provider.id}":`,
          err,
        )
      }
    }),
  )
}
