# Proposed V2 Workspace Creation Host-Service API Shape

This document proposes the target V2 API shape needed to support a full V1 workspace-creation UX port while preserving V2 architecture.


## Intent

The surface UX should match V1 exactly.

The backing implementation should stay V2:

1. renderer stays thin
2. host service owns workspace creation orchestration
3. cloud API stores shared V2 workspace records
4. renderer chooses a host endpoint, then talks only to that host service
5. the API must work equally well for local, cloud, and remote device hosts


## Design Rules

1. The renderer should select the host by URL, not by encoding host-specific behavior into the request payload.
2. The host service should own branch, PR, worktree, and repo resolution.
3. The renderer should send a semantic workspace-create draft, not low-level git instructions.
4. The host service should return structured outcomes like `created_workspace` or `opened_existing_workspace`.
5. The API should avoid leaking host-local filesystem paths to the renderer.
6. The API should avoid inlining raw attachment blobs in the create mutation.
7. The API should be good over remote:
   - few round trips
   - stable semantic contracts
   - opaque selection identifiers where host-local state is involved


## Current Shape

Today the V2 path is effectively:

```ts
type WorkspaceHostTarget =
  | { kind: "local" }
  | { kind: "cloud" }
  | { kind: "device"; deviceId: string };

type CurrentRendererCreateInput = {
  projectId: string;
  name: string;
  branch: string;
  hostTarget: WorkspaceHostTarget;
};
```

The renderer resolves `hostTarget` to a host URL, then calls:

```ts
client.workspace.create.mutate({
  projectId,
  name,
  branch,
});
```

The host service then:

1. ensures or clones the local repo
2. creates a git worktree
3. ensures a V2 host device
4. calls cloud `v2Workspace.create`
5. stores a local workspace mapping


## Proposed Top-Level Shape

Recommended host-service surface:

```ts
workspaceCreation.getContext(input)
workspaceCreation.searchBranches(input)
workspaceCreation.searchPullRequests(input)
workspaceCreation.searchInternalIssues(input)
workspaceCreation.searchGitHubIssues(input)
workspaceCreation.create(input)
workspaceCreation.getCreateStatus(input)
```

Keep the lower-level workspace router for runtime CRUD:

```ts
workspace.get(input)
workspace.gitStatus(input)
workspace.delete(input)
```


## Renderer Boundary

The renderer should still choose the host endpoint using the existing target model:

```ts
type WorkspaceHostTarget =
  | { kind: "local" }
  | { kind: "cloud" }
  | { kind: "device"; deviceId: string };
```

But after selecting the host URL, all creation semantics should go through host service APIs only.

The renderer should not:

1. decide whether something is an open vs create vs adopt action
2. compose PR-specific git behavior itself
3. pass worktree paths
4. build setup execution plans from raw git state


## API Summary

### 1. `workspaceCreation.getContext`

Purpose:

Hydrate the V1 modal with project defaults and capabilities.

```ts
type GetWorkspaceCreationContextInput = {
  projectId: string;
};

type GetWorkspaceCreationContextResult = {
  project: {
    id: string;
    name: string;
  };
  repo: {
    available: boolean;
    defaultBranch: string | null;
    workspaceBaseBranch: string | null;
    branchPrefix: string | null;
  };
  defaults: {
    runSetupScript: boolean;
    compareBaseBranch: string | null;
  };
  capabilities: {
    canLinkPullRequests: boolean;
    canLinkGitHubIssues: boolean;
    canLinkInternalIssues: boolean;
    canUploadAttachments: boolean;
    canRunSetupScript: boolean;
    canLaunchAgent: boolean;
  };
};
```

Why:

1. keeps branch prefix and base-branch logic host-owned
2. gives the renderer all V1 form defaults without extra heuristics


### 2. `workspaceCreation.searchBranches`

Purpose:

Return branch rows that are already action-resolved by the host.

```ts
type SearchWorkspaceBranchesInput = {
  projectId: string;
  query?: string;
  filter?: "all" | "worktrees";
  limit?: number;
};

type BranchRowAction =
  | {
      kind: "open_workspace";
      workspaceId: string;
      label: "Open";
    }
  | {
      kind: "open_worktree";
      selectionId: string;
      label: "Open";
    }
  | {
      kind: "adopt_external_worktree";
      selectionId: string;
      label: "Open";
    }
  | {
      kind: "create_workspace";
      selectionId: string;
      label: "Create";
    };

type SearchWorkspaceBranchesResult = {
  items: Array<{
    id: string;
    branch: string;
    isDefault: boolean;
    isLocal: boolean;
    lastCommitAt: string | null;
    badges: Array<"default" | "tracked" | "external">;
    action: BranchRowAction;
  }>;
};
```

Important:

1. `selectionId` should be opaque
2. do not send host filesystem paths
3. host service should decide open vs create vs adopt


### 3. `workspaceCreation.searchPullRequests`

Purpose:

Power the V1 PR linking command.

```ts
type SearchWorkspacePullRequestsInput = {
  projectId: string;
  query?: string;
  limit?: number;
};

type SearchWorkspacePullRequestsResult = {
  items: Array<{
    id: string;
    prNumber: number;
    title: string;
    url: string;
    state: "open" | "closed" | "draft";
    authorLogin: string | null;
    headBranch: string;
  }>;
};
```


### 4. `workspaceCreation.searchInternalIssues`

Purpose:

Power the V1 internal issue linker.

```ts
type SearchWorkspaceInternalIssuesInput = {
  projectId: string;
  query?: string;
  limit?: number;
};

type SearchWorkspaceInternalIssuesResult = {
  items: Array<{
    id: string;
    taskId: string;
    slug: string;
    title: string;
    url: string | null;
    status: {
      type: string;
      color: string;
      progressPercent: number | null;
    } | null;
  }>;
};
```


### 5. `workspaceCreation.searchGitHubIssues`

Purpose:

Power the V1 GitHub issue linker.

```ts
type SearchWorkspaceGitHubIssuesInput = {
  projectId: string;
  query?: string;
  limit?: number;
};

type SearchWorkspaceGitHubIssuesResult = {
  items: Array<{
    id: string;
    issueNumber: number;
    title: string;
    url: string;
    state: "open" | "closed";
  }>;
};
```


### 6. `workspaceCreation.create`

Purpose:

Represent the full V1 creation surface as one semantic host-service call.

```ts
type WorkspaceCreateSource =
  | { kind: "prompt" }
  | { kind: "pull_request"; prUrl: string }
  | { kind: "branch_selection"; selectionId: string };

type WorkspaceAttachmentRef = {
  id: string;
  filename: string;
  mediaType: string;
};

type WorkspaceLinkedContext = {
  internalIssueIds: string[];
  githubIssueUrls: string[];
  linkedPrUrl?: string | null;
  attachments: WorkspaceAttachmentRef[];
};

type WorkspaceLaunchConfig = {
  agentId: string | null;
  autoRun: boolean;
};

type CreateWorkspaceFromDraftInput = {
  projectId: string;
  source: WorkspaceCreateSource;
  composer: {
    workspaceName?: string;
    prompt?: string;
    branchName?: string;
    compareBaseBranch?: string | null;
    runSetupScript: boolean;
  };
  linkedContext: WorkspaceLinkedContext;
  launch: WorkspaceLaunchConfig;
  behavior?: {
    ifBranchExists?: "open_existing" | "error";
    ifWorktreeExists?: "open_existing" | "adopt" | "error";
  };
};
```

Notes:

1. `hostTarget` is not part of this payload
2. the renderer already selected the host by choosing the host URL
3. `selectionId` is used where the host has authoritative knowledge about branch/worktree state


### 7. `workspaceCreation.create` result

Purpose:

Return a rich semantic outcome instead of only a workspace row.

```ts
type CreateWorkspaceFromDraftResult = {
  outcome:
    | "created_workspace"
    | "opened_existing_workspace"
    | "opened_worktree"
    | "adopted_external_worktree";

  workspace: {
    id: string;
    projectId: string;
    name: string;
    branch: string;
    deviceId: string | null;
  };

  init: {
    status: "queued" | "not_required";
    setup: {
      status: "queued" | "skipped";
      initialCommands: string[] | null;
    };
    agent: {
      status: "queued" | "skipped";
      launchRequestId: string | null;
    };
  };

  warnings: Array<{
    code:
      | "auto_branch_fallback"
      | "auto_name_failed"
      | "github_issue_fetch_partial"
      | "setup_skipped"
      | "agent_skipped";
    message: string;
  }>;
};
```

Why this matters:

1. the renderer gets one authoritative answer
2. the host service owns all branching complexity
3. the response works the same over local and remote hosts


### 8. `workspaceCreation.getCreateStatus`

Purpose:

Allow the renderer to observe queued setup and agent launch work cleanly.

```ts
type GetWorkspaceCreateStatusInput = {
  workspaceId: string;
};

type GetWorkspaceCreateStatusResult = {
  workspaceId: string;
  setup: {
    status: "queued" | "running" | "completed" | "failed" | "skipped";
    message: string | null;
  };
  agent: {
    status: "queued" | "running" | "completed" | "failed" | "skipped";
    message: string | null;
  };
};
```

This can later be replaced or augmented with subscriptions, but the shape should be semantic from the start.


## Attachment Handling

Do not keep V1's inline base64-in-create approach.

Recommended pattern:

1. upload attachments first
2. pass attachment refs into `workspaceCreation.create`
3. let host service fetch and materialize those refs as needed

Suggested attachment contract:

```ts
workspaceAttachments.beginUpload()
workspaceAttachments.completeUpload()
```

Then pass:

```ts
linkedContext.attachments: WorkspaceAttachmentRef[]
```


## Cloud API Shape

The cloud V2 workspace API should stay thinner than host service.

Recommended shared cloud shape:

```ts
type CloudCreateV2WorkspaceInput = {
  projectId: string;
  deviceId: string;
  name: string;
  branch: string;
  baseBranch?: string | null;
  metadata?: {
    sourceKind: "prompt" | "pull_request" | "branch";
    sourceRef?: string | null;
  };
};
```

This keeps:

1. orchestration in host service
2. shared record persistence in cloud
3. enough shared metadata for future auditability


## What Should Stay Out Of The Renderer

Do not require the renderer to:

1. distinguish `open workspace` vs `open tracked worktree` vs `adopt external worktree`
2. resolve branch prefixes
3. derive setup execution plans
4. decide whether a pasted PR should use a PR-specific creation path
5. fetch host-local filesystem paths


## Smallest Viable End State

If implementation needs to phase in:

Phase 1:

1. add `workspaceCreation.getContext`
2. add `workspaceCreation.searchBranches`
3. add `workspaceCreation.create`

Phase 2:

1. move PR search into host service
2. move issue search into host service
3. add attachment upload refs
4. add explicit create status tracking

This still gets the hardest part right early:

1. host-service owns create semantics
2. renderer stays thin
3. remote hosts behave the same as local hosts


## Open Questions

1. Should PR and issue search live in host service immediately, or can they remain renderer/cloud-backed in phase 1?
2. Should `workspaceCreation.create` queue setup and agent launch itself, or return a plan for the renderer to execute?
3. Should cloud `v2Workspace` store `baseBranch` and `sourceKind` now, or can that remain host-local temporarily?
4. Should host-target selection remain visible anywhere in the UI once the full V1 UX port lands?
