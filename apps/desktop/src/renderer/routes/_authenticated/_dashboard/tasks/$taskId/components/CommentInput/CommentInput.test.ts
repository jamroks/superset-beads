import { describe, expect, test } from "bun:test";
// biome-ignore lint/style/noRestrictedImports: test file needs fs/path for source verification
import { readFileSync } from "node:fs";
// biome-ignore lint/style/noRestrictedImports: test file needs fs/path for source verification
import { join } from "node:path";

function readSource(): string {
	return readFileSync(join(__dirname, "CommentInput.tsx"), "utf-8");
}

describe("CommentInput - #2951", () => {
	test("renders an interactive input element, not a static div", () => {
		const source = readSource();
		// The component must contain an actual input element (textarea, input, or contentEditable)
		// so users can type comments. A static <div> with placeholder text is not interactive.
		const hasTextarea = source.includes("<textarea");
		const hasInput = source.includes("<input");
		const hasContentEditable = source.includes("contentEditable");
		expect(hasTextarea || hasInput || hasContentEditable).toBe(true);
	});

	test("manages user input via state or controlled value", () => {
		const source = readSource();
		// The component must track what the user types
		const hasState = source.includes("useState");
		const hasOnChange = source.includes("onChange");
		expect(hasState || hasOnChange).toBe(true);
	});
});
