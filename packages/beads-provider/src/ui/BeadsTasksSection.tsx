/**
 * BeadsTasksSection
 *
 * Self-contained React component for the Beads tasks panel.
 * Reads workspace context from useActiveWorkspace() — receives no props.
 * This is the component registered as provider.SidebarSection.
 */

import React, { useState } from 'react'
import { trpc } from '../../../../apps/desktop/src/renderer/lib/trpc'
import { useActiveWorkspace } from '../../../../apps/desktop/src/renderer/hooks/useActiveWorkspace'
import { BeadsTaskRow } from './BeadsTaskRow'
import { BeadsInitPrompt } from './BeadsInitPrompt'
import { BeadsNotInstalledBanner } from './BeadsNotInstalledBanner'

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Critical', 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Backlog',
}
const PRIORITY_COLOURS: Record<number, string> = {
  0: 'bg-red-500', 1: 'bg-orange-400', 2: 'bg-yellow-400',
  3: 'bg-blue-400', 4: 'bg-muted-foreground',
}

export function BeadsTasksSection() {
  const workspace = useActiveWorkspace()
  const worktreePath = workspace?.worktreePath ?? ''

  const [open, setOpen] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'ready'>('all')
  const [syncing, setSyncing] = useState(false)

  // New issue form state
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState('2')
  const [newType, setNewType] = useState('task')

  const utils = trpc.useUtils()

  const invalidate = () => {
    utils.beads.list.invalidate({ worktreePath })
    utils.beads.ready.invalidate({ worktreePath })
    utils.beads.status.invalidate({ worktreePath })
  }

  const statusQ = trpc.beads.status.useQuery(
    { worktreePath },
    { enabled: !!worktreePath },
  )
  const listQ = trpc.beads.list.useQuery(
    { worktreePath, status: 'open' },
    { enabled: !!worktreePath && !!statusQ.data?.initialised, refetchInterval: 30_000 },
  )
  const readyQ = trpc.beads.ready.useQuery(
    { worktreePath },
    { enabled: !!worktreePath && !!statusQ.data?.initialised, refetchInterval: 30_000 },
  )

  const createM = trpc.beads.create.useMutation({ onSuccess: invalidate })
  const updateM = trpc.beads.update.useMutation({ onSuccess: invalidate })
  const closeM  = trpc.beads.close.useMutation({ onSuccess: invalidate })
  const syncM   = trpc.beads.sync.useMutation()
  const importM = trpc.beads.import.useMutation({ onSuccess: invalidate })

  // ── Early returns ────────────────────────────────────────────────────────────
  if (!statusQ.data?.brAvailable) return <BeadsNotInstalledBanner />
  if (!statusQ.data?.initialised) return <BeadsInitPrompt worktreePath={worktreePath} onDone={invalidate} />

  // ── Handlers ─────────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await createM.mutateAsync({
      worktreePath,
      title: newTitle.trim(),
      priority: parseInt(newPriority, 10),
      type: newType as 'bug' | 'feature' | 'task' | 'chore' | 'docs',
    })
    setNewTitle('')
    setShowForm(false)
  }

  async function handleSync() {
    setSyncing(true)
    try { await syncM.mutateAsync({ worktreePath }) }
    finally { setSyncing(false) }
  }

  const tasks = (filter === 'ready' ? readyQ.data : listQ.data) ?? []
  const isLoading = listQ.isLoading || readyQ.isLoading

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <button
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setOpen(v => !v)}
        >
          <span className="text-[10px]">{open ? '▼' : '▶'}</span>
          <span>🔵 Beads</span>
          <span className="ml-1 rounded-full bg-muted px-1.5 py-px text-[10px] font-mono">
            {listQ.data?.length ?? 0}
          </span>
        </button>

        <div className="flex items-center gap-0.5">
          {/* Ready filter toggle */}
          <button
            title={filter === 'ready' ? 'Show all' : 'Show ready only'}
            className={`h-6 w-6 rounded text-[10px] font-bold transition-colors ${
              filter === 'ready' ? 'bg-yellow-400/20 text-yellow-400' : 'text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setFilter(f => f === 'ready' ? 'all' : 'ready')}
          >⚡</button>

          {/* Import */}
          <button
            title="Import from JSONL (after git pull)"
            className="h-6 w-6 rounded text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => importM.mutate({ worktreePath })}
          >↓</button>

          {/* Flush */}
          <button
            title="Flush to JSONL (for git commit)"
            className="h-6 w-6 rounded text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleSync}
            disabled={syncing}
          >{syncing ? '…' : '↑'}</button>

          {/* New issue */}
          <button
            title="New issue"
            className="h-6 w-6 rounded text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowForm(v => !v)}
          >＋</button>
        </div>
      </div>

      {open && (
        <>
          {/* New issue form */}
          {showForm && (
            <form onSubmit={handleCreate} className="mx-3 mb-2 space-y-1.5 rounded-md border border-border bg-muted/40 p-2">
              <input
                autoFocus
                className="w-full rounded border border-border bg-background px-2 py-1 text-xs"
                placeholder="Issue title…"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
              />
              <div className="flex gap-1.5">
                <select
                  className="h-6 rounded border border-border bg-background px-1 text-xs"
                  value={newPriority}
                  onChange={e => setNewPriority(e.target.value)}
                >
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <select
                  className="h-6 flex-1 rounded border border-border bg-background px-1 text-xs"
                  value={newType}
                  onChange={e => setNewType(e.target.value)}
                >
                  {['bug', 'feature', 'task', 'chore', 'docs'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-1.5">
                <button type="button" className="h-6 rounded px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="h-6 rounded bg-primary px-2 text-xs text-primary-foreground" disabled={!newTitle.trim()}>Create</button>
              </div>
            </form>
          )}

          {/* Task list */}
          {isLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
          ) : tasks.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              {filter === 'ready' ? 'No ready issues' : 'No open issues'}
            </p>
          ) : (
            <div className="space-y-px">
              {tasks.map(task => (
                <BeadsTaskRow
                  key={task.id}
                  task={task}
                  priorityColour={PRIORITY_COLOURS[task.priority] ?? 'bg-muted'}
                  priorityLabel={PRIORITY_LABELS[task.priority] ?? ''}
                  onStatusChange={async status => {
                    if (status === 'closed') {
                      await closeM.mutateAsync({ worktreePath, issueId: task.sourceId })
                    } else {
                      await updateM.mutateAsync({ worktreePath, issueId: task.sourceId, status })
                    }
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
