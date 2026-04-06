import { describe, expect, it } from "bun:test";
import { resolveSetPaneStatus } from "./utils";

describe("resolveSetPaneStatus", () => {
	const tabs = [
		{ id: "tab-1", workspaceId: "ws-1" },
		{ id: "tab-2", workspaceId: "ws-1" },
		{ id: "tab-3", workspaceId: "ws-2" },
	];

	it("returns 'idle' when setting 'review' on a pane in the active tab", () => {
		const result = resolveSetPaneStatus({
			status: "review",
			paneTabId: "tab-1",
			tabs,
			activeTabIds: { "ws-1": "tab-1" },
		});
		expect(result).toBe("idle");
	});

	it("returns 'review' when setting 'review' on a pane in a non-active tab", () => {
		const result = resolveSetPaneStatus({
			status: "review",
			paneTabId: "tab-2",
			tabs,
			activeTabIds: { "ws-1": "tab-1" },
		});
		expect(result).toBe("review");
	});

	it("passes through non-review statuses unchanged for active tab panes", () => {
		for (const status of ["idle", "working", "permission"] as const) {
			const result = resolveSetPaneStatus({
				status,
				paneTabId: "tab-1",
				tabs,
				activeTabIds: { "ws-1": "tab-1" },
			});
			expect(result).toBe(status);
		}
	});

	it("passes through non-review statuses unchanged for non-active tab panes", () => {
		for (const status of ["idle", "working", "permission"] as const) {
			const result = resolveSetPaneStatus({
				status,
				paneTabId: "tab-2",
				tabs,
				activeTabIds: { "ws-1": "tab-1" },
			});
			expect(result).toBe(status);
		}
	});

	it("returns 'review' when the workspace has no active tab", () => {
		const result = resolveSetPaneStatus({
			status: "review",
			paneTabId: "tab-1",
			tabs,
			activeTabIds: {},
		});
		expect(result).toBe("review");
	});

	it("returns 'review' when pane tab is not found", () => {
		const result = resolveSetPaneStatus({
			status: "review",
			paneTabId: "unknown-tab",
			tabs,
			activeTabIds: { "ws-1": "tab-1" },
		});
		expect(result).toBe("review");
	});

	it("handles multiple workspaces independently", () => {
		const activeTabIds = { "ws-1": "tab-1", "ws-2": "tab-3" };

		// Active tab in ws-2 → idle
		expect(
			resolveSetPaneStatus({
				status: "review",
				paneTabId: "tab-3",
				tabs,
				activeTabIds,
			}),
		).toBe("idle");

		// Non-active tab in ws-1 → review
		expect(
			resolveSetPaneStatus({
				status: "review",
				paneTabId: "tab-2",
				tabs,
				activeTabIds,
			}),
		).toBe("review");
	});
});
