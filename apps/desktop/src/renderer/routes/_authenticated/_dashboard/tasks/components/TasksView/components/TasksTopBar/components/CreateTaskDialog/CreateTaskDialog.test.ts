import { describe, expect, test } from "bun:test";

/**
 * Structural tests for the CreateTaskDialog component.
 *
 * The dialog uses a fixed max-height container (`max-h-[min(72vh,640px)]`) with
 * `overflow-hidden`. When the description editor content exceeds the available
 * space, the scrollable content area MUST have `overflow-y-auto` so the user
 * can scroll. Without it, content is clipped and the UI breaks (see #2945).
 */

const componentSource = await Bun.file(
	`${import.meta.dir}/CreateTaskDialog.tsx`,
).text();

describe("CreateTaskDialog", () => {
	describe("scrollable content area (#2945)", () => {
		test("dialog content wrapper has overflow-hidden to contain content", () => {
			// The DialogContent should have overflow-hidden so only the inner
			// scrollable area scrolls, not the entire dialog.
			expect(componentSource).toContain("overflow-hidden");
		});

		test("inner content area has overflow-y-auto for scrolling long descriptions", () => {
			// The content area between the header and footer must be scrollable.
			// Without this, entering a large description clips the content.
			expect(componentSource).toContain("overflow-y-auto");
		});

		test("inner content area has min-h-0 to allow flex shrinking", () => {
			// In a flex column layout, min-h-0 is required for overflow to work
			// on a flex child. Without it, the flex item won't shrink below its
			// content size and overflow-y-auto has no effect.
			expect(componentSource).toContain(
				"min-h-0 flex-1 flex-col overflow-y-auto",
			);
		});
	});
});
