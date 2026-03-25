import { describe, expect, test } from "bun:test";
// biome-ignore lint/style/noRestrictedImports: test file needs fs/path for source verification
import { readFileSync } from "node:fs";
// biome-ignore lint/style/noRestrictedImports: test file needs fs/path for source verification
import { join } from "node:path";

function readSource(relativePath: string): string {
	return readFileSync(join(__dirname, relativePath), "utf-8");
}

describe("Collapsed sidebar icon alignment (#2874)", () => {
	test("project header wrapper centers its content when sidebar is collapsed", () => {
		const source = readSource("ProjectSection.tsx");

		// The collapsed branch wraps ProjectHeader in a div.
		// That wrapper must use flex + justify-center so the project thumbnail
		// aligns horizontally with the workspace icons below it (which are
		// centered via their parent's items-center).
		expect(source).toContain('className="flex w-full justify-center"');
	});

	test("collapsed workspace items container centers children", () => {
		const source = readSource("ProjectSection.tsx");

		// The container that holds workspace items in collapsed mode must
		// use items-center to horizontally center the icon buttons.
		expect(source).toContain("flex flex-col items-center gap-1 pt-1");
	});

	test("collapsed project section uses items-center on outer container", () => {
		const source = readSource("ProjectSection.tsx");

		// The outer collapsed container must center its children so both
		// the project header row and workspace items row align.
		expect(source).toContain(
			"flex flex-col items-center py-2 border-b border-border last:border-b-0",
		);
	});
});
