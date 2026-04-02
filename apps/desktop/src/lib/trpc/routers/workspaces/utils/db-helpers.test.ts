import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import * as schema from "@superset/local-db";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

/**
 * Reproduces GitHub issue #3109:
 * "Hiding a worktree, hides my entire workspace"
 *
 * When a user "hides" (closes) the last worktree workspace in a project,
 * the project disappears from the sidebar even though the worktree record
 * (and its files on disk) still exist. The user expected to hide just that
 * worktree, not lose the entire project from the sidebar.
 *
 * Root cause: hideProjectIfNoWorkspaces() only checks for remaining workspace
 * records. When the last workspace is closed (hidden), the function sets the
 * project's tabOrder to null (hiding it), even though orphaned worktree records
 * remain — indicating the user chose "Hide" (keep files) rather than "Delete".
 *
 * Fix: Also check for orphaned worktree records. If worktrees still exist in
 * the project, keep the project visible so the user can re-open them.
 */

const { projects, workspaces, worktrees } = schema;

function createTestDb() {
	const sqlite = new Database(":memory:");

	sqlite.exec(`
		CREATE TABLE projects (
			id TEXT PRIMARY KEY,
			main_repo_path TEXT NOT NULL,
			name TEXT NOT NULL,
			color TEXT NOT NULL,
			tab_order INTEGER,
			last_opened_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
			created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
			config_toast_dismissed INTEGER,
			default_branch TEXT,
			workspace_base_branch TEXT,
			github_owner TEXT,
			branch_prefix_mode TEXT,
			branch_prefix_custom TEXT,
			worktree_base_dir TEXT,
			hide_image INTEGER,
			icon_url TEXT,
			neon_project_id TEXT,
			default_app TEXT
		);

		CREATE TABLE worktrees (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			path TEXT NOT NULL,
			branch TEXT NOT NULL,
			base_branch TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
			git_status TEXT,
			github_status TEXT,
			created_by_superset INTEGER NOT NULL DEFAULT 1
		);

		CREATE TABLE workspace_sections (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			tab_order INTEGER NOT NULL,
			is_collapsed INTEGER DEFAULT 0,
			color TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
		);

		CREATE TABLE workspaces (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			worktree_id TEXT REFERENCES worktrees(id) ON DELETE CASCADE,
			type TEXT NOT NULL,
			branch TEXT NOT NULL,
			name TEXT NOT NULL,
			tab_order INTEGER NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
			last_opened_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
			is_unread INTEGER DEFAULT 0,
			is_unnamed INTEGER DEFAULT 0,
			deleting_at INTEGER,
			port_base INTEGER,
			section_id TEXT REFERENCES workspace_sections(id) ON DELETE SET NULL
		);
	`);

	return drizzle(sqlite, { schema });
}

type TestDb = ReturnType<typeof createTestDb>;

function insertProject(
	db: TestDb,
	overrides: Partial<schema.InsertProject> = {},
) {
	const id = overrides.id ?? randomUUID();
	db.insert(projects)
		.values({
			id,
			mainRepoPath: "/tmp/test-repo",
			name: "test-project",
			color: "#000000",
			tabOrder: 0,
			...overrides,
		})
		.run();
	return id;
}

function insertWorktree(
	db: TestDb,
	overrides: Partial<schema.InsertWorktree> & { projectId: string },
) {
	const id = overrides.id ?? randomUUID();
	db.insert(worktrees)
		.values({
			id,
			path: `/tmp/worktrees/${id}`,
			branch: "feature-branch",
			...overrides,
		})
		.run();
	return id;
}

function insertWorkspace(
	db: TestDb,
	overrides: Partial<schema.InsertWorkspace> & { projectId: string },
) {
	const id = overrides.id ?? randomUUID();
	db.insert(workspaces)
		.values({
			id,
			type: "worktree",
			branch: "feature-branch",
			name: "test-workspace",
			tabOrder: 0,
			...overrides,
		})
		.run();
	return id;
}

/**
 * Inline re-implementation of hideProjectIfNoWorkspaces using the given db,
 * matching the CURRENT (buggy) behavior for baseline verification.
 */
function hideProjectIfNoWorkspacesBuggy(db: TestDb, projectId: string) {
	const remainingWorkspaces = db
		.select()
		.from(workspaces)
		.where(eq(workspaces.projectId, projectId))
		.all();
	if (remainingWorkspaces.length === 0) {
		db.update(projects)
			.set({ tabOrder: null })
			.where(eq(projects.id, projectId))
			.run();
	}
}

/**
 * Fixed implementation that also checks for orphaned worktrees.
 */
function hideProjectIfNoWorkspacesFixed(db: TestDb, projectId: string) {
	const remainingWorkspaces = db
		.select()
		.from(workspaces)
		.where(eq(workspaces.projectId, projectId))
		.all();
	if (remainingWorkspaces.length === 0) {
		const remainingWorktrees = db
			.select()
			.from(worktrees)
			.where(eq(worktrees.projectId, projectId))
			.all();
		if (remainingWorktrees.length === 0) {
			db.update(projects)
				.set({ tabOrder: null })
				.where(eq(projects.id, projectId))
				.run();
		}
	}
}

function getProject(db: TestDb, projectId: string) {
	return db.select().from(projects).where(eq(projects.id, projectId)).get();
}

describe("hideProjectIfNoWorkspaces — issue #3109", () => {
	test("BUG: hiding last worktree workspace hides the project even when orphaned worktrees remain", () => {
		const db = createTestDb();
		const projectId = insertProject(db, { tabOrder: 0 });
		const worktreeId = insertWorktree(db, { projectId });
		const workspaceId = insertWorkspace(db, {
			projectId,
			worktreeId,
			type: "worktree",
		});

		// Simulate "Hide" action: delete workspace, keep worktree
		db.delete(workspaces).where(eq(workspaces.id, workspaceId)).run();

		// Buggy behavior: project gets hidden even though worktree still exists
		hideProjectIfNoWorkspacesBuggy(db, projectId);

		const project = getProject(db, projectId);
		// This demonstrates the bug: tabOrder becomes null (project hidden)
		// even though the worktree record is still present
		expect(project?.tabOrder).toBeNull();

		// Verify worktree still exists
		const wt = db
			.select()
			.from(worktrees)
			.where(eq(worktrees.id, worktreeId))
			.get();
		expect(wt).toBeTruthy();
	});

	test("FIX: hiding last worktree workspace keeps project visible when orphaned worktrees remain", () => {
		const db = createTestDb();
		const projectId = insertProject(db, { tabOrder: 0 });
		const worktreeId = insertWorktree(db, { projectId });
		const workspaceId = insertWorkspace(db, {
			projectId,
			worktreeId,
			type: "worktree",
		});

		// Simulate "Hide" action: delete workspace, keep worktree
		db.delete(workspaces).where(eq(workspaces.id, workspaceId)).run();

		// Fixed behavior: project stays visible because worktree still exists
		hideProjectIfNoWorkspacesFixed(db, projectId);

		const project = getProject(db, projectId);
		expect(project?.tabOrder).toBe(0); // Project stays visible
	});

	test("FIX: project is still hidden when both workspaces and worktrees are deleted", () => {
		const db = createTestDb();
		const projectId = insertProject(db, { tabOrder: 0 });
		const worktreeId = insertWorktree(db, { projectId });
		const workspaceId = insertWorkspace(db, {
			projectId,
			worktreeId,
			type: "worktree",
		});

		// Simulate "Delete" action: both workspace and worktree are removed
		db.delete(workspaces).where(eq(workspaces.id, workspaceId)).run();
		db.delete(worktrees).where(eq(worktrees.id, worktreeId)).run();

		hideProjectIfNoWorkspacesFixed(db, projectId);

		const project = getProject(db, projectId);
		expect(project?.tabOrder).toBeNull(); // Project correctly hidden
	});

	test("FIX: project stays visible when other workspaces remain (regardless of worktrees)", () => {
		const db = createTestDb();
		const projectId = insertProject(db, { tabOrder: 0 });
		const worktreeId = insertWorktree(db, { projectId });
		insertWorkspace(db, { projectId, worktreeId, type: "worktree" });
		// Second workspace (branch type, no worktree)
		insertWorkspace(db, {
			projectId,
			type: "branch",
			branch: "main",
			name: "main-workspace",
			tabOrder: 1,
		});

		// Remove the worktree workspace but branch workspace remains
		db.delete(workspaces).where(eq(workspaces.worktreeId, worktreeId)).run();

		hideProjectIfNoWorkspacesFixed(db, projectId);

		const project = getProject(db, projectId);
		expect(project?.tabOrder).toBe(0); // Project stays visible
	});

	test("FIX: project with multiple worktrees stays visible when one is hidden", () => {
		const db = createTestDb();
		const projectId = insertProject(db, { tabOrder: 0 });

		const wt1 = insertWorktree(db, { projectId, branch: "feature-1" });
		const ws1 = insertWorkspace(db, {
			projectId,
			worktreeId: wt1,
			type: "worktree",
			branch: "feature-1",
			name: "ws-1",
			tabOrder: 0,
		});

		const wt2 = insertWorktree(db, { projectId, branch: "feature-2" });
		insertWorkspace(db, {
			projectId,
			worktreeId: wt2,
			type: "worktree",
			branch: "feature-2",
			name: "ws-2",
			tabOrder: 1,
		});

		// Hide first workspace
		db.delete(workspaces).where(eq(workspaces.id, ws1)).run();

		hideProjectIfNoWorkspacesFixed(db, projectId);

		const project = getProject(db, projectId);
		expect(project?.tabOrder).toBe(0); // Still visible — ws-2 still exists
	});
});
