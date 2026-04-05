/**
 * Shell launch configuration for v2 terminals.
 *
 * Determines shell binary, args, and private bootstrap env per shell.
 * Behavioral reference: apps/desktop/src/main/lib/agent-setup/shell-wrappers.ts
 *
 * Upstream patterns followed:
 * - VS Code: ZDOTDIR wrapping for zsh, --init-file for bash, --init-command for fish
 *   (src/vs/platform/terminal/node/terminalEnvironment.ts)
 * - Kitty: KITTY_ORIG_ZDOTDIR for zsh, ENV for bash, XDG_DATA_DIRS for fish
 *   (kitty/shell_integration.py)
 *
 * Key design decisions:
 * - zsh: ZDOTDIR redirect to Superset wrapper dir (matches VS Code USER_ZDOTDIR
 *   and kitty KITTY_ORIG_ZDOTDIR patterns). Only applied when wrapper files exist.
 * - bash: --rcfile with Superset rcfile that sources login profiles internally
 *   (matches VS Code --init-file pattern). Falls back to login shell when missing.
 * - fish: --init-command with inline PATH prepend + shell-ready marker
 *   (matches VS Code --init-command pattern).
 * - sh/ksh: login shell only, no custom bootstrap.
 * - Unsupported shells: native launch, no Superset-specific args.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

// ── Shell resolution ─────────────────────────────────────────────────

/**
 * Resolve the shell binary to launch.
 * Uses SHELL from the base env (which came from the shell-derived snapshot),
 * never from process.env directly.
 *
 * Does not default to /bin/zsh — falls back to /bin/sh (POSIX-guaranteed).
 */
export function resolveLaunchShell(baseEnv: Record<string, string>): string {
	if (process.platform === "win32") {
		return baseEnv.COMSPEC || "cmd.exe";
	}
	return baseEnv.SHELL || "/bin/sh";
}

// ── Superset shell paths ─────────────────────────────────────────────

export function getSupersetShellPaths(supersetHomeDir: string): {
	BIN_DIR: string;
	ZSH_DIR: string;
	BASH_DIR: string;
} {
	return {
		BIN_DIR: path.join(supersetHomeDir, "bin"),
		ZSH_DIR: path.join(supersetHomeDir, "zsh"),
		BASH_DIR: path.join(supersetHomeDir, "bash"),
	};
}

// ── Shell name helper ────────────────────────────────────────────────

function getShellName(shell: string): string {
	return path.basename(shell);
}

// ── Fish init command ────────────────────────────────────────────────

/**
 * Build the fish --init-command string.
 *
 * Matches the desktop shell-wrappers.ts fish init exactly:
 * - Idempotent PATH prepend using fish list-aware `contains`
 * - One-shot shell-ready OSC marker via fish_prompt event
 */
function buildFishInitCommand(binDir: string): string {
	const escaped = binDir
		.replaceAll("\\", "\\\\")
		.replaceAll('"', '\\"')
		.replaceAll("$", "\\$");
	return [
		`set -l _superset_bin "${escaped}"`,
		`contains -- "$_superset_bin" $PATH`,
		`or set -gx PATH "$_superset_bin" $PATH`,
		`function _superset_shell_ready --on-event fish_prompt`,
		`printf '\\033]777;superset-shell-ready\\007'`,
		`functions -e _superset_shell_ready`,
		`end`,
	].join("; ");
}

// ── Shell bootstrap env ──────────────────────────────────────────────

export interface ShellBootstrapParams {
	shell: string;
	baseEnv: Record<string, string>;
	supersetHomeDir: string;
}

/**
 * Return private bootstrap env vars needed to redirect shell startup.
 *
 * zsh: ZDOTDIR redirect (only when wrapper files exist on disk).
 *   - VS Code equivalent: sets ZDOTDIR + USER_ZDOTDIR
 *   - Kitty equivalent: sets ZDOTDIR + KITTY_ORIG_ZDOTDIR
 *   - Ours: sets ZDOTDIR + SUPERSET_ORIG_ZDOTDIR
 *
 * bash/fish/others: no bootstrap env needed — args handle everything.
 */
export function getShellBootstrapEnv(
	params: ShellBootstrapParams,
): Record<string, string> {
	const { shell, baseEnv, supersetHomeDir } = params;
	const shellName = getShellName(shell);
	const paths = getSupersetShellPaths(supersetHomeDir);

	if (shellName === "zsh") {
		const zshrc = path.join(paths.ZSH_DIR, ".zshrc");
		if (existsSync(zshrc)) {
			return {
				SUPERSET_ORIG_ZDOTDIR: baseEnv.ZDOTDIR || baseEnv.HOME || homedir(),
				ZDOTDIR: paths.ZSH_DIR,
			};
		}
	}

	return {};
}

// ── Shell launch args ────────────────────────────────────────────────

export interface ShellLaunchParams {
	shell: string;
	supersetHomeDir: string;
}

/**
 * Return the shell args for interactive PTY launch.
 *
 * zsh: login shell (-l). ZDOTDIR redirect in bootstrap env handles integration.
 * bash: --rcfile with Superset rcfile (which sources login profiles internally).
 *   Falls back to login shell (-l) when rcfile doesn't exist yet.
 * fish: login shell (-l) + --init-command for PATH prepend and shell-ready marker.
 * sh/ksh: login shell (-l) only.
 * Others: no args (native launch).
 */
export function getShellLaunchArgs(params: ShellLaunchParams): string[] {
	const { shell, supersetHomeDir } = params;
	const shellName = getShellName(shell);
	const paths = getSupersetShellPaths(supersetHomeDir);

	if (shellName === "zsh") {
		return ["-l"];
	}

	if (shellName === "bash") {
		const rcfile = path.join(paths.BASH_DIR, "rcfile");
		if (existsSync(rcfile)) {
			return ["--rcfile", rcfile];
		}
		return ["-l"];
	}

	if (shellName === "fish") {
		return ["-l", "--init-command", buildFishInitCommand(paths.BIN_DIR)];
	}

	if (shellName === "sh" || shellName === "ksh") {
		return ["-l"];
	}

	// Unsupported shells: launch natively without Superset-specific bootstrap
	return [];
}
