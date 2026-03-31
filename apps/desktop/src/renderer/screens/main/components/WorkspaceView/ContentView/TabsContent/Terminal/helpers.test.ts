import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import type { Terminal as XTerm } from "@xterm/xterm";

// Mock localStorage for Node.js test environment
const mockStorage = new Map<string, string>();
const mockLocalStorage = {
	getItem: (key: string) => mockStorage.get(key) ?? null,
	setItem: (key: string, value: string) => mockStorage.set(key, value),
	removeItem: (key: string) => mockStorage.delete(key),
	clear: () => mockStorage.clear(),
};

// @ts-expect-error - mocking global localStorage
globalThis.localStorage = mockLocalStorage;

// Mock trpc-client to avoid electronTRPC dependency
mock.module("renderer/lib/trpc-client", () => ({
	electronTrpcClient: {
		external: {
			openUrl: { mutate: mock(() => Promise.resolve()) },
			openFileInEditor: { mutate: mock(() => Promise.resolve()) },
		},
		uiState: {
			hotkeys: {
				get: { query: mock(() => Promise.resolve(null)) },
				set: { mutate: mock(() => Promise.resolve()) },
			},
			theme: {
				get: { query: mock(() => Promise.resolve(null)) },
				set: { mutate: mock(() => Promise.resolve()) },
			},
		},
	},
	electronReactClient: {},
}));

// Import after mocks are set up
const {
	getDefaultTerminalBg,
	getDefaultTerminalTheme,
	setupCopyHandler,
	setupKeyboardHandler,
	setupPasteHandler,
} = await import("./helpers");

describe("getDefaultTerminalTheme", () => {
	beforeEach(() => {
		mockStorage.clear();
	});

	afterEach(() => {
		mockStorage.clear();
	});

	it("should return cached terminal colors from localStorage", () => {
		const cachedTerminal = {
			background: "#272822",
			foreground: "#f8f8f2",
			cursor: "#f8f8f0",
			red: "#f92672",
			green: "#a6e22e",
		};
		localStorage.setItem("theme-terminal", JSON.stringify(cachedTerminal));

		const theme = getDefaultTerminalTheme();

		expect(theme.background).toBe("#272822");
		expect(theme.foreground).toBe("#f8f8f2");
		expect(theme.cursor).toBe("#f8f8f0");
	});

	it("should fall back to theme-id lookup when no cached terminal", () => {
		localStorage.setItem("theme-id", "light");

		const theme = getDefaultTerminalTheme();

		// Light theme has white background
		expect(theme.background).toBe("#ffffff");
	});

	it("should fall back to default dark theme when localStorage is empty", () => {
		const theme = getDefaultTerminalTheme();

		// Default theme is dark (ember)
		expect(theme.background).toBe("#151110");
	});

	it("should handle invalid JSON in cached terminal gracefully", () => {
		localStorage.setItem("theme-terminal", "invalid json{");

		const theme = getDefaultTerminalTheme();

		// Should fall back to default
		expect(theme.background).toBe("#151110");
	});
});

afterAll(() => {
	mock.restore();
});

describe("getDefaultTerminalBg", () => {
	beforeEach(() => {
		mockStorage.clear();
	});

	afterEach(() => {
		mockStorage.clear();
	});

	it("should return background from cached theme", () => {
		localStorage.setItem(
			"theme-terminal",
			JSON.stringify({ background: "#282c34" }),
		);

		expect(getDefaultTerminalBg()).toBe("#282c34");
	});

	it("should return default background when no cache", () => {
		expect(getDefaultTerminalBg()).toBe("#151110");
	});
});

describe("setupKeyboardHandler", () => {
	const originalNavigator = globalThis.navigator;

	afterEach(() => {
		// Restore navigator between tests
		globalThis.navigator = originalNavigator;
	});

	it("maps Option+Left/Right to Meta+B/F on macOS", () => {
		// @ts-expect-error - mocking navigator for tests
		globalThis.navigator = { platform: "MacIntel" };

		const captured: { handler: ((event: KeyboardEvent) => boolean) | null } = {
			handler: null,
		};
		const xterm = {
			attachCustomKeyEventHandler: (
				next: (event: KeyboardEvent) => boolean,
			) => {
				captured.handler = next;
			},
		};

		const onWrite = mock(() => {});
		setupKeyboardHandler(xterm as unknown as XTerm, { onWrite });

		captured.handler?.({
			type: "keydown",
			key: "ArrowLeft",
			altKey: true,
			metaKey: false,
			ctrlKey: false,
			shiftKey: false,
		} as KeyboardEvent);
		captured.handler?.({
			type: "keydown",
			key: "ArrowRight",
			altKey: true,
			metaKey: false,
			ctrlKey: false,
			shiftKey: false,
		} as KeyboardEvent);

		expect(onWrite).toHaveBeenCalledWith("\x1bb");
		expect(onWrite).toHaveBeenCalledWith("\x1bf");
	});

	it("maps Ctrl+Left/Right to Meta+B/F on Windows", () => {
		// @ts-expect-error - mocking navigator for tests
		globalThis.navigator = { platform: "Win32" };

		const captured: { handler: ((event: KeyboardEvent) => boolean) | null } = {
			handler: null,
		};
		const xterm = {
			attachCustomKeyEventHandler: (
				next: (event: KeyboardEvent) => boolean,
			) => {
				captured.handler = next;
			},
		};

		const onWrite = mock(() => {});
		setupKeyboardHandler(xterm as unknown as XTerm, { onWrite });

		captured.handler?.({
			type: "keydown",
			key: "ArrowLeft",
			altKey: false,
			metaKey: false,
			ctrlKey: true,
			shiftKey: false,
		} as KeyboardEvent);
		captured.handler?.({
			type: "keydown",
			key: "ArrowRight",
			altKey: false,
			metaKey: false,
			ctrlKey: true,
			shiftKey: false,
		} as KeyboardEvent);

		expect(onWrite).toHaveBeenCalledWith("\x1bb");
		expect(onWrite).toHaveBeenCalledWith("\x1bf");
	});
});

describe("setupCopyHandler", () => {
	const originalNavigator = globalThis.navigator;

	afterEach(() => {
		globalThis.navigator = originalNavigator;
	});

	function createXtermStub(selection: string) {
		const listeners = new Map<string, EventListener>();
		const element = {
			addEventListener: mock((eventName: string, listener: EventListener) => {
				listeners.set(eventName, listener);
			}),
			removeEventListener: mock((eventName: string) => {
				listeners.delete(eventName);
			}),
		} as unknown as HTMLElement;
		const xterm = {
			element,
			getSelection: mock(() => selection),
		} as unknown as XTerm;
		return { xterm, listeners };
	}

	it("trims trailing whitespace and writes to clipboardData when available", () => {
		const { xterm, listeners } = createXtermStub("foo   \nbar  ");
		setupCopyHandler(xterm);

		const preventDefault = mock(() => {});
		const setData = mock(() => {});
		const copyEvent = {
			preventDefault,
			clipboardData: { setData },
		} as unknown as ClipboardEvent;

		const copyListener = listeners.get("copy");
		expect(copyListener).toBeDefined();
		copyListener?.(copyEvent);

		expect(preventDefault).toHaveBeenCalled();
		expect(setData).toHaveBeenCalledWith("text/plain", "foo\nbar");
	});

	it("prefers clipboardData path over navigator.clipboard fallback", () => {
		const { xterm, listeners } = createXtermStub("foo   \nbar  ");
		const writeText = mock(() => Promise.resolve());

		// @ts-expect-error - mocking navigator for tests
		globalThis.navigator = { clipboard: { writeText } };

		setupCopyHandler(xterm);

		const preventDefault = mock(() => {});
		const setData = mock(() => {});
		const copyEvent = {
			preventDefault,
			clipboardData: { setData },
		} as unknown as ClipboardEvent;

		const copyListener = listeners.get("copy");
		expect(copyListener).toBeDefined();
		copyListener?.(copyEvent);

		expect(preventDefault).toHaveBeenCalled();
		expect(setData).toHaveBeenCalledWith("text/plain", "foo\nbar");
		expect(writeText).not.toHaveBeenCalled();
	});

	it("falls back to navigator.clipboard.writeText when clipboardData is missing", () => {
		const { xterm, listeners } = createXtermStub("foo   \nbar  ");
		const writeText = mock(() => Promise.resolve());

		// @ts-expect-error - mocking navigator for tests
		globalThis.navigator = { clipboard: { writeText } };

		setupCopyHandler(xterm);

		const preventDefault = mock(() => {});
		const copyEvent = {
			preventDefault,
			clipboardData: null,
		} as unknown as ClipboardEvent;

		const copyListener = listeners.get("copy");
		expect(copyListener).toBeDefined();
		copyListener?.(copyEvent);

		expect(preventDefault).not.toHaveBeenCalled();
		expect(writeText).toHaveBeenCalledWith("foo\nbar");
	});

	it("does not throw when clipboardData is missing and navigator.clipboard is unavailable", () => {
		const { xterm, listeners } = createXtermStub("foo   \nbar  ");

		// @ts-expect-error - mocking navigator for tests
		globalThis.navigator = {};

		setupCopyHandler(xterm);

		const copyEvent = {
			preventDefault: mock(() => {}),
			clipboardData: null,
		} as unknown as ClipboardEvent;

		const copyListener = listeners.get("copy");
		expect(copyListener).toBeDefined();
		expect(() => copyListener?.(copyEvent)).not.toThrow();
	});
});

/**
 * Tests for terminal scroll position preservation during resize.
 *
 * Reproduces: https://github.com/anthropics/claude-code/issues/3057
 *
 * When the terminal container resizes (e.g. sidebar toggle, window resize),
 * fitAddon.fit() is called which can reset the viewport scroll position.
 * The resize handler must preserve the user's scroll position when they
 * are NOT at the bottom of the scrollback buffer.
 */
describe("setupResizeHandlers scroll preservation", () => {
	interface MockBuffer {
		viewportY: number;
		baseY: number;
	}

	function createMockTerminal(opts?: { viewportY?: number; baseY?: number }) {
		const buffer: MockBuffer = {
			viewportY: opts?.viewportY ?? 0,
			baseY: opts?.baseY ?? 0,
		};
		return {
			buffer: { active: buffer },
			cols: 80,
			rows: 24,
			scrollToBottom: mock(() => {
				buffer.viewportY = buffer.baseY;
			}),
			scrollToLine: mock((line: number) => {
				buffer.viewportY = Math.max(0, Math.min(line, buffer.baseY));
			}),
		};
	}

	function createMockFitAddon(
		terminal: ReturnType<typeof createMockTerminal>,
		opts?: { resetsViewport?: boolean },
	) {
		return {
			fit: mock(() => {
				if (opts?.resetsViewport) {
					terminal.buffer.active.viewportY = 0;
				}
			}),
		};
	}

	/**
	 * Simulates the resize handler logic from setupResizeHandlers (BEFORE the fix).
	 * The old code only restored scroll when the user was at the bottom.
	 */
	function resizeHandlerBefore(
		xterm: ReturnType<typeof createMockTerminal>,
		fitAddon: ReturnType<typeof createMockFitAddon>,
	) {
		const buffer = xterm.buffer.active;
		const wasAtBottom = buffer.viewportY >= buffer.baseY;
		fitAddon.fit();
		if (wasAtBottom) {
			xterm.scrollToBottom();
		}
	}

	/**
	 * Simulates the resize handler logic from setupResizeHandlers (AFTER the fix).
	 * The new code preserves scroll position when the user is NOT at the bottom.
	 */
	function resizeHandlerAfter(
		xterm: ReturnType<typeof createMockTerminal>,
		fitAddon: ReturnType<typeof createMockFitAddon>,
	) {
		const buffer = xterm.buffer.active;
		const wasAtBottom = buffer.viewportY >= buffer.baseY;
		const prevViewportY = buffer.viewportY;
		fitAddon.fit();
		if (wasAtBottom) {
			xterm.scrollToBottom();
		} else if (buffer.viewportY !== prevViewportY) {
			xterm.scrollToLine(Math.min(prevViewportY, buffer.baseY));
		}
	}

	describe("when user is at the bottom of scrollback", () => {
		it("scrolls to bottom after fit()", () => {
			const xterm = createMockTerminal({ viewportY: 500, baseY: 500 });
			const fitAddon = createMockFitAddon(xterm);

			resizeHandlerAfter(xterm, fitAddon);

			expect(fitAddon.fit).toHaveBeenCalledTimes(1);
			expect(xterm.scrollToBottom).toHaveBeenCalledTimes(1);
			expect(xterm.buffer.active.viewportY).toBe(500);
		});

		it("scrolls to bottom even when fit() resets viewport", () => {
			const xterm = createMockTerminal({ viewportY: 500, baseY: 500 });
			const fitAddon = createMockFitAddon(xterm, { resetsViewport: true });

			resizeHandlerAfter(xterm, fitAddon);

			expect(xterm.scrollToBottom).toHaveBeenCalledTimes(1);
			expect(xterm.buffer.active.viewportY).toBe(500);
		});
	});

	describe("when user has scrolled up (NOT at bottom)", () => {
		it("BUG: old handler loses scroll position when fit() resets viewport", () => {
			const xterm = createMockTerminal({ viewportY: 250, baseY: 500 });
			const fitAddon = createMockFitAddon(xterm, { resetsViewport: true });

			resizeHandlerBefore(xterm, fitAddon);

			// Old handler does NOT restore scroll when not at bottom
			expect(xterm.scrollToBottom).not.toHaveBeenCalled();
			// viewportY is stuck at 0 (the top) — this is the reported bug
			expect(xterm.buffer.active.viewportY).toBe(0);
		});

		it("FIX: new handler preserves scroll position after fit() resets viewport", () => {
			const xterm = createMockTerminal({ viewportY: 250, baseY: 500 });
			const fitAddon = createMockFitAddon(xterm, { resetsViewport: true });

			resizeHandlerAfter(xterm, fitAddon);

			expect(xterm.scrollToBottom).not.toHaveBeenCalled();
			expect(xterm.scrollToLine).toHaveBeenCalledWith(250);
			expect(xterm.buffer.active.viewportY).toBe(250);
		});

		it("FIX: skips scrollToLine when fit() doesn't change viewport", () => {
			const xterm = createMockTerminal({ viewportY: 250, baseY: 500 });
			const fitAddon = createMockFitAddon(xterm, { resetsViewport: false });

			resizeHandlerAfter(xterm, fitAddon);

			expect(xterm.scrollToBottom).not.toHaveBeenCalled();
			expect(xterm.scrollToLine).not.toHaveBeenCalled();
			expect(xterm.buffer.active.viewportY).toBe(250);
		});

		it("FIX: clamps to new baseY if buffer shrank after fit()", () => {
			const xterm = createMockTerminal({ viewportY: 400, baseY: 500 });
			const fitAddon = createMockFitAddon(xterm, { resetsViewport: true });
			// Simulate buffer shrinking during fit (more rows visible → fewer scrollback lines)
			fitAddon.fit = mock(() => {
				xterm.buffer.active.viewportY = 0;
				xterm.buffer.active.baseY = 300;
			});

			resizeHandlerAfter(xterm, fitAddon);

			// prevViewportY was 400, but baseY is now 300, so clamp to 300
			expect(xterm.scrollToLine).toHaveBeenCalledWith(300);
			expect(xterm.buffer.active.viewportY).toBe(300);
		});
	});
});

describe("setupPasteHandler", () => {
	function createXtermStub() {
		const listeners = new Map<string, EventListener>();
		const textarea = {
			addEventListener: mock((eventName: string, listener: EventListener) => {
				listeners.set(eventName, listener);
			}),
			removeEventListener: mock((eventName: string) => {
				listeners.delete(eventName);
			}),
		} as unknown as HTMLTextAreaElement;
		const paste = mock(() => {});
		const xterm = {
			textarea,
			paste,
		} as unknown as XTerm;
		return { xterm, listeners, paste };
	}

	it("forwards Ctrl+V for image-only clipboard payloads", () => {
		const { xterm, listeners } = createXtermStub();
		const onWrite = mock(() => {});
		setupPasteHandler(xterm, { onWrite });

		const preventDefault = mock(() => {});
		const stopImmediatePropagation = mock(() => {});
		const pasteEvent = {
			clipboardData: {
				getData: mock(() => ""),
				items: [{ kind: "file", type: "image/png" }],
				types: ["Files", "image/png"],
			},
			preventDefault,
			stopImmediatePropagation,
		} as unknown as ClipboardEvent;

		const pasteListener = listeners.get("paste");
		expect(pasteListener).toBeDefined();
		pasteListener?.(pasteEvent);

		expect(onWrite).toHaveBeenCalledWith("\x16");
		expect(preventDefault).toHaveBeenCalled();
		expect(stopImmediatePropagation).toHaveBeenCalled();
	});

	it("forwards Ctrl+V for non-text clipboard payloads without plain text", () => {
		const { xterm, listeners } = createXtermStub();
		const onWrite = mock(() => {});
		setupPasteHandler(xterm, { onWrite });

		const preventDefault = mock(() => {});
		const stopImmediatePropagation = mock(() => {});
		const pasteEvent = {
			clipboardData: {
				getData: mock(() => ""),
				items: [{ kind: "string", type: "text/html" }],
				types: ["text/html"],
			},
			preventDefault,
			stopImmediatePropagation,
		} as unknown as ClipboardEvent;

		const pasteListener = listeners.get("paste");
		expect(pasteListener).toBeDefined();
		pasteListener?.(pasteEvent);

		expect(onWrite).toHaveBeenCalledWith("\x16");
		expect(preventDefault).toHaveBeenCalled();
		expect(stopImmediatePropagation).toHaveBeenCalled();
	});

	it("ignores empty clipboard payloads", () => {
		const { xterm, listeners } = createXtermStub();
		const onWrite = mock(() => {});
		setupPasteHandler(xterm, { onWrite });

		const preventDefault = mock(() => {});
		const stopImmediatePropagation = mock(() => {});
		const pasteEvent = {
			clipboardData: {
				getData: mock(() => ""),
				items: [],
				types: [],
			},
			preventDefault,
			stopImmediatePropagation,
		} as unknown as ClipboardEvent;

		const pasteListener = listeners.get("paste");
		expect(pasteListener).toBeDefined();
		pasteListener?.(pasteEvent);

		expect(onWrite).not.toHaveBeenCalled();
		expect(preventDefault).not.toHaveBeenCalled();
		expect(stopImmediatePropagation).not.toHaveBeenCalled();
	});
});
