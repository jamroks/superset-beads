import { describe, expect, it, mock } from "bun:test";
import type { Terminal } from "@xterm/xterm";
import { writePreservingScroll } from "./utils";

/**
 * Minimal mock that simulates xterm.js buffer and scroll behaviour.
 *
 * viewportY = current viewport scroll position (0 = top)
 * baseY     = maximum scrollable line (grows when content exceeds rows)
 *
 * "At bottom" means viewportY >= baseY.
 */
function createTerminalMock(opts: { viewportY: number; baseY: number }) {
	let viewportY = opts.viewportY;
	let baseY = opts.baseY;

	const writeMock = mock((_data: string, callback?: () => void) => {
		// Simulate xterm adding content — baseY grows
		baseY += 1;

		// Simulate the bug: xterm resets viewportY to 0 on write
		// when showScrollbar is false (observed in xterm 6.x beta)
		viewportY = 0;

		callback?.();
	});

	const scrollToLineMock = mock((line: number) => {
		viewportY = line;
	});

	const terminal = {
		buffer: {
			get active() {
				return {
					get viewportY() {
						return viewportY;
					},
					get baseY() {
						return baseY;
					},
				};
			},
		},
		write: writeMock,
		scrollToLine: scrollToLineMock,
		scrollToBottom: mock(() => {
			viewportY = baseY;
		}),
	} as unknown as Terminal;

	return {
		terminal,
		writeMock,
		scrollToLineMock,
		getViewportY: () => viewportY,
		getBaseY: () => baseY,
	};
}

describe("writePreservingScroll", () => {
	it("preserves scroll position when user has scrolled up (#2937)", () => {
		// User is at viewportY=50, with baseY=100 (scrolled up)
		const { terminal, scrollToLineMock, getViewportY } = createTerminalMock({
			viewportY: 50,
			baseY: 100,
		});

		writePreservingScroll(terminal, "new output data\r\n");

		// The scroll position must be restored to where the user was reading
		expect(scrollToLineMock).toHaveBeenCalledWith(50);
		expect(getViewportY()).toBe(50);
	});

	it("allows auto-scroll when viewport is at the bottom", () => {
		// User is at the bottom (viewportY === baseY)
		const { terminal, scrollToLineMock, writeMock } = createTerminalMock({
			viewportY: 100,
			baseY: 100,
		});

		writePreservingScroll(terminal, "new output data\r\n");

		// Should use plain write — no scroll restoration needed
		expect(writeMock).toHaveBeenCalledTimes(1);
		expect(scrollToLineMock).not.toHaveBeenCalled();
	});

	it("does not call scrollToLine when viewport was not displaced", () => {
		// Simulate a terminal that does NOT reset viewportY on write
		const viewportY = 50;
		let baseY = 100;
		const scrollToLineMock = mock(() => {});
		const terminal = {
			buffer: {
				get active() {
					return {
						get viewportY() {
							return viewportY;
						},
						get baseY() {
							return baseY;
						},
					};
				},
			},
			write: mock((_data: string, cb?: () => void) => {
				baseY += 1;
				// viewportY stays the same — no bug in this scenario
				cb?.();
			}),
			scrollToLine: scrollToLineMock,
		} as unknown as Terminal;

		writePreservingScroll(terminal, "data");

		// viewportY was not displaced, so scrollToLine should not be called
		expect(scrollToLineMock).not.toHaveBeenCalled();
	});

	it("handles scroll near the top of the buffer", () => {
		// User scrolled to the very top
		const { terminal, getViewportY } = createTerminalMock({
			viewportY: 0,
			baseY: 200,
		});

		writePreservingScroll(terminal, "output");

		// Even at viewportY=0, the position is "scrolled up" (not at bottom),
		// but since the bug resets to 0, scrollToLine won't fire because
		// viewportY === savedViewportY (both 0). This is correct — no fix needed.
		// The key guarantee is that we don't scroll AWAY from 0.
		expect(getViewportY()).toBe(0);
	});

	it("preserves position when slightly scrolled up from bottom", () => {
		// User is just 1 line above the bottom
		const { terminal, scrollToLineMock, getViewportY } = createTerminalMock({
			viewportY: 99,
			baseY: 100,
		});

		writePreservingScroll(terminal, "more text");

		expect(scrollToLineMock).toHaveBeenCalledWith(99);
		expect(getViewportY()).toBe(99);
	});
});
