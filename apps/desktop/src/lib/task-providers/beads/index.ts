import type { TaskProvider } from '@superset/task-provider'
import { beadsRouter } from './router'
import {
  maybeFlushBeadsBeforeCommit,
  maybeFlushBeadsOnWorkspaceDestroy,
  maybeImportBeadsAfterPull,
  maybeInitBeadsOnWorkspaceCreate,
} from './git-hooks'

export { beadsRouter } from './router'
export type { BeadsIssue, NormalisedBeadsTask } from './types'

export const beadsProvider: TaskProvider = {
  id: 'beads',
  displayName: 'Beads',
  router: beadsRouter,
  SidebarSection: () => null,
  gitHooks: {
    afterPull: maybeImportBeadsAfterPull,
    beforeCommit: maybeFlushBeadsBeforeCommit,
    onWorkspaceCreate: maybeInitBeadsOnWorkspaceCreate,
    onWorkspaceDestroy: maybeFlushBeadsOnWorkspaceDestroy,
  },
}
