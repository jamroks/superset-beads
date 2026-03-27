import { describe, expect, test } from "bun:test";
// biome-ignore lint/style/noRestrictedImports: test file needs fs for source verification
import { readFileSync } from "node:fs";
// biome-ignore lint/style/noRestrictedImports: test file needs path for source verification
import { join } from "node:path";

/**
 * Regression test for https://github.com/anthropics/superset/issues/2944
 *
 * When a user enters a large amount of text in the "New issue" description,
 * the dialog content overflows and scrolling breaks because the description
 * container lacked overflow-y-auto and min-h-0 styles.
 */

const DIALOG_DIR = __dirname;

function readComponent(relativePath: string): string {
	return readFileSync(join(DIALOG_DIR, relativePath), "utf-8");
}

describe("CreateTaskDialog scroll behavior (#2944)", () => {
	test("DialogContent has overflow-hidden and max-height to constrain the dialog", () => {
		const source = readComponent("CreateTaskDialog.tsx");

		expect(source).toContain("overflow-hidden");
		expect(source).toContain("max-h-[");
	});

	test("description container has overflow-y-auto so large content scrolls", () => {
		const source = readComponent("CreateTaskDialog.tsx");

		// The description wrapper div must allow vertical scrolling
		expect(source).toContain("overflow-y-auto");
	});

	test("description container has min-h-0 to allow flex shrinking", () => {
		const source = readComponent("CreateTaskDialog.tsx");

		// min-h-0 is required on flex children so they can shrink below content size
		// and allow overflow-y-auto to activate
		expect(source).toContain("min-h-0 flex-1 overflow-y-auto");
	});
});
