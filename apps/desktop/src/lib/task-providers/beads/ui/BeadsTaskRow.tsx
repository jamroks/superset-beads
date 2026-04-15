import { useState } from 'react'
import type { NormalisedTask, TaskStatus } from '@superset/task-provider'

interface BeadsTaskRowProps {
  task: NormalisedTask
  priorityColour: string
  priorityLabel: string
  onStatusChange: (status: TaskStatus) => Promise<void>
}

const STATUS_ICONS: Record<TaskStatus, string> = {
  open: '○',
  in_progress: '◉',
  blocked: '⛔',
  closed: '✓',
  cancelled: '✗',
}

const STATUSES: TaskStatus[] = ['open', 'in_progress', 'blocked', 'closed', 'cancelled']

export function BeadsTaskRow({
  task,
  priorityColour,
  priorityLabel,
  onStatusChange,
}: BeadsTaskRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function change(status: TaskStatus) {
    setMenuOpen(false)
    setBusy(true)
    try {
      await onStatusChange(status)
    } finally {
      setBusy(false)
    }
  }

  const dimmed = task.status === 'closed' || task.status === 'cancelled'

  return (
    <div
      className={`group relative flex items-center gap-2 px-3 py-1 transition-colors hover:bg-muted/50 ${
        dimmed ? 'opacity-50' : ''
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${priorityColour}`} title={priorityLabel} />

      <div className="relative shrink-0">
        <button
          className="w-5 text-center text-xs text-muted-foreground hover:text-foreground"
          disabled={busy}
          onClick={() => setMenuOpen((value) => !value)}
          title="Change status"
          type="button"
        >
          {busy ? '…' : STATUS_ICONS[task.status]}
        </button>

        {menuOpen ? (
          <div className="absolute left-0 top-full z-50 mt-1 rounded-md border border-border bg-popover shadow-md">
            {STATUSES.map((status) => (
              <button
                className="flex w-full whitespace-nowrap items-center gap-2 px-3 py-1.5 text-xs capitalize hover:bg-muted"
                key={status}
                onClick={() => void change(status)}
                type="button"
              >
                <span>{STATUS_ICONS[status]}</span>
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <span
        className={`flex-1 truncate text-xs ${dimmed ? 'line-through text-muted-foreground' : ''}`}
        title={task.title}
      >
        {task.ready ? (
          <span className="mr-1 text-yellow-400" title="Ready — not blocked">
            ⚡
          </span>
        ) : null}
        {task.title}
      </span>

      <span className="shrink-0 font-mono text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60">
        {task.sourceId}
      </span>

      {task.blockedBy.length > 0 ? (
        <span
          className="shrink-0 rounded bg-destructive/20 px-1 text-[10px] text-destructive"
          title={`Blocked by: ${task.blockedBy.join(', ')}`}
        >
          ⛔{task.blockedBy.length}
        </span>
      ) : null}
    </div>
  )
}
