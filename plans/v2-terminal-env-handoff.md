# V2 Terminal Env Handoff

Last refined: 2026-04-05

## Goal

Define and implement a v2 terminal env contract that:

- matches common terminal patterns from GitHub sources
- preserves user-needed shell env for normal shell behavior
- avoids leaking desktop, Electron, and host-service runtime env into PTYs
- keeps the useful parts of the v1 Superset notification contract, but renames
  the v2-specific keys to make the contract clearer

This doc is meant to be handed to another agent to implement directly.

## Current state

Current checked-out v2 terminal flow:

- renderer opens `/terminal/${terminalId}?workspaceId=${workspaceId}`
- host-service spawns a fresh PTY per websocket-backed session
- host-service resolves the shell from inherited process env
- host-service currently spreads raw `process.env` into the PTY

Relevant code:

- `apps/desktop/src/main/lib/host-service-manager.ts`
- `apps/desktop/src/lib/trpc/routers/workspaces/utils/shell-env.ts`
- `packages/host-service/src/terminal/terminal.ts`
- `apps/desktop/src/main/lib/terminal/env.ts` for the existing v1 contract

Current PTY env in `packages/host-service/src/terminal/terminal.ts`:

```ts
{
  ...process.env,
  TERM: "xterm-256color",
  COLORTERM: "truecolor",
  HOME: process.env.HOME || homedir(),
  PWD: workspace.worktreePath,
}
```

This is too loose in two places:

1. host-service itself is spawned from desktop with an env built from desktop
   `process.env`
2. PTYs then inherit host-service `process.env` wholesale

That leaks whatever happens to be in the desktop and host-service runtime env
and does not define a stable contract for terminals.

## Upstream patterns to follow

GitHub sources:

- VS Code terminal env injection:
  https://github.com/microsoft/vscode/blob/main/src/vs/platform/terminal/node/terminalEnvironment.ts
- kitty shell integration:
  https://github.com/kovidgoyal/kitty/blob/master/docs/shell-integration.rst
- WezTerm `TERM` docs:
  https://github.com/wezterm/wezterm/blob/main/docs/config/lua/config/term.md
- WezTerm shell integration:
  https://github.com/wezterm/wezterm/blob/main/docs/shell-integration.md
- Windows Terminal FAQ:
  https://github.com/microsoft/terminal/wiki/Frequently-Asked-Questions-%28FAQ%29

What these tools converge on:

- keep the public env surface small
- use shell-specific bootstrap vars only when loading shell integration
- do not rely on env vars for dynamic session state
- keep `TERM` conservative unless terminfo is actually shipped
- do not treat env vars as the only reliable terminal identity signal

## Refined v2 contract

### 1. Env boundary

The shell-derived env snapshot is the boundary.

For v2:

- desktop should resolve a shell-derived env snapshot once
- host-service should be spawned from that shell-derived snapshot plus explicit
  host-service runtime vars
- PTYs should be built from a sanitized host-service env, not from raw
  `process.env`

Do not pass arbitrary desktop `process.env` through to host-service.

Do not pass arbitrary host-service `process.env` through to user terminals.

### 2. Shell-derived base env

Use the existing shell env primitive in:

- `apps/desktop/src/lib/trpc/routers/workspaces/utils/shell-env.ts`

But tighten the semantics:

- normal path: use the resolved shell snapshot
- fallback path: use a conservative filtered fallback, never a raw
  passthrough-to-PTY fallback

Important:

- the current helper falls back to `process.env` when shell env resolution
  fails
- that fallback is acceptable for recovering desktop child-process execution
  but not acceptable as a PTY contract by itself

For v2, PTY creation must never degenerate into `...process.env`.

### 3. Public terminal env

Inject this stable terminal surface by default:

```sh
TERM=xterm-256color
TERM_PROGRAM=Superset
TERM_PROGRAM_VERSION=<app version>
COLORTERM=truecolor
LANG=<utf8 locale>
PWD=<cwd>
```

Notes:

- keep `TERM=xterm-256color` unless Superset ships and maintains terminfo
- `TERM_PROGRAM_VERSION` should come from the app/host-service version, not
  `npm_package_version`
- `PWD` should reflect the resolved launch cwd
- for the current v2 path, launch cwd is the workspace worktree path
- `HOME`, `PATH`, `SHELL`, proxy vars, SSH agent vars, and version-manager vars
  should come from the shell-derived base env rather than being redefined as
  part of the public contract

### 4. Superset-specific metadata retained in v2

We do want to keep a trimmed, explicit Superset contract for v2 notification
and integration flows.

Keep these explicit vars in v2:

```sh
SUPERSET_TERMINAL_ID=<terminal id>
SUPERSET_WORKSPACE_ID=<workspace id>
SUPERSET_WORKSPACE_PATH=<worktree path>
SUPERSET_ROOT_PATH=<repo root path, when available>
SUPERSET_WORKSPACE_NAME=<workspace display name, optional or empty until explicitly sourced>
SUPERSET_ENV=<development|production>
SUPERSET_AGENT_HOOK_PORT=<desktop local agent hook server port>
SUPERSET_AGENT_HOOK_VERSION=<agent hook protocol version>
```

Rename the old v1 vars as follows:

- `SUPERSET_PANE_ID` -> `SUPERSET_TERMINAL_ID`
- `SUPERSET_PORT` -> `SUPERSET_AGENT_HOOK_PORT`
- `SUPERSET_HOOK_VERSION` -> `SUPERSET_AGENT_HOOK_VERSION`

Drop this key entirely in v2:

- `SUPERSET_TAB_ID`

Do not use a blanket `SUPERSET_*` passthrough rule in v2.

The v2 Superset metadata surface should stay explicit and minimal.

### 5. Shell behavior

V2 should support the user's shell out of the box, similar to VS Code.

That means:

- launch the user's configured or default shell
- preserve normal shell startup behavior users expect
- make PATH, version managers, aliases, and shell config work without manual
  terminal setup

Use a hard-coded fallback shell only as a last resort:

- macOS/Linux: prefer inherited `SHELL`, then `/bin/sh`
- Windows: prefer inherited `COMSPEC`, then `cmd.exe`

Do not default to `/bin/zsh` just because the current implementation does.

### 6. Shell integration

If v2 later adds shell integration, follow the VS Code and kitty pattern:

- use private bootstrap vars per shell only for startup
- examples: `ZDOTDIR`, `BASH_ENV`, `XDG_DATA_DIRS`
- clean them up after shell initialization when possible

Do not expose those bootstrap vars as part of the public v2 terminal contract.

This means v2 should not reuse the v1 desktop terminal env builder as-is.

`apps/desktop/src/main/lib/terminal/env.ts` currently mixes together:

- safe env filtering
- shell wrapper bootstrap
- theme hints like `COLORFGBG`
- legacy Superset notification metadata

That builder should remain v1-oriented.

### 7. Dynamic state

Do not use env vars for:

- cwd updates after launch
- prompt boundaries
- command start/end markers
- exit status

If v2 needs those later, use shell integration and OSC sequences instead.

## Current implementation constraints

### Host-service launch env

`apps/desktop/src/main/lib/host-service-manager.ts` currently builds the
host-service env by starting from desktop `process.env` and then merging shell
path data.

That means the host-service process already inherits more desktop runtime state
than it should.

V2 should tighten the boundary here first.

### PTY context available in host-service

The host-service terminal session currently has first-class access to:

- `terminalId`
- `workspaceId`
- workspace `worktreePath`

Host-service can also derive:

- repo root path by joining workspace -> project and reading `projects.repoPath`

Host-service does not currently store a dedicated workspace display name in its
SQLite schema.

Implication:

- `SUPERSET_TERMINAL_ID`, `SUPERSET_WORKSPACE_ID`, and
  `SUPERSET_WORKSPACE_PATH` are straightforward
- `SUPERSET_ROOT_PATH` is straightforward with a join
- `SUPERSET_WORKSPACE_NAME` should either be explicitly sourced and threaded to
  v2, or left empty until there is a first-class source

Do not invent a display name from `branch` or `id` unless product explicitly
accepts that behavior.

## Files to update

Primary implementation targets:

- `apps/desktop/src/main/lib/host-service-manager.ts`
- `apps/desktop/src/lib/trpc/routers/workspaces/utils/shell-env.ts`
- `packages/host-service/src/terminal/terminal.ts`
- new: `packages/host-service/src/terminal/env.ts`

Secondary follow-up targets:

- `apps/desktop/src/main/lib/terminal/env.ts`
  only to clarify that it is the legacy v1 builder
- `apps/desktop/src/main/lib/agent-setup/templates/notify-hook.template.sh`
- `apps/desktop/src/main/lib/agent-setup/templates/gemini-hook.template.sh`
- `apps/desktop/src/main/lib/agent-setup/templates/copilot-hook.template.sh`
- `apps/desktop/src/main/lib/agent-setup/templates/cursor-hook.template.sh`
- `apps/desktop/src/lib/trpc/routers/terminal/terminal.ts`
- `apps/desktop/docs/EXTERNAL_FILES.md`

## Likely implementation direction

1. Add a v2-specific shell snapshot path for host-service launch.

   - start from the resolved shell env snapshot
   - strip desktop and Electron runtime vars that host-service should not carry
   - inject only explicit host-service runtime vars

2. Add a v2 terminal env builder in `packages/host-service/src/terminal/env.ts`.

   Suggested shape:

   - `resolveLaunchShell(baseEnv)`
   - `normalizeUtf8Locale(baseEnv)`
   - `stripTerminalRuntimeEnv(baseEnv)`
   - `buildV2TerminalEnv({ terminalId, workspaceId, workspacePath, rootPath, workspaceName, cwd, baseEnv, appVersion, nodeEnv, notificationsPort, notificationsHookVersion })`

3. Update `packages/host-service/src/terminal/terminal.ts`.

   - stop using `...process.env`
   - resolve the shell from the sanitized base env
   - build the PTY env through the new v2 builder
   - keep `TERM=xterm-256color`

4. Source explicit Superset metadata rather than relying on prefixes.

   - `SUPERSET_TERMINAL_ID` comes from `terminalId`
   - `SUPERSET_WORKSPACE_ID` comes from `workspaceId`
   - `SUPERSET_WORKSPACE_PATH` comes from `workspace.worktreePath`
   - `SUPERSET_ROOT_PATH` comes from the related project repo path
   - `SUPERSET_AGENT_HOOK_PORT` comes from the desktop-provided runtime env
   - `SUPERSET_AGENT_HOOK_VERSION` comes from a single v2 constant

5. Leave shell bootstrap out of the first v2 change.

   - no `ZDOTDIR`
   - no `BASH_ENV`
   - no wrapper-specific temporary vars

6. Keep v1 and v2 builders separate.

   - v1 builder in desktop keeps the old desktop hook/runtime behavior
   - v2 builder in host-service owns the new PTY contract

## Acceptance criteria

- v2 host-service no longer spawns PTYs from raw `process.env`
- v2 host-service launch env no longer starts from raw desktop `process.env`
  without a tightening step
- user-needed shell env still works for normal tools and version managers
- v2 PTY env includes `TERM_PROGRAM=Superset`
- v2 PTY env includes `SUPERSET_TERMINAL_ID`
- v2 PTY env includes `SUPERSET_AGENT_HOOK_PORT`
- v2 PTY env includes `SUPERSET_AGENT_HOOK_VERSION`
- v2 PTY env does not include `SUPERSET_PANE_ID`
- v2 PTY env does not include `SUPERSET_TAB_ID`
- v2 PTY env does not include `SUPERSET_PORT`
- v2 PTY env does not include `SUPERSET_HOOK_VERSION`
- the v2 contract is defined in one place and documented

## Tests

Add or update tests for:

- shell-derived user env survives into PTY env
- host-service/app secrets do not leak into PTY env
- desktop/Electron runtime vars do not leak into PTY env
- `TERM_PROGRAM` and `TERM_PROGRAM_VERSION` are present
- `SUPERSET_TERMINAL_ID` is present
- `SUPERSET_AGENT_HOOK_PORT` is present
- `SUPERSET_AGENT_HOOK_VERSION` is present
- `SUPERSET_PANE_ID` is absent
- `SUPERSET_TAB_ID` is absent
- `SUPERSET_PORT` is absent
- `SUPERSET_HOOK_VERSION` is absent
- launch shell resolution prefers the user's shell and only falls back as a
  last resort

Recommended test location:

- `packages/host-service/src/terminal/env.test.ts`

## Non-goals

- changing terminal transport from workspace-scoped to terminal-scoped
- adding shell integration in this change
- recreating the full v1 desktop hook contract unchanged
- using env vars for dynamic runtime session state

## Notes for implementation

- `apps/desktop/src/main/lib/terminal/env.ts` is not the right shared source
  for v2 because it is coupled to v1 desktop shell wrappers and legacy
  notification env names
- `packages/host-service/src/terminal/terminal.ts` currently only has
  `workspaceId` on websocket attach, so launch cwd remains the workspace
  worktree path for this change
- if full `SUPERSET_WORKSPACE_NAME` parity is required, add it explicitly to
  the v2 terminal creation context instead of trying to recover it from a loose
  prefix passthrough
