/**
 * bootstrap.ts — Provider registration
 *
 * THIS IS THE ONLY FILE YOU EDIT TO ADD OR REMOVE TASK PROVIDERS.
 *
 * This file runs once at app startup (main process), before the tRPC
 * router is constructed and before any renderer process starts.
 *
 * To add a provider:   import it, call registerTaskProvider()
 * To remove a provider: delete the import and the register call
 *
 * File: apps/desktop/src/main/bootstrap.ts
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * UPSTREAM COMPATIBILITY NOTE
 *
 * This file is part of your fork's additions. It is NOT in upstream Superset.
 * It is called from apps/desktop/src/main/index.ts via the patch:
 *   patches/001-main-bootstrap.patch
 *
 * If your upstream PR for the registry pattern is ever merged, the patch
 * becomes a no-op (bootstrap is already called) and can be deleted.
 * This file itself never conflicts with upstream because upstream doesn't
 * have it.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { registerTaskProvider } from '../lib/task-providers/registry'

// ─── Your providers ──────────────────────────────────────────────────────────
// Add/remove providers here. Order determines display order in the UI.

import { beadsProvider } from '@superset/beads-provider'

registerTaskProvider(beadsProvider)

// ─────────────────────────────────────────────────────────────────────────────
// Future providers — uncomment as you add them:
//
// import { myOtherProvider } from '@superset/my-other-provider'
// registerTaskProvider(myOtherProvider)
// ─────────────────────────────────────────────────────────────────────────────

export {}  // makes this a module
