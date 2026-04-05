/**
 * One-time migration from the old hotkey storage (main process JSON file via tRPC)
 * to the new localStorage-based Zustand store.
 *
 * No-op if the new store key already exists (Zustand persist creates it on first init).
 */

import { electronTrpcClient } from "renderer/lib/trpc-client";
import { PLATFORM } from "./registry";

const PLATFORM_MAP = {
	mac: "darwin",
	windows: "win32",
	linux: "linux",
} as const;

export async function migrateHotkeyOverrides(): Promise<void> {
	if (localStorage.getItem("hotkey-overrides")) return;

	try {
		const oldState = await electronTrpcClient.uiState.hotkeys.get.query();
		const oldPlatformKey = PLATFORM_MAP[PLATFORM];
		const oldOverrides = oldState?.byPlatform?.[oldPlatformKey];
		if (!oldOverrides || Object.keys(oldOverrides).length === 0) return;

		localStorage.setItem(
			"hotkey-overrides",
			JSON.stringify({ state: { overrides: oldOverrides }, version: 0 }),
		);
		console.log(
			`[hotkeys] Migrated ${Object.keys(oldOverrides).length} override(s)`,
		);
	} catch {
		// Old endpoint gone or failed — start fresh
	}
}
