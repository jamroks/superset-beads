/**
 * bootstrap.ts — Provider registration
 *
 * Main-process only. Registers custom task providers before the desktop app
 * constructs the root tRPC router.
 */

import { registerTaskProvider } from '../lib/task-providers/registry'
import { beadsProvider } from '../lib/task-providers/beads'

registerTaskProvider(beadsProvider)

export {}
