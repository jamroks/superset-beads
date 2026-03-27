import { describe, expect, test } from "bun:test";
// biome-ignore lint/style/noRestrictedImports: test file needs fs/path for source verification
import { readFileSync } from "node:fs";
// biome-ignore lint/style/noRestrictedImports: test file needs fs/path for source verification
import { join } from "node:path";

function readSource(): string {
	return readFileSync(join(__dirname, "PropertiesSidebar.tsx"), "utf-8");
}

describe("PropertiesSidebar labels - #2951", () => {
	test("labels section is interactive, not read-only badges", () => {
		const source = readSource();
		// Labels must be editable. A dedicated LabelsProperty component
		// (following the same pattern as StatusProperty / PriorityProperty)
		// should handle label editing.
		const hasLabelsProperty = source.includes("LabelsProperty");
		const hasDropdownOrPopover =
			source.includes("DropdownMenu") || source.includes("Popover");
		expect(hasLabelsProperty || hasDropdownOrPopover).toBe(true);
	});

	test("labels section supports adding/removing labels", () => {
		const source = readSource();
		// The sidebar should delegate label editing to a sub-component
		// that can update the task's labels array
		expect(source).toContain("LabelsProperty");
	});
});
