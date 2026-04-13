/**
 * @superset/beads-provider
 *
 * Self-contained beads_rust (br) integration for Superset.
 * Exports a single TaskProvider that can be registered with the
 * Superset provider registry.
 *
 * This package has ZERO knowledge of Superset internals.
 * It only depends on @superset/task-provider for the interface.
 *
 * Registration (in bootstrap.ts):
 *   import { beadsProvider } from '@superset/beads-provider'
 *   registerTaskProvider(beadsProvider)
 */

import type { TaskProvider } from '@superset/task-provider'
import { beadsRouter } from './router'
import { BeadsTasksSection } from './ui/BeadsTasksSection'
import {
  maybeImportBeadsAfterPull,
  maybeFlushBeadsBeforeCommit,
  maybeInitBeadsOnWorkspaceCreate,
  maybeFlushBeadsOnWorkspaceDestroy,
} from './lib/git-hooks'

export { beadsRouter } from './router'
export type { BeadsIssue, NormalisedBeadsTask } from './router/types'

export const beadsProvider: TaskProvider = {
  id: 'beads',
  displayName: 'Beads',
  router: beadsRouter,
  SidebarSection: BeadsTasksSection,
  gitHooks: {
    afterPull: maybeImportBeadsAfterPull,
    beforeCommit: maybeFlushBeadsBeforeCommit,
    onWorkspaceCreate: maybeInitBeadsOnWorkspaceCreate,
    onWorkspaceDestroy: maybeFlushBeadsOnWorkspaceDestroy,
  },
}
