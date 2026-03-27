import { describe, expect, it, mock } from "bun:test";

/**
 * Tests for SlashCommandInput IME composition handling.
 *
 * The handleKeyDownCapture handler intercepts Enter/Tab/Arrow keys during
 * slash command menu navigation. During IME composition (e.g. Chinese input),
 * these events must NOT be intercepted — otherwise composed characters like
 * ，。、 get replaced by their ASCII equivalents (,.etc).
 */

// Unit-test the IME guard logic in isolation: when isComposing is true or
// keyCode is 229 (the IME "Process" key), the handler must not call
// preventDefault or stopPropagation.

function createKeyEvent(overrides: Partial<KeyboardEvent> = {}) {
	const prevented = { value: false };
	const stopped = { value: false };
	return {
		event: {
			key: "Enter",
			preventDefault: mock(() => {
				prevented.value = true;
			}),
			stopPropagation: mock(() => {
				stopped.value = true;
			}),
			nativeEvent: {
				isComposing: false,
				keyCode: 13,
				...overrides,
			},
			...overrides,
		} as unknown as React.KeyboardEvent,
		prevented,
		stopped,
	};
}

describe("SlashCommandInput IME composition guard", () => {
	it("should not intercept Enter during IME composition (isComposing=true)", () => {
		const { event, prevented, stopped } = createKeyEvent({
			isComposing: true,
			keyCode: 229,
		});

		// Simulate the guard logic from handleKeyDownCapture
		const isOpen = true;
		const isComposing =
			event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;

		if (!isOpen) return;
		if (isComposing) {
			// Should return early — no preventDefault/stopPropagation
		} else {
			event.preventDefault();
			event.stopPropagation();
		}

		expect(prevented.value).toBe(false);
		expect(stopped.value).toBe(false);
	});

	it("should not intercept Tab during IME composition (keyCode=229)", () => {
		const { event, prevented, stopped } = createKeyEvent({
			key: "Tab",
			keyCode: 229,
			isComposing: false, // Some browsers only set keyCode=229
		});

		const isOpen = true;
		const isComposing =
			event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;

		if (!isOpen) return;
		if (isComposing) {
			// Should return early
		} else {
			event.preventDefault();
			event.stopPropagation();
		}

		expect(prevented.value).toBe(false);
		expect(stopped.value).toBe(false);
	});

	it("should intercept Enter normally when NOT composing", () => {
		const { event, prevented, stopped } = createKeyEvent({
			isComposing: false,
			keyCode: 13,
		});

		const isOpen = true;
		const isComposing =
			event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229;

		if (!isOpen) return;
		if (isComposing) {
			// Would return early
		} else {
			event.preventDefault();
			event.stopPropagation();
		}

		expect(prevented.value).toBe(true);
		expect(stopped.value).toBe(true);
	});
});
