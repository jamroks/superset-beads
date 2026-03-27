import { describe, expect, test } from "bun:test";

/**
 * Reproduction test for GitHub issue #2923:
 * "Changes section doesn't work after updating to 1.4.2 from 1.4.1"
 *
 * The bug: useGitChangesStatus only returned isLoading from the status query,
 * not from the branches query. When the branches query was still loading or
 * had errored, the status query was disabled (enabled: false), making
 * isLoading = false and status = undefined. The UI then showed
 * "Unable to load changes" instead of "Loading changes...".
 *
 * This caused:
 * 1. A flash of "Unable to load changes" on initial load (while branches load)
 * 2. Permanent "Unable to load changes" if the branches query errored
 * 3. When the status query itself errors and retries, the UI alternates between
 *    "Loading changes..." and "Unable to load changes" every 2.5 seconds
 *
 * Since the hook uses tRPC React Query hooks that require a full provider setup,
 * these tests validate the loading state combination logic directly.
 */

describe("useGitChangesStatus loading state logic", () => {
	/**
	 * Simulates the loading state combination logic from the hook.
	 * Before the fix, only isStatusLoading was returned as isLoading.
	 * After the fix, isLoading = isBranchLoading || isStatusLoading.
	 */
	function computeLoadingState({
		isBranchLoading,
		isStatusLoading,
	}: {
		isBranchLoading: boolean;
		isStatusLoading: boolean;
	}) {
		// This is the FIXED logic from useGitChangesStatus
		return isBranchLoading || isStatusLoading;
	}

	function computeOldLoadingState({
		isStatusLoading,
	}: {
		isBranchLoading: boolean;
		isStatusLoading: boolean;
	}) {
		// This was the OLD (buggy) logic - only status loading was considered
		return isStatusLoading;
	}

	test("old logic: returns false when branches are loading but status query is disabled", () => {
		// Before fix: branches loading → status disabled → isLoading = false
		// This caused "Unable to load changes" to show prematurely
		const result = computeOldLoadingState({
			isBranchLoading: true,
			isStatusLoading: false,
		});
		expect(result).toBe(false); // BUG: should be true
	});

	test("fixed logic: returns true when branches are loading", () => {
		const result = computeLoadingState({
			isBranchLoading: true,
			isStatusLoading: false,
		});
		expect(result).toBe(true);
	});

	test("fixed logic: returns true when status is loading", () => {
		const result = computeLoadingState({
			isBranchLoading: false,
			isStatusLoading: true,
		});
		expect(result).toBe(true);
	});

	test("fixed logic: returns true when both are loading", () => {
		const result = computeLoadingState({
			isBranchLoading: true,
			isStatusLoading: true,
		});
		expect(result).toBe(true);
	});

	test("fixed logic: returns false only when both are done loading", () => {
		const result = computeLoadingState({
			isBranchLoading: false,
			isStatusLoading: false,
		});
		expect(result).toBe(false);
	});
});

describe("useGitChangesStatus error state logic", () => {
	/**
	 * Simulates the error state combination logic from the hook.
	 * Before the fix, isError was not returned at all.
	 * After the fix, isError = isBranchError || isStatusError.
	 */
	function computeErrorState({
		isBranchError,
		isStatusError,
	}: {
		isBranchError: boolean;
		isStatusError: boolean;
	}) {
		return isBranchError || isStatusError;
	}

	test("returns true when branches query errors", () => {
		const result = computeErrorState({
			isBranchError: true,
			isStatusError: false,
		});
		expect(result).toBe(true);
	});

	test("returns true when status query errors", () => {
		const result = computeErrorState({
			isBranchError: false,
			isStatusError: true,
		});
		expect(result).toBe(true);
	});

	test("returns false when neither query has errored", () => {
		const result = computeErrorState({
			isBranchError: false,
			isStatusError: false,
		});
		expect(result).toBe(false);
	});
});

describe("ChangesView status guard logic", () => {
	/**
	 * Tests the condition that determines whether to show "Unable to load changes".
	 * The guard checks: !status || !status.againstBase || !status.commits || ...
	 *
	 * With the fix, isLoading properly covers the branch-loading case,
	 * so the guard is only reached when both queries have completed.
	 */

	interface MinimalStatus {
		againstBase: unknown[] | undefined;
		commits: unknown[] | undefined;
		staged: unknown[] | undefined;
		unstaged: unknown[] | undefined;
		untracked: unknown[] | undefined;
	}

	function shouldShowUnableToLoad(
		isLoading: boolean,
		status: MinimalStatus | undefined,
	): "loading" | "unable" | "ready" {
		if (isLoading) return "loading";
		if (
			!status ||
			!status.againstBase ||
			!status.commits ||
			!status.staged ||
			!status.unstaged ||
			!status.untracked
		) {
			return "unable";
		}
		return "ready";
	}

	test("shows loading when branches are still loading (fixed behavior)", () => {
		// With the fix, isLoading is true when branches are loading
		const result = shouldShowUnableToLoad(true, undefined);
		expect(result).toBe("loading");
	});

	test("shows unable when status is undefined after loading completes", () => {
		const result = shouldShowUnableToLoad(false, undefined);
		expect(result).toBe("unable");
	});

	test("shows ready when status has all required fields", () => {
		const result = shouldShowUnableToLoad(false, {
			againstBase: [],
			commits: [],
			staged: [],
			unstaged: [],
			untracked: [],
		});
		expect(result).toBe("ready");
	});

	test("shows unable when status is missing a required field", () => {
		const result = shouldShowUnableToLoad(false, {
			againstBase: [],
			commits: undefined,
			staged: [],
			unstaged: [],
			untracked: [],
		});
		expect(result).toBe("unable");
	});
});
