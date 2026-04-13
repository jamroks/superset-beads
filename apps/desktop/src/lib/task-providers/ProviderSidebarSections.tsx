/**
 * ProviderSidebarSections
 *
 * Renders the SidebarSection component from every registered task provider.
 * This is injected into TasksView.tsx via patch 003.
 *
 * File: apps/desktop/src/renderer/.../lib/task-providers/ProviderSidebarSections.tsx
 *
 * When upstream merges the registry PR, this component becomes part of
 * upstream's TasksView directly, and the patch is deleted.
 */

import React from 'react'
import { getTaskProviders } from './registry'

export function ProviderSidebarSections() {
  const providers = getTaskProviders()

  if (providers.length === 0) return null

  return (
    <>
      {providers.map(provider => {
        const Section = provider.SidebarSection
        return (
          <div key={provider.id} className="border-t border-border pt-px">
            <Section />
          </div>
        )
      })}
    </>
  )
}
