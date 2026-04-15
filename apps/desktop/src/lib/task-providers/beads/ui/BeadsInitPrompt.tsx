import { electronTrpc } from 'renderer/lib/electron-trpc'

interface BeadsInitPromptProps {
  worktreePath: string
  onDone: () => void
}

export function BeadsInitPrompt({ worktreePath, onDone }: BeadsInitPromptProps) {
  const initMutation = electronTrpc.beads.init.useMutation({ onSuccess: onDone })

  return (
    <div className="mx-3 my-2 space-y-2 rounded-md border border-dashed border-border p-3 text-xs">
      <p className="font-medium">Beads not initialised</p>
      <p className="text-muted-foreground">
        Add a local issue tracker to this workspace. Issues are stored in{' '}
        <code className="rounded bg-muted px-1">.beads/</code> and committed with your code.
      </p>
      <button
        className="w-full rounded bg-primary py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        disabled={initMutation.isPending || !worktreePath}
        onClick={() => initMutation.mutate({ worktreePath })}
        type="button"
      >
        {initMutation.isPending ? 'Initialising…' : 'Initialise beads in this workspace'}
      </button>
      {initMutation.isError ? (
        <p className="text-[10px] text-destructive">{initMutation.error.message}</p>
      ) : null}
    </div>
  )
}

export function BeadsNotInstalledBanner() {
  return (
    <div className="mx-3 my-1 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-600 dark:text-yellow-400">
      <span>
        <code>br</code> not installed.{' '}
        <a
          className="underline"
          href="https://github.com/Dicklesworthstone/beads_rust"
          rel="noreferrer"
          target="_blank"
        >
          Install beads_rust
        </a>
      </span>
    </div>
  )
}
