# Worktree Deletion Research

## Scope

This document reviews:

- PR [#2573](https://github.com/superset-sh/superset/pull/2573), merged on March 22, 2026
- the current local code in this worktree
- the original failure mode: an external worktree failed to attach, then deleting the failed workspace deleted the user's real worktree

I did not use `WORKTREE_DELETION_ANALYSIS.md`.

## Short version

The PR solved the right symptom in the wrong place.

The original bug was:

1. Superset created a DB-backed workspace for a branch
2. background init later tried `git worktree add`
3. that failed because the worktree already existed outside Superset
4. the failed workspace record still pointed at the real external worktree path
5. deleting the failed workspace removed that path from disk

The PR tried to prevent this by making delete treat "external worktrees" as undeletable. The problem is that the helper used for that safety check does not actually return external worktrees. It returns every worktree in `git worktree list --porcelain`, including Superset-created ones and the main repo. That means the delete path is using the wrong primitive and broadly preserves worktrees that should be deleted.

So the current design has two issues:

- it handles the problem at delete time instead of fixing the failed-import/create path
- the delete-time safety check is logically wrong and causes deletion regressions

## What PR #2573 changed

The important parts were:

1. Added `worktrees.createdBySuperset` in [packages/local-db/src/schema/schema.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/packages/local-db/src/schema/schema.ts)
2. Added auto-import/open flows for existing worktrees in [apps/desktop/src/lib/trpc/routers/workspaces/utils/workspace-creation.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/utils/workspace-creation.ts)
3. Changed deletion to skip disk removal if the worktree looked "external" in [apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts)

The good part is the import work:

- `createWorkspaceFromExternalWorktree()` in [workspace-creation.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/utils/workspace-creation.ts#L96) is directionally correct
- imported worktrees get `createdBySuperset: false`
- that is a reasonable ownership model

The bad part is the delete safety logic:

- workspace delete uses `listExternalWorktrees()` at [delete.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts#L266)
- worktree delete uses the same helper at [delete.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts#L489)

## The core bug in the current implementation

`listExternalWorktrees()` is misnamed.

See [apps/desktop/src/lib/trpc/routers/workspaces/utils/git.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/utils/git.ts#L737).

It is just a parser for:

```bash
git worktree list --porcelain
```

That command returns:

- the main repo
- every registered worktree
- no distinction between "Superset-created" and "external"

So the delete logic is effectively doing:

- "if this worktree appears in git's worktree list, treat it as external and preserve it"

But every valid worktree appears in git's worktree list.

That makes the "double-check" invalid by definition.

## Why this breaks deletion

### Workspace delete

At [delete.ts:272](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts#L272), if `createdBySuperset` is true, deletion still asks `listExternalWorktrees()` whether the path is "actually external".

At [delete.ts:278](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts#L278), the match is:

```ts
externalWorktrees.some((wt) => normalizePath(wt.path) === worktreePathNorm)
```

Because the current helper includes all registered worktrees, that condition is true for normal Superset worktrees too. The code then skips `removeWorktreeFromDisk()`.

Result:

- DB records are deleted
- the worktree remains on disk and stays registered in git
- from a user perspective, deletion looks broken or incomplete

### Worktree delete

At [delete.ts:495](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts#L495), `deleteWorktree` does the same thing, but with an even weaker comparison:

```ts
externalWorktrees.some((wt) => wt.path === worktree.path)
```

That has two problems:

1. same logical problem: the helper returns all worktrees
2. no normalization, unlike the workspace delete path

So the two delete flows are inconsistent, and the supposedly safer one is also less robust on macOS path aliases/symlinks.

## Why the original bug happened

The underlying bug is earlier in the lifecycle, not in delete.

Superset creates DB records first, then does real git work in the background in [apps/desktop/src/lib/trpc/routers/workspaces/utils/workspace-init.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/utils/workspace-init.ts#L466).

The critical sequence is:

1. create mutation inserts a `worktrees` row with `createdBySuperset: true`
2. create mutation inserts a `workspaces` row
3. init later calls `createWorktree(...)`
4. if `git worktree add` fails because the worktree already exists, init marks the workspace failed
5. that failed workspace still points at the external worktree path
6. delete later trusts the DB row and removes the path

Relevant code:

- worktree row creation in [create.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/create.ts#L460)
- background git creation in [workspace-init.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/utils/workspace-init.ts#L466)
- init failure handling in [workspace-init.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/utils/workspace-init.ts#L529)

The key detail is that init only cleans up the worktree on failure if Superset knows it created it during this process:

```ts
if (manager.wasWorktreeCreated(workspaceId)) {
  await removeWorktree(...)
}
```

That is correct. The dangerous deletion happens later, after a failed row is already persisted.

## What is worth keeping from PR #2573

I would keep these parts:

1. `createdBySuperset`
2. external worktree import/open flows
3. bulk import of existing untracked worktrees

These parts are useful and align with the real model:

- Superset-created worktree: Superset can delete from disk
- imported external worktree: Superset should only detach from DB unless the user explicitly asks for destructive deletion

The part I would remove is the delete-time "double-check" based on `listExternalWorktrees()`.

## Why a straight revert is not enough

Reverting the whole PR would restore previous deletion behavior, but it would also remove the good parts:

- auto-import of existing worktrees
- ownership tracking
- explicit representation of imported worktrees

That would likely reintroduce the original data-loss path.

So I do not recommend a full revert of `#2573`.

I recommend:

1. revert the broken delete-side safety logic
2. keep the import/ownership model
3. fix the failed-create path so the bad state never survives to deletion

## Recommended fix

### Phase 1: Fix deletion regression immediately

Remove the delete-time `listExternalWorktrees()` safety checks from:

- [apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts#L266)
- [apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/delete.ts#L489)

Deletion should go back to this rule:

- if `createdBySuperset === false`, remove only DB records
- if `createdBySuperset === true`, allow `removeWorktreeFromDisk()`

That restores expected behavior for normal Superset worktrees.

### Phase 2: Fix the actual root cause

When worktree creation fails because the target already exists, Superset should adopt/import that worktree instead of leaving a failed Superset-owned record behind.

The right place for this is the failure path in [workspace-init.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/utils/workspace-init.ts#L529), not delete.

Specifically:

1. detect git errors that mean "worktree already exists" or "branch already checked out"
2. inspect current `git worktree list --porcelain`
3. if the target branch/path is present, convert the DB record into an imported worktree:
   - set `createdBySuperset = false`
   - if needed, update `worktrees.path` to the discovered path
   - seed `gitStatus`
   - copy config
   - mark init as ready with a warning like "Opened existing worktree"
4. only leave the workspace in failed state if adoption also fails

That directly fixes the user story that motivated the PR.

## Stronger model if we want this to stay correct

`createdBySuperset` is useful, but it is not enough for the provisioning race/failure window because the row is inserted before git creation succeeds.

The more correct model is:

- `createdBySuperset`: ownership intent
- `provisioningState`: `pending | ready | failed | imported`
- maybe `createdOnDiskBySupersetAt` or a boolean set only after `createWorktree()` succeeds

Then delete can make a safer decision:

- imported external: DB-only delete
- ready and created-on-disk-by-Superset: remove from disk
- failed before creation completed: never assume disk ownership

That is the most defensible long-term fix, but it is more invasive than the immediate repair above.

## Concrete implementation plan

### Minimal practical fix

1. Rename `listExternalWorktrees()` to `listGitWorktrees()` because that is what it actually does.
2. Update creation/import helpers to use a new filtered helper, something like `listImportableWorktrees()`:
   - exclude `project.mainRepoPath`
   - exclude bare and detached entries
   - exclude DB-tracked paths
   - normalize paths before comparing
3. Remove delete-side use of `listExternalWorktrees()` entirely.
4. In `workspace-init.ts`, adopt existing worktrees on create conflict instead of leaving a failed Superset-owned row.

### If we want the smallest possible code change first

1. Remove only the delete-side "double-check" logic
2. keep the `createdBySuperset` guard
3. ship that to restore normal deletion
4. then add init-time adoption in a follow-up

This is probably the safest rollout path.

## Testing gaps in the current PR

The current test file is [external-worktree-import.test.ts](/Users/avipeltz/.superset/worktrees/superset/fix-worktree-deletion/apps/desktop/src/lib/trpc/routers/workspaces/procedures/external-worktree-import.test.ts).

It does not actually test the real deletion mutation.

Current coverage is mostly:

- can create an external worktree
- can parse `git worktree list`
- "simulated deletion" by checking the file still exists without calling delete code

That is why the current regression could pass.

Tests that should exist:

1. create a normal Superset-owned worktree, call workspace delete, assert it is removed from git and from disk
2. create an imported external worktree, call workspace delete, assert DB records are removed but disk path still exists
3. simulate failed create where a matching worktree already exists, then assert init adopts/imports it instead of leaving a dangerous failed row
4. exercise both `delete` and `deleteWorktree`

## Recommendation

Recommended path:

1. Do not fully revert `#2573`
2. Revert only the broken delete-side "external list" safety logic
3. Keep `createdBySuperset` and the import/open flows
4. Fix `workspace-init.ts` so failed creation adopts existing worktrees instead of leaving a bad record behind
5. Add real delete mutation tests before merging

If we have to choose between "revert now" and "fix now", the best pragmatic version is:

- restore deletion behavior immediately by removing the bogus `listExternalWorktrees()` checks
- then land the init-time adoption fix right after

That gets back correct deletion semantics without giving up the useful external-import behavior.
