import type { Terminal } from "@xterm/xterm";
import { quote } from "shell-quote";

export function shellEscapePaths(paths: string[]): string {
	return quote(paths);
}

export function scrollToBottom(terminal: Terminal): void {
	terminal.scrollToBottom();
}

/**
 * Write data to the terminal while preserving the user's scroll position.
 *
 * When the viewport is at the bottom, xterm's default auto-scroll behaviour
 * is left intact.  When the user has scrolled up to read earlier output, the
 * current viewport line is captured *before* the write and restored in the
 * write callback so that incoming data does not yank the viewport to the top
 * of the scrollback buffer (see #2937).
 */
export function writePreservingScroll(terminal: Terminal, data: string): void {
	const buffer = terminal.buffer.active;
	const isAtBottom = buffer.viewportY >= buffer.baseY;

	if (isAtBottom) {
		terminal.write(data);
		return;
	}

	const savedViewportY = buffer.viewportY;
	terminal.write(data, () => {
		if (terminal.buffer.active.viewportY !== savedViewportY) {
			terminal.scrollToLine(savedViewportY);
		}
	});
}
