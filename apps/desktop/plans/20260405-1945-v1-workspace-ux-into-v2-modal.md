# Full Port Of V1 Workspace UX Onto V2 Paths And Architecture

This ExecPlan is a living document. Update `Progress`, `Decision Log`, `Surprises & Discoveries`, and `Outcomes & Retrospective` as implementation proceeds.


## Goal

Match the V1 workspace creation experience exactly, while using the V2-enabled routes, collections, host-service, and sidebar/workspace architecture underneath.

Target outcome:

1. the V2-enabled modal looks and behaves like the V1 modal
2. all create/open flows execute through V2 paths and architecture, not the old modal-specific stack
3. current V2-only modal UI is removed wherever it diverges from the V1 experience
4. V1 business logic is ported or extracted, not left stranded in the legacy modal
5. there is one canonical workspace-creation UX stack when `V2_CLOUD` is enabled


## Non-Goals

1. Do not change the `V2_CLOUD` off-path behavior.
2. Do not remove the legacy modal until V2 reaches agreed parity.
3. Do not preserve the current V2 modal tabs, header, or device-picker UX if they conflict with exact V1 parity.
4. Do not hand-edit generated database artifacts.


## Current State

### V1 strengths

The old modal under `apps/desktop/src/renderer/components/NewWorkspaceModal/` already has the behaviors we want to preserve:

1. one prompt-centric composer flow
2. editable workspace name and branch name
3. prompt attachments
4. linked internal issues
5. linked GitHub issues
6. linked PRs
7. agent selection and agent launch request creation
8. setup-script control
9. compare-base-branch selection
10. open existing active workspaces, tracked worktrees, and external worktrees
11. pending workspace lifecycle and optimistic init state
12. auto-navigation into the created workspace

### V2 architecture strengths

The V2-enabled stack already gives us the backing architecture we want to keep:

1. V2 collections-backed project data
2. host-service based workspace creation
3. V2 dashboard-specific routing
4. V2 sidebar insertion after create
5. a path to device-targeted creation without depending on the old modal's local-only assumptions

### Main gaps today

1. prompt tab is much thinner than V1
2. prompt tab has no attachments, agent picker, linked context pills, or workspace-name field
3. `compareBaseBranch` is stored in draft but not sent anywhere
4. setup-script and pending-init behavior are missing
5. the current V2 tabbed interaction model does not match V1 and should not be treated as the target
6. PR and issue tabs create directly instead of matching V1 inline linking behavior
7. branch tab cannot open tracked or external worktrees the way V1 can
8. the visible device-picker and header shell are V2-specific UX that diverge from V1
9. V2 create only sends `projectId`, `name`, and `branch`
10. V2 create does not seed the old pending terminal setup / agent launch pipeline
11. V2 create does not auto-navigate into the new workspace


## Proposed UX Mapping

Recommended target behavior:

1. The V2-enabled modal should render and behave like the V1 modal, not like the current tabbed V2 dashboard modal.
2. Restore the V1 single-composer surface in full:
   - workspace name
   - branch name
   - prompt composer
   - attachments
   - linked issue pills
   - linked GitHub issue pills
   - linked PR pill
   - agent picker
   - inline project picker
   - inline compare-base-branch / worktree picker
   - setup toggle
   - V1 shortcut hints and action placement
3. PR, issue, and branch behaviors should return as V1 inline commands and pickers, not dedicated V2 tabs.
4. If host-target selection is still needed for architecture reasons, it should be defaulted or integrated behind the scenes for the first full-port pass rather than changing the V1 UX.
5. Use one shared V2 creation orchestration hook behind the exact V1 UI.


## Recommended Decisions

### DL-1 Exact V1 UX parity beats hybridization

Decision: the target is a full UX port. Do not preserve current V2 modal structure when it conflicts with the V1 experience.

Reason:

1. The user explicitly wants a full port, not a compromise.
2. Hybridizing two interaction models will keep the feature hard to maintain.
3. The current V2 shell is implementation scaffolding, not the product target.


### DL-2 Restore the V1 single-composer model

Decision: the V2 modal should use the V1 single-composer interaction model, not the current prompt/issues/PRs/branches tab split.

Reason:

1. V1 does not present these flows as separate tabs.
2. A single composer is the clearest way to achieve exact parity.
3. It avoids carrying two different mental models through the port.


### DL-3 PR, issue, and branch affordances should return in V1 form

Decision: restore PR link, issue link, GitHub issue link, and inline compare-base/worktree picker behavior from V1 instead of adapting the current V2 tab components.

Reason:

1. Exact parity requires the same placement and interaction model.
2. The current V2 tabs materially change the experience.


### DL-4 V2 paths remain the backing implementation

Decision: use the V2 collections, routing, host-service, and sidebar/workspace model as the backing implementation, even though the surface UX should match V1.

Reason:

1. The request is specifically a full port onto V2 paths and architecture.
2. This avoids carrying old create logic indefinitely.
3. Device-targeted creation and V2 workspace records belong in the new stack.


### DL-5 Visible host/device controls are not part of the first-parity target

Decision: if host-target selection is still required, satisfy it internally or via a non-divergent fallback during the full-port pass. Do not keep the current visible device picker if it changes the V1 experience.

Reason:

1. The user asked for an exact V1 experience.
2. Architecture requirements should not force obvious UX regressions during the port.


## Workstreams

### Milestone 0: Lock UX contract before editing code

Checklist:

- [ ] Explicitly lock the target as exact V1 UX parity
- [ ] Explicitly drop the current V2 tabbed modal as the UX target
- [ ] Decide how host-target selection is handled without changing the V1 experience
- [ ] Confirm whether `Open project` and `New project` return exactly as in V1
- [ ] Confirm that setup-script toggle is required in the first full-port pass
- [ ] Confirm that V2 create should auto-navigate exactly like V1

Acceptance:

1. The team agrees that this is a full V1 UX port and not a hybrid.


### Milestone 1: Expand the V2 draft model to hold the full V1 state model

Files:

- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/DashboardNewWorkspaceDraftContext.tsx`
- `apps/desktop/src/renderer/stores/new-workspace-modal.ts`

Checklist:

- [ ] Add `workspaceName` and `workspaceNameEdited`
- [ ] Add `runSetupScript`
- [ ] Add linked issue state
- [ ] Add linked PR state
- [ ] Add attachment reset support equivalent to V1's `resetKey`
- [ ] Add selected agent state or a hook boundary for persisted agent selection
- [ ] Keep only the V2 fields that are architectural necessities:
  - [ ] `selectedProjectId`
  - [ ] `hostTarget`
  - [ ] `compareBaseBranch`
  - [ ] `branchName`
- [ ] Remove V2-only draft fields that exist only for the current tabbed UX:
  - [ ] `activeTab`
  - [ ] per-tab search queries, if no longer needed after the full port

Acceptance:

1. The V2 modal can represent all V1 creation inputs in one shared draft.


### Milestone 2: Extract one shared V2 creation orchestration hook

Goal:

Move V1's create pipeline out of the old modal-specific component and into a reusable V2-oriented hook.

Suggested new files:

- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/hooks/useCreateDashboardWorkspaceFlow.ts`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/hooks/useWorkspaceDraftLaunchRequest.ts`

Source behavior to port from V1:

1. pending workspace lifecycle
2. branch-name generation when branch is not manually edited
3. attachment conversion
4. GitHub issue content fetch and attachment enrichment
5. agent launch request construction
6. setup-script override handling
7. toast lifecycle
8. post-create navigation

Checklist:

- [ ] Extract the V1 prompt-create pipeline from the old `PromptGroup`
- [ ] Define one typed V2 flow input that includes:
  - [ ] project ID
  - [ ] host target
  - [ ] workspace name
  - [ ] branch name or generation strategy
  - [ ] compare base branch
  - [ ] prompt
  - [ ] linked issue / linked PR context
  - [ ] attachments
  - [ ] agent launch request inputs
  - [ ] setup toggle
- [ ] Use the shared modal store for `pendingWorkspace`
- [ ] Preserve duplicate-submit protection
- [ ] Add a single success path that closes the modal, clears draft, updates sidebar state, and navigates exactly like V1

Acceptance:

1. All ported V1 affordances call the same V2-backed orchestration hook.


### Milestone 3: Port the V1 modal body into the V2 modal entrypoint

Files:

- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/DashboardNewWorkspaceModal.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/PromptGroup/PromptGroup.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/PromptGroup/components/`

Checklist:

- [ ] Replace the current V2 modal body with the V1 interaction layout
- [ ] Replace the bare textarea flow with `PromptInputProvider` and `PromptInput`
- [ ] Add workspace-name input
- [ ] Add branch-name input
- [ ] Add attachment button and attachment list
- [ ] Add internal issue linking command
- [ ] Add GitHub issue linking command
- [ ] Add PR linking command
- [ ] Add linked context pills
- [ ] Add agent picker
- [ ] Restore `Cmd/Ctrl+Enter` create shortcut
- [ ] Restore V1 project picker placement and behavior
- [ ] Restore V1 inline compare-base/worktree picker placement and behavior
- [ ] Restore V1 composer footer actions and labels
- [ ] Restore advanced options:
  - [ ] branch override
  - [ ] compare base branch
  - [ ] setup toggle

Acceptance:

1. The V2-enabled modal is visually and behaviorally equivalent to V1.


### Milestone 4: Port the V1 inline PR, issue, and project affordances

Files:

- `.../PromptGroup/PromptGroup.tsx`
- `apps/desktop/src/renderer/components/NewWorkspaceModal/components/PromptGroup/components/PRLinkCommand/PRLinkCommand.tsx`
- `apps/desktop/src/renderer/components/NewWorkspaceModal/components/PromptGroup/components/GitHubIssueLinkCommand/GitHubIssueLinkCommand.tsx`
- `apps/desktop/src/renderer/components/Chat/ChatInterface/components/IssueLinkCommand/IssueLinkCommand.tsx`

Checklist:

- [ ] Port V1 PR linking command into the V2 modal body
- [ ] Port V1 internal issue linking command into the V2 modal body
- [ ] Port V1 GitHub issue linking command into the V2 modal body
- [ ] Port V1 linked context pills
- [ ] Port V1 project picker including:
  - [ ] recent/local project selection
  - [ ] `Open project`
  - [ ] `New project`
- [ ] Remove current V2 PR/Issue tab-specific create flows
- [ ] Remove current V2 project-selector-only UX if it diverges from V1

Acceptance:

1. PR, issue, and project interactions behave like V1 inside the V2-backed modal.


### Milestone 5: Port the V1 inline branch and worktree behavior exactly

Files:

- `.../PromptGroup/PromptGroup.tsx`
- supporting open-worktree helpers from the legacy modal

Checklist:

- [ ] Port V1's inline compare-base-branch picker
- [ ] Port V1's ability to distinguish:
  - [ ] active workspace
  - [ ] tracked worktree without active workspace
  - [ ] external worktree
  - [ ] plain branch
- [ ] Port V1 filter and badge behavior for worktrees and external branches
- [ ] Add open tracked worktree action
- [ ] Add open external worktree action
- [ ] Add reuse-or-adopt flow for orphaned/external worktrees where applicable
- [ ] Preserve V1 "open when possible, create only when needed" behavior
- [ ] Remove current V2 Branches tab UX if it diverges from this behavior

Acceptance:

1. Inline branch/worktree behavior matches V1 exactly.


### Milestone 6: Expand the host-service create contract to support real V1 semantics

Files:

- `packages/host-service/src/trpc/router/workspace/workspace.ts`
- any shared V2 router and host-service client types touched by the new input contract
- `apps/desktop/src/renderer/lib/v2-workspace-host.ts`
- `apps/desktop/src/renderer/lib/host-service-client.ts`

Checklist:

- [ ] Extend create input beyond `{ projectId, name, branch }`
- [ ] Add support for `compareBaseBranch`
- [ ] Add support for branch-generation strategy or generated branch handoff
- [ ] Decide how PR-based creation maps into host-service:
  - [ ] explicit `source: { kind: "pr" }`
  - [ ] or draft-linked PR resolved in renderer before create
- [ ] Ensure host-service create can return enough data for post-create orchestration
- [ ] Ensure new behavior works for:
  - [ ] local host
  - [ ] cloud host
  - [ ] other device host

Acceptance:

1. The V2 creation path can express the semantics the V1 UX needs.


### Milestone 7: Reconnect setup, init, and agent-launch behavior to V2

Context:

V1 uses `useCreateWorkspace` and `useCreateFromPr` to seed `workspace-init` and pending terminal setup. The current V2 modal does not.

Checklist:

- [ ] Decide whether V2 workspaces should use the same `workspace-init` store or a V2-specific equivalent
- [ ] Reconnect pending terminal setup for newly created V2 workspaces
- [ ] Reconnect agent launch request handoff after create
- [ ] Reconnect optimistic progress so the new workspace does not flash an incomplete state
- [ ] Verify auto-run and setup flows on the V2 workspace route

Acceptance:

1. Creating from the V2 modal can still launch setup and agent work the way V1 can.


### Milestone 8: Remove duplication and retire legacy modal usage

Checklist:

- [ ] Audit duplicated logic now shared between legacy and V2 implementations
- [ ] Keep extracted shared helpers in a neutral location if both flows still need them during rollout
- [ ] Delete or reduce old modal-only code once V2 parity is verified
- [ ] Remove dead imports and stale create hooks
- [ ] Delete current V2 modal-only shell components that no longer belong in the exact-parity target:
  - [ ] tab header
  - [ ] tab content wrappers
  - [ ] tab-specific create groups
  - [ ] visible device-picker shell if it remains divergent

Acceptance:

1. The V2 modal is the canonical creation flow and the old modal is no longer carrying unique business logic.


## File Targets

Primary renderer files:

- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/DashboardNewWorkspaceDraftContext.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/DashboardNewWorkspaceModal.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/DashboardNewWorkspaceForm.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/DashboardNewWorkspaceFormHeader/DashboardNewWorkspaceFormHeader.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/DashboardNewWorkspaceListTabContent/DashboardNewWorkspaceListTabContent.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/PromptGroup/PromptGroup.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/PullRequestsGroup/PullRequestsGroup.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/IssuesGroup/IssuesGroup.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/BranchesGroup/BranchesGroup.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/ProjectSelector/ProjectSelector.tsx`
- `apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal/components/DashboardNewWorkspaceForm/components/DevicePicker/DevicePicker.tsx`
- `apps/desktop/src/renderer/stores/new-workspace-modal.ts`

Primary legacy sources to extract from:

- `apps/desktop/src/renderer/components/NewWorkspaceModal/NewWorkspaceModalDraftContext.tsx`
- `apps/desktop/src/renderer/components/NewWorkspaceModal/components/PromptGroup/PromptGroup.tsx`
- `apps/desktop/src/renderer/react-query/workspaces/useCreateWorkspace.ts`
- `apps/desktop/src/renderer/react-query/workspaces/useCreateFromPr.ts`
- `apps/desktop/src/renderer/react-query/workspaces/useOpenTrackedWorktree.ts`
- `apps/desktop/src/renderer/react-query/workspaces/useOpenExternalWorktree.ts`

Backend and host-service files:

- `packages/host-service/src/trpc/router/workspace/workspace.ts`
- `packages/trpc/src/router/v2-workspace/v2-workspace.ts`


## Verification

Manual verification:

1. Create from the ported V1 composer with only prompt text
2. Create from the ported V1 composer with manual workspace name
3. Create from the ported V1 composer with manual branch name
4. Create from the ported V1 composer with attachments
5. Create from the ported V1 composer with linked internal issue
6. Create from the ported V1 composer with linked GitHub issue
7. Create from the ported V1 composer with linked PR
8. Create or open via the inline compare-base/worktree picker when branch already has:
   - [ ] active workspace
   - [ ] tracked worktree
   - [ ] external worktree
   - [ ] nothing
9. Verify there are no remaining visible V2-only modal tabs or header behaviors that diverge from V1
10. Create with setup toggle on and off
11. Create with agent selected and with no agent
12. Create on:
   - [ ] local host
   - [ ] cloud host
   - [ ] another device
13. Confirm new workspace appears in sidebar and route opens correctly

Code verification:

```bash
bun run typecheck
bun run lint:fix
```

Suggested search checks:

```bash
rg -n "createWorkspace\\({" apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal
rg -n "compareBaseBranch" apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal packages/host-service
rg -n "agentLaunchRequest|pendingWorkspace|runSetupScript" apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal
rg -n "TabsTrigger|DevicePicker|ProjectSelector|DashboardNewWorkspaceListTabContent" apps/desktop/src/renderer/routes/_authenticated/components/DashboardNewWorkspaceModal
```


## Risks

1. The hardest part is not UI parity. It is restoring V1's creation pipeline without collapsing back into legacy-only routing.
2. Exact parity means some current V2 modal components may need to be removed rather than reused.
3. Host-targeted creation may expose differences between local, cloud, and other-device repo availability.
4. V2 workspace routes may need extra plumbing before setup and agent launch behave like the old workspace route.


## Progress

- [x] (2026-04-05 19:45 America/Los_Angeles) Compare V1 and V2 workspace modal flows end to end
- [x] (2026-04-05 19:45 America/Los_Angeles) Draft migration plan for moving V1 UX into V2 modal patterns
- [x] (2026-04-05 19:55 America/Los_Angeles) Lock target as exact V1 UX parity on V2 paths and architecture
- [ ] Finalize remaining implementation details for host-target handling
- [ ] Expand V2 draft model
- [ ] Extract shared V2 creation orchestration
- [ ] Port the V1 modal body into the V2 modal entrypoint
- [ ] Port V1 inline PR, issue, and project affordances
- [ ] Port V1 inline branch/worktree behavior
- [ ] Expand host-service create semantics
- [ ] Restore setup/init/agent launch parity
- [ ] Remove duplication and verify rollout


## Surprises & Discoveries

- The current V2 modal stores `compareBaseBranch`, but the create path does not use it.
- The current V2 create flow only ensures sidebar presence. It does not replicate V1's pending setup, agent launch, or navigation behavior.
- Existing task flows still rely on the legacy `useCreateWorkspace` path for setup and agent launch. That logic should be extracted, not reimplemented again.
- The current V2 modal shell itself is now out of scope as a preserved UX; the full-port requirement turns it into migration scaffolding to remove.


## Outcomes & Retrospective

Pending implementation.
