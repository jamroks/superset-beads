import React, { useState } from 'react'
import { trpc } from '../../../../apps/desktop/src/renderer/lib/trpc'

// ─── BeadsInitPrompt ─────────────────────────────────────────────────────────

interface BeadsInitPromptProps {
  worktreePath: string
  onDone: () => void
}

export function BeadsInitPrompt({ worktreePath, onDone }: BeadsInitPromptProps) {
  const initM = trpc.beads.init.useMutation({ onSuccess: onDone })

  return (
    <div className="mx-3 my-2 rounded-md border border-dashed border-border p-3 text-xs space-y-2">
      <p className="font-medium">Beads not initialised</p>
      <p className="text-muted-foreground">
        Add a local issue tracker to this worktree. Issues are stored in{' '}
        <code className="rounded bg-muted px-1">.beads/</code> and committed with your code.
      </p>
      <button
        className="w-full rounded bg-primary py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        onClick={() => initM.mutate({ worktreePath })}
        disabled={initM.isPending || !worktreePath}
      >
        {initM.isPending ? 'Initialising…' : 'Initialise beads in this worktree'}
      </button>
      {initM.isError && (
        <p className="text-destructive text-[10px]">{initM.error.message}</p>
      )}
    </div>
  )
}

// ─── BeadsNotInstalledBanner ──────────────────────────────────────────────────

export function BeadsNotInstalledBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="mx-3 my-1 flex items-center justify-between gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-600 dark:text-yellow-400">
      <span>
        <code>br</code> not installed.{' '}
        <a
          href="https://github.com/Dicklesworthstone/beads_rust"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Install beads_rust
        </a>
      </span>
      <button onClick={() => setDismissed(true)} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
    </div>
  )
}
