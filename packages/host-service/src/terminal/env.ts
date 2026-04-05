/**
 * V2 terminal environment contract.
 *
 * Composes the final PTY env from:
 * - env-strip.ts: runtime env stripping
 * - shell-launch.ts: shell resolution, bootstrap env, launch args
 * - this file: locale normalization, metadata injection, final assembly
 *
 * This is the single source of truth for v2 PTY env construction.
 * Does NOT reuse the v1 desktop terminal env builder.
 */

// Re-export sub-modules for consumers that import from "./env"
export { stripTerminalRuntimeEnv } from "./env-strip";
export {
	getShellBootstrapEnv,
	getShellLaunchArgs,
	getSupersetShellPaths,
	resolveLaunchShell,
} from "./shell-launch";
export type { ShellBootstrapParams, ShellLaunchParams } from "./shell-launch";

import { stripTerminalRuntimeEnv } from "./env-strip";
import { getShellBootstrapEnv } from "./shell-launch";

// ── Locale ───────────────────────────────────────────────────────────

/**
 * Normalize a UTF-8 locale from the base env.
 *
 * Matches VS Code's getLangEnvVariable pattern: prefer existing locale
 * from the env, default to en_US.UTF-8.
 */
export function normalizeUtf8Locale(baseEnv: Record<string, string>): string {
	if (baseEnv.LANG?.includes("UTF-8")) return baseEnv.LANG;
	if (baseEnv.LC_ALL?.includes("UTF-8")) return baseEnv.LC_ALL;
	return "en_US.UTF-8";
}

// ── V2 terminal env construction ─────────────────────────────────────

interface BuildV2TerminalEnvParams {
	baseEnv: Record<string, string>;
	shell: string;
	supersetHomeDir: string;
	cwd: string;
	terminalId: string;
	workspaceId: string;
	workspacePath: string;
	rootPath: string;
}

/**
 * Build the final v2 PTY environment.
 *
 * Assembly order:
 * 1. Strip runtime/secret keys from host-service process env
 * 2. Merge shell bootstrap env (zsh ZDOTDIR redirect, etc.)
 * 3. Inject public terminal surface (TERM, TERM_PROGRAM, COLORTERM, LANG)
 * 4. Inject Superset v2 metadata (terminal/workspace/agent hook vars)
 */
export function buildV2TerminalEnv(
	params: BuildV2TerminalEnvParams,
): Record<string, string> {
	const {
		baseEnv,
		shell,
		supersetHomeDir,
		cwd,
		terminalId,
		workspaceId,
		workspacePath,
		rootPath,
	} = params;

	// 1. Strip runtime keys
	const env = stripTerminalRuntimeEnv(baseEnv);

	// 2. Merge shell bootstrap env
	const bootstrapEnv = getShellBootstrapEnv({
		shell,
		baseEnv,
		supersetHomeDir,
	});
	Object.assign(env, bootstrapEnv);

	// 3. Public terminal surface
	env.TERM = "xterm-256color";
	env.TERM_PROGRAM = "Superset";
	env.TERM_PROGRAM_VERSION = baseEnv.HOST_SERVICE_VERSION || "unknown";
	env.COLORTERM = "truecolor";
	env.LANG = normalizeUtf8Locale(baseEnv);
	env.PWD = cwd;

	// 4. Superset v2 metadata
	env.SUPERSET_TERMINAL_ID = terminalId;
	env.SUPERSET_WORKSPACE_ID = workspaceId;
	env.SUPERSET_WORKSPACE_PATH = workspacePath;
	env.SUPERSET_ROOT_PATH = rootPath;
	env.SUPERSET_ENV =
		baseEnv.NODE_ENV === "development" ? "development" : "production";

	// Explicit agent hook vars (authoritative values from host-service process env)
	if (baseEnv.SUPERSET_AGENT_HOOK_PORT) {
		env.SUPERSET_AGENT_HOOK_PORT = baseEnv.SUPERSET_AGENT_HOOK_PORT;
	}
	if (baseEnv.SUPERSET_AGENT_HOOK_VERSION) {
		env.SUPERSET_AGENT_HOOK_VERSION = baseEnv.SUPERSET_AGENT_HOOK_VERSION;
	}

	return env;
}
