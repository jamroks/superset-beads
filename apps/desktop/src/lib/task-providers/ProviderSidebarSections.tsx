/**
 * Renderer-side provider sections.
 *
 * Keep this intentionally simple: renderer and main do not share live module
 * state, so we render custom provider sections explicitly here.
 */

import { BeadsTasksSection } from './beads/ui/BeadsTasksSection'

export function ProviderSidebarSections() {
  return (
    <div className="border-t border-border pt-px">
      <BeadsTasksSection />
    </div>
  )
}
