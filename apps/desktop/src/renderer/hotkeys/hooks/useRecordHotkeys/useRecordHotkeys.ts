import { useEffect } from "react";
import { useRecordHotkeys as useRecordHotkeysLib } from "react-hotkeys-hook";
import { HOTKEYS, type HotkeyId, PLATFORM } from "../../registry";
import { useHotkeyOverridesStore } from "../../stores/hotkeyOverridesStore";
import type { Platform } from "../../types";

// ---------------------------------------------------------------------------
// Helpers (co-located — only used by this hook)
// ---------------------------------------------------------------------------

const MODIFIER_ORDER = ["meta", "ctrl", "alt", "shift"] as const;

/** Convert a Set of pressed keys into a canonical key string */
function keysSetToString(keys: Set<string>): string | null {
	const modifiers: string[] = [];
	let primary: string | null = null;

	for (const key of keys) {
		const lower = key.toLowerCase();
		if (MODIFIER_ORDER.includes(lower as (typeof MODIFIER_ORDER)[number])) {
			modifiers.push(lower);
		} else if (!primary) {
			primary = lower;
		}
	}

	if (!primary) return null;
	const ordered = MODIFIER_ORDER.filter((m) => modifiers.includes(m));
	return [...ordered, primary].join("+");
}

/** Canonicalize a key string: consistent modifier order, lowercase */
function canonicalize(keys: string): string | null {
	const parts = keys
		.toLowerCase()
		.split("+")
		.map((p) => p.trim())
		.filter(Boolean);
	const modifiers: string[] = [];
	let primary: string | null = null;

	for (const part of parts) {
		if (MODIFIER_ORDER.includes(part as (typeof MODIFIER_ORDER)[number])) {
			modifiers.push(part);
		} else if (!primary) {
			primary = part;
		} else {
			return null;
		}
	}

	if (!primary) return null;
	const ordered = MODIFIER_ORDER.filter((m) => modifiers.includes(m));
	return [...ordered, primary].join("+");
}

/** App hotkeys must include ctrl or meta (or be F1-F12) */
function isValidAppHotkey(keys: string): boolean {
	const lower = keys.toLowerCase();
	if (/\bf([1-9]|1[0-2])\b/.test(lower)) return true;
	return lower.includes("ctrl+") || lower.includes("meta+");
}

const TERMINAL_RESERVED = new Set([
	"ctrl+c",
	"ctrl+d",
	"ctrl+z",
	"ctrl+s",
	"ctrl+q",
	"ctrl+\\",
]);

const OS_RESERVED: Record<Platform, string[]> = {
	mac: ["meta+q", "meta+space", "meta+tab"],
	windows: ["alt+f4", "alt+tab", "ctrl+alt+delete"],
	linux: ["alt+f4", "alt+tab"],
};

function checkReserved(
	keys: string,
	platform: Platform,
): { reason: string; severity: "error" | "warning" } | null {
	const normalized = keys.toLowerCase();
	if (TERMINAL_RESERVED.has(normalized)) {
		return { reason: "Reserved by terminal", severity: "error" };
	}
	if (OS_RESERVED[platform].includes(normalized)) {
		return { reason: "Reserved by OS", severity: "warning" };
	}
	return null;
}

function getHotkeyConflict(keys: string, excludeId: HotkeyId): HotkeyId | null {
	const canonical = canonicalize(keys);
	if (!canonical) return null;
	const { overrides } = useHotkeyOverridesStore.getState();

	for (const id of Object.keys(HOTKEYS) as HotkeyId[]) {
		if (id === excludeId) continue;
		const effective = id in overrides ? overrides[id] : HOTKEYS[id].key;
		if (effective === canonical) return id;
	}
	return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseRecordHotkeysOptions {
	onSave?: (id: HotkeyId, keys: string) => void;
	onUnassign?: (id: HotkeyId) => void;
	onConflict?: (targetId: HotkeyId, keys: string, conflictId: HotkeyId) => void;
	onReserved?: (
		keys: string,
		info: { reason: string; severity: "error" | "warning" },
	) => void;
}

export function useRecordHotkeys(
	recordingId: HotkeyId | null,
	options?: UseRecordHotkeysOptions,
) {
	const [keys, recorder] = useRecordHotkeysLib();
	const setOverride = useHotkeyOverridesStore((s) => s.setOverride);
	const resetOverride = useHotkeyOverridesStore((s) => s.resetOverride);

	useEffect(() => {
		if (recordingId) recorder.start();
		else recorder.stop();
	}, [recordingId, recorder]);

	useEffect(() => {
		if (!recorder.isRecording || keys.size === 0 || !recordingId) return;

		if (keys.has("escape")) {
			recorder.stop();
			recorder.resetKeys();
			return;
		}

		if (keys.has("backspace") || keys.has("delete")) {
			resetOverride(recordingId);
			recorder.stop();
			recorder.resetKeys();
			options?.onUnassign?.(recordingId);
			return;
		}

		const canonical = keysSetToString(keys);
		if (!canonical) return;
		if (!isValidAppHotkey(canonical)) return;
		if (PLATFORM !== "mac" && canonical.includes("meta+")) return;

		recorder.stop();
		recorder.resetKeys();

		const reserved = checkReserved(canonical, PLATFORM);
		if (reserved?.severity === "error") {
			options?.onReserved?.(canonical, reserved);
			return;
		}

		const conflictId = getHotkeyConflict(canonical, recordingId);
		if (conflictId) {
			options?.onConflict?.(recordingId, canonical, conflictId);
			return;
		}

		if (reserved?.severity === "warning") {
			options?.onReserved?.(canonical, reserved);
		}

		const defaultKey = HOTKEYS[recordingId].key;
		if (canonical === defaultKey) {
			resetOverride(recordingId);
		} else {
			setOverride(recordingId, canonical);
		}
		options?.onSave?.(recordingId, canonical);
	}, [keys, recorder, recordingId, setOverride, resetOverride, options]);

	return { isRecording: recorder.isRecording };
}
