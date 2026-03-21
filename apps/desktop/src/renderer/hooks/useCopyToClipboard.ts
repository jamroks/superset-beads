import { useCallback } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";

/**
 * Copy text to clipboard via Electron's native clipboard API (IPC).
 *
 * Unlike `navigator.clipboard.writeText`, this works regardless of
 * document focus — no DOMException when a terminal or webview has focus.
 */
export function useCopyToClipboard() {
	const { mutate } = electronTrpc.external.copyPath.useMutation();
	return useCallback((text: string) => mutate(text), [mutate]);
}
