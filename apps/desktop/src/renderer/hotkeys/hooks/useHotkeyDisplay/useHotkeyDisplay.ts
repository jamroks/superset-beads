import { useMemo } from "react";
import { formatHotkeyDisplay } from "../../display";
import type { HotkeyDisplay } from "../../types";
import { PLATFORM } from "../../registry";
import { useBinding } from "../useBinding";

export function useHotkeyDisplay(id: string): HotkeyDisplay {
	const binding = useBinding(id as Parameters<typeof useBinding>[0]);
	return useMemo(() => formatHotkeyDisplay(binding, PLATFORM), [binding]);
}
