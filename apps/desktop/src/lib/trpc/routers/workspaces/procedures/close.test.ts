import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Reproduction test for GitHub issue #3047:
 * "What's the point of the 'closed' workspaces, since it's not working?"
 *
 * Bug: The `close` procedure calls `deleteWorkspace()` which permanently removes
 * the workspace record from the database. The UI has a "Closed" tab but closing a
 * workspace actually deletes it, so it can never appear there.
 *
 * Expected: Closing a workspace should set a `closedAt` timestamp on the record,
 * preserving it for later reopening. The workspace should appear in the "Closed" tab.
 */

// -- Mocks for database layer --

const mockWorkspace = {
	id: "ws-1",
	projectId: "proj-1",
	worktreeId: null,
	type: "branch" as const,
	branch: "main",
	name: "My Workspace",
	tabOrder: 0,
	createdAt: Date.now(),
	updatedAt: Date.now(),
	lastOpenedAt: Date.now(),
	isUnread: false,
	isUnnamed: false,
	deletingAt: null,
	closedAt: null,
	portBase: null,
	sectionId: null,
};

let dbStore: Map<string, typeof mockWorkspace>;

const _deleteRunMock = mock(() => {});
const _updateSetMock = mock(() => ({
	where: () => ({
		run: () => {
			// Simulate the update by modifying the store
		},
	}),
}));

const selectGetMock = mock(() => {
	return dbStore.get("ws-1") ?? undefined;
});

const localDbMock = {
	select: mock(() => ({
		from: () => ({
			where: () => ({
				get: selectGetMock,
				all: () => Array.from(dbStore.values()),
			}),
		}),
	})),
	update: mock(() => ({
		set: (fields: Record<string, unknown>) => ({
			where: () => ({
				run: () => {
					// Apply the update to our mock store
					const ws = dbStore.get("ws-1");
					if (ws) {
						dbStore.set("ws-1", { ...ws, ...fields });
					}
				},
			}),
		}),
	})),
	delete: mock(() => ({
		where: () => ({
			run: () => {
				dbStore.delete("ws-1");
			},
		}),
	})),
	insert: mock(() => ({
		values: () => ({
			onConflictDoUpdate: () => ({
				run: () => {},
			}),
		}),
	})),
};

mock.module("main/lib/local-db", () => ({
	localDb: localDbMock,
}));

mock.module("drizzle-orm", () => ({
	and: mock((...args: unknown[]) => args),
	eq: mock((...args: unknown[]) => args),
	isNull: mock((col: unknown) => col),
	isNotNull: mock((col: unknown) => col),
	desc: mock((col: unknown) => col),
	inArray: mock((...args: unknown[]) => args),
}));

mock.module("@superset/local-db", () => ({
	workspaces: {
		id: "id",
		projectId: "project_id",
		worktreeId: "worktree_id",
		type: "type",
		branch: "branch",
		name: "name",
		tabOrder: "tab_order",
		createdAt: "created_at",
		updatedAt: "updated_at",
		lastOpenedAt: "last_opened_at",
		isUnread: "is_unread",
		isUnnamed: "is_unnamed",
		deletingAt: "deleting_at",
		closedAt: "closed_at",
		portBase: "port_base",
		sectionId: "section_id",
	},
	worktrees: {
		id: "id",
		projectId: "project_id",
		branch: "branch",
		path: "path",
	},
	projects: {
		id: "id",
		tabOrder: "tab_order",
	},
	settings: {
		id: "id",
		lastActiveWorkspaceId: "last_active_workspace_id",
	},
	workspaceSections: {
		id: "id",
		projectId: "project_id",
	},
}));

const { closeWorkspace, reopenWorkspace, deleteWorkspace } = await import(
	"../utils/db-helpers"
);

describe("Issue #3047: Close workspace should preserve record", () => {
	beforeEach(() => {
		dbStore = new Map([["ws-1", { ...mockWorkspace }]]);
	});

	afterEach(() => {
		dbStore.clear();
	});

	test("deleteWorkspace removes the record entirely from the database", () => {
		expect(dbStore.has("ws-1")).toBe(true);

		deleteWorkspace("ws-1");

		// Record is completely gone
		expect(dbStore.has("ws-1")).toBe(false);
	});

	test("closeWorkspace preserves the record and sets closedAt timestamp", () => {
		expect(dbStore.has("ws-1")).toBe(true);
		expect(dbStore.get("ws-1")?.closedAt).toBeNull();

		closeWorkspace("ws-1");

		// Record is preserved
		expect(dbStore.has("ws-1")).toBe(true);
		// closedAt timestamp is set
		const ws = dbStore.get("ws-1");
		expect(ws?.closedAt).not.toBeNull();
		expect(typeof ws?.closedAt).toBe("number");
	});

	test("reopenWorkspace clears the closedAt timestamp", () => {
		// First close it
		closeWorkspace("ws-1");
		expect(dbStore.get("ws-1")?.closedAt).not.toBeNull();

		// Then reopen it
		reopenWorkspace("ws-1");

		// Record is still there
		expect(dbStore.has("ws-1")).toBe(true);
		// closedAt is cleared
		expect(dbStore.get("ws-1")?.closedAt).toBeNull();
	});

	test("close followed by reopen round-trips correctly", () => {
		const originalName = dbStore.get("ws-1")?.name;

		closeWorkspace("ws-1");
		expect(dbStore.get("ws-1")?.closedAt).not.toBeNull();

		reopenWorkspace("ws-1");
		expect(dbStore.get("ws-1")?.closedAt).toBeNull();
		// Workspace data is preserved through the close/reopen cycle
		expect(dbStore.get("ws-1")?.name).toBe(originalName);
	});
});
