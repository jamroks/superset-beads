import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { TaskStatus } from '@superset/task-provider'
import { electronTrpc } from 'renderer/lib/electron-trpc'
import { BeadsInitPrompt, BeadsNotInstalledBanner } from './BeadsInitPrompt'
import { BeadsTaskRow } from './BeadsTaskRow'

const PRIORITY_COLOURS: Record<number, string> = {
  0: 'bg-red-500',
  1: 'bg-orange-500',
  2: 'bg-blue-500',
  3: 'bg-green-500',
  4: 'bg-zinc-500',
}

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Critical',
  1: 'High',
  2: 'Medium',
  3: 'Low',
  4: 'Backlog',
}

type WorkspaceOption = {
  id: string
  label: string
  worktreePath: string
}

const STORAGE_KEY = 'superset-beads:selected-workspace'

export function BeadsTasksSection() {
  const [open, setOpen] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ready'>('all')
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('2')
  const [newType, setNewType] = useState('task')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const workspacesQuery = electronTrpc.workspaces.getAllGrouped.useQuery()

  const workspaceOptions = useMemo<WorkspaceOption[]>(() => {
    const groups = workspacesQuery.data ?? []
    const options: WorkspaceOption[] = []

    for (const group of groups) {
      for (const workspace of group.workspaces ?? []) {
        if (workspace.worktreePath) {
          options.push({
            id: workspace.id,
            label: `${group.project.name} / ${workspace.name || workspace.branch}`,
            worktreePath: workspace.worktreePath,
          })
        }
      }

      for (const section of group.sections ?? []) {
        for (const workspace of section.workspaces ?? []) {
          if (workspace.worktreePath) {
            options.push({
              id: workspace.id,
              label: `${group.project.name} / ${section.name} / ${workspace.name || workspace.branch}`,
              worktreePath: workspace.worktreePath,
            })
          }
        }
      }
    }

    return options
  }, [workspacesQuery.data])

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) {
      setSelectedWorkspaceId(stored)
    }
  }, [])

  useEffect(() => {
    if (!selectedWorkspaceId && workspaceOptions.length > 0) {
      setSelectedWorkspaceId(workspaceOptions[0].id)
      return
    }

    if (
      selectedWorkspaceId &&
      workspaceOptions.length > 0 &&
      !workspaceOptions.some((workspace) => workspace.id === selectedWorkspaceId)
    ) {
      setSelectedWorkspaceId(workspaceOptions[0].id)
    }
  }, [selectedWorkspaceId, workspaceOptions])

  useEffect(() => {
    if (selectedWorkspaceId) {
      window.localStorage.setItem(STORAGE_KEY, selectedWorkspaceId)
    }
  }, [selectedWorkspaceId])

  const selectedWorkspace = workspaceOptions.find((workspace) => workspace.id === selectedWorkspaceId) ?? null
  const worktreePath = selectedWorkspace?.worktreePath ?? ''

  const statusQuery = electronTrpc.beads.status.useQuery(
    { worktreePath },
    { enabled: Boolean(worktreePath) },
  )

  const listQuery = electronTrpc.beads.list.useQuery(
    {
      worktreePath,
      status: 'open',
    },
    { enabled: Boolean(worktreePath) && statusQuery.data?.initialised === true },
  )

  const readyQuery = electronTrpc.beads.ready.useQuery(
    { worktreePath },
    { enabled: Boolean(worktreePath) && statusQuery.data?.initialised === true && filter === 'ready' },
  )

  const createMutation = electronTrpc.beads.create.useMutation({
    onSuccess: async () => {
      setNewTitle('')
      setShowForm(false)
      await listQuery.refetch()
      await readyQuery.refetch()
    },
  })

  const updateMutation = electronTrpc.beads.update.useMutation({
    onSuccess: async () => {
      await listQuery.refetch()
      await readyQuery.refetch()
    },
  })

  const closeMutation = electronTrpc.beads.close.useMutation({
    onSuccess: async () => {
      await listQuery.refetch()
      await readyQuery.refetch()
    },
  })

  const importMutation = electronTrpc.beads.import.useMutation({
    onSuccess: async () => {
      await statusQuery.refetch()
      await listQuery.refetch()
      await readyQuery.refetch()
    },
  })

  const syncMutation = electronTrpc.beads.sync.useMutation()

  const tasks = filter === 'ready' ? readyQuery.data ?? [] : listQuery.data ?? []
  const isLoading = statusQuery.isLoading || listQuery.isLoading || readyQuery.isLoading

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!worktreePath || !newTitle.trim()) return

    await createMutation.mutateAsync({
      worktreePath,
      priority: Number(newPriority),
      title: newTitle.trim(),
      type: newType as 'bug' | 'feature' | 'task' | 'chore' | 'docs',
    })
  }

  async function handleSync() {
    if (!worktreePath) return
    setSyncing(true)
    try {
      await syncMutation.mutateAsync({ worktreePath })
    } finally {
      setSyncing(false)
    }
  }

  if (workspacesQuery.isLoading) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">Loading Beads workspaces…</p>
  }

  if (!workspaceOptions.length) {
    return (
      <div className="px-3 py-2 text-xs text-muted-foreground">
        No workspace found yet. Create or open a workspace, then select it here for Beads.
      </div>
    )
  }

  if (!worktreePath) {
    return <p className="px-3 py-2 text-xs text-muted-foreground">Select a workspace for Beads.</p>
  }

  if (statusQuery.data && !statusQuery.data.brAvailable) {
    return <BeadsNotInstalledBanner />
  }

  if (statusQuery.data && !statusQuery.data.initialised) {
    return <BeadsInitPrompt onDone={() => void statusQuery.refetch()} worktreePath={worktreePath} />
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          <span className="text-[10px]">{open ? '▼' : '▶'}</span>
          <span>🔵 Beads</span>
          <span className="ml-1 rounded-full bg-muted px-1.5 py-px text-[10px] font-mono">
            {tasks.length}
          </span>
        </button>

        <div className="flex items-center gap-0.5">
          <button
            className={`h-6 w-6 rounded text-[10px] font-bold transition-colors ${
              filter === 'ready'
                ? 'bg-yellow-400/20 text-yellow-400'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setFilter((value) => (value === 'ready' ? 'all' : 'ready'))}
            title={filter === 'ready' ? 'Show all' : 'Show ready only'}
            type="button"
          >
            ⚡
          </button>

          <button
            className="h-6 w-6 rounded text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => importMutation.mutate({ worktreePath })}
            title="Import from JSONL"
            type="button"
          >
            ↓
          </button>

          <button
            className="h-6 w-6 rounded text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            disabled={syncing}
            onClick={() => void handleSync()}
            title="Flush to JSONL"
            type="button"
          >
            {syncing ? '…' : '↑'}
          </button>

          <button
            className="h-6 w-6 rounded text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowForm((value) => !value)}
            title="New issue"
            type="button"
          >
            ＋
          </button>
        </div>
      </div>

      <div className="px-3 pb-2">
        <select
          className="h-7 w-full rounded border border-border bg-background px-2 text-xs"
          onChange={(event) => setSelectedWorkspaceId(event.target.value)}
          value={selectedWorkspaceId ?? ''}
        >
          {workspaceOptions.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.label}
            </option>
          ))}
        </select>
      </div>

      {open ? (
        <>
          {showForm ? (
            <form
              className="mx-3 mb-2 space-y-1.5 rounded-md border border-border bg-muted/40 p-2"
              onSubmit={(event) => void handleCreate(event)}
            >
              <input
                autoFocus
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Issue title…"
                value={newTitle}
              />
              <div className="flex gap-1.5">
                <select
                  className="h-6 rounded border border-border bg-background px-1 text-xs"
                  onChange={(event) => setNewPriority(event.target.value)}
                  value={newPriority}
                >
                  {Object.entries(PRIORITY_LABELS).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value}
                    </option>
                  ))}
                </select>
                <select
                  className="h-6 flex-1 rounded border border-border bg-background px-1 text-xs"
                  onChange={(event) => setNewType(event.target.value)}
                  value={newType}
                >
                  {['bug', 'feature', 'task', 'chore', 'docs'].map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-1.5">
                <button
                  className="h-6 rounded px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowForm(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-6 rounded bg-primary px-2 text-xs text-primary-foreground"
                  disabled={!newTitle.trim() || createMutation.isPending}
                  type="submit"
                >
                  Create
                </button>
              </div>
            </form>
          ) : null}

          {isLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {filter === 'ready' ? 'No ready issues' : 'No open issues'}
            </p>
          ) : (
            <div className="space-y-px">
              {tasks.map((task) => (
                <BeadsTaskRow
                  key={task.id}
                  onStatusChange={async (status: TaskStatus) => {
                    if (status === 'closed') {
                      await closeMutation.mutateAsync({
                        issueId: task.sourceId,
                        worktreePath,
                      })
                      return
                    }

                    await updateMutation.mutateAsync({
                      issueId: task.sourceId,
                      status,
                      worktreePath,
                    })
                  }}
                  priorityColour={PRIORITY_COLOURS[task.priority] ?? 'bg-muted'}
                  priorityLabel={PRIORITY_LABELS[task.priority] ?? ''}
                  task={task}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
