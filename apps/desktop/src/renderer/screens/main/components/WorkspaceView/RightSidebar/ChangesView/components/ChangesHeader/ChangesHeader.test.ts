import { describe, expect, test } from "bun:test";

/**
 * Reproduction and fix verification test for GitHub issue #3059:
 * "Changing branch from git sidebar doesn't actually checkout a branch in project and claude"
 *
 * Root cause: The Changes sidebar header had a BaseBranchSelector that only
 * called `updateBaseBranch` (comparison base for diffs) but no UI element
 * called the `switchBranch` tRPC mutation (actual `git switch`/`git checkout`).
 *
 * Fix: Added a BranchSwitcher component that calls `switchBranch` to perform
 * a real git checkout when the user selects a branch.
 */

const changesHeaderSource = await Bun.file(
	`${import.meta.dir}/ChangesHeader.tsx`,
).text();

describe("Issue #3059: Branch switching from git sidebar", () => {
	test("BaseBranchSelector still exists for comparison base selection", () => {
		expect(changesHeaderSource).toContain(
			"electronTrpc.changes.updateBaseBranch.useMutation",
		);
		expect(changesHeaderSource).toContain("updateBaseBranch.mutate");
	});

	test("BranchSwitcher calls switchBranch for actual git checkout", () => {
		expect(changesHeaderSource).toContain(
			"electronTrpc.changes.switchBranch.useMutation",
		);
		expect(changesHeaderSource).toContain("switchBranch.mutate");
	});

	test("BranchSwitcher is rendered in the ChangesHeader", () => {
		expect(changesHeaderSource).toContain("<BranchSwitcher");
	});

	test("renderer code references the switchBranch tRPC mutation", async () => {
		const glob = new Bun.Glob("**/*.{ts,tsx}");
		const rendererDir = `${import.meta.dir}/../../../../../../../../`;
		const filesReferencingSwitchBranch: string[] = [];

		for await (const relPath of glob.scan({
			cwd: rendererDir,
			absolute: false,
		})) {
			if (relPath.includes("node_modules")) continue;
			if (relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx"))
				continue;

			const content = await Bun.file(`${rendererDir}/${relPath}`).text();
			if (content.includes("changes.switchBranch")) {
				filesReferencingSwitchBranch.push(relPath);
			}
		}

		// After fix: at least one renderer file references switchBranch
		expect(filesReferencingSwitchBranch.length).toBeGreaterThan(0);
	});
});
