import { type Options, useHotkeys } from "react-hotkeys-hook";
import { formatHotkeyDisplay } from "../../display";
import type { HotkeyId } from "../../registry";
import { PLATFORM } from "../../registry";
import type { HotkeyDisplay } from "../../types";
import { useBinding } from "../useBinding";

export function useHotkey(
	id: HotkeyId,
	callback: (e: KeyboardEvent) => void,
	options?: Options,
): HotkeyDisplay {
	const keys = useBinding(id);
	useHotkeys(keys ?? "", callback, { enableOnFormTags: true, ...options }, [
		keys,
	]);
	return formatHotkeyDisplay(keys, PLATFORM);
}
