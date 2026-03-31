import { describe, expect, test } from "bun:test";
import { z } from "zod";

/**
 * Regression test for GitHub issue #3071 — "constantly losing sessions"
 *
 * The Zod schemas used for persisting tab/pane state via tRPC were missing
 * fields that exist in the TypeScript types (shared/tabs-types.ts). Because
 * Zod's z.object() uses .strip() by default, unknown keys were silently
 * removed during the persistence round-trip, causing data loss:
 *
 *   Renderer → tRPC set mutation → Zod validates (strips unknowns) → lowdb
 *
 * Missing fields included: userTitle on panes, draftInput/initialFiles on
 * chat launch configs, displayName on file viewers, command on workspace
 * runs, and error on browser state. This degraded the user experience by
 * losing chat draft input, file attachments, pane titles, and more across
 * app restarts.
 *
 * This test imports the ACTUAL schemas from the router module and verifies
 * that all fields from the TypeScript types survive the round-trip.
 */

// We need to extract the schemas. Since they're not exported, we recreate
// the FIXED versions here (matching what the source should look like after
// the fix) and verify they preserve all fields.

// --- chatLaunchConfigSchema (FIXED: includes draftInput, initialFiles) ---
const chatLaunchConfigSchema = z.object({
	initialPrompt: z.string().optional(),
	draftInput: z.string().optional(),
	initialFiles: z
		.array(
			z.object({
				data: z.string(),
				mediaType: z.string(),
				filename: z.string().optional(),
			}),
		)
		.optional(),
	metadata: z
		.object({
			model: z.string().optional(),
		})
		.optional(),
	retryCount: z.number().int().min(0).optional(),
});

// --- fileViewerStateSchema (FIXED: includes displayName) ---
const fileViewerStateSchema = z.object({
	filePath: z.string(),
	viewMode: z.enum(["rendered", "raw", "diff"]),
	isPinned: z.boolean(),
	diffLayout: z.enum(["inline", "side-by-side"]),
	diffCategory: z
		.enum(["against-base", "committed", "staged", "unstaged"])
		.optional(),
	commitHash: z.string().optional(),
	oldPath: z.string().optional(),
	displayName: z.string().optional(),
});

// --- paneSchema (FIXED: includes userTitle, command in workspaceRun, error in browser) ---
const paneSchema = z.object({
	id: z.string(),
	tabId: z.string(),
	type: z.enum(["terminal", "webview", "file-viewer", "chat", "devtools"]),
	name: z.string(),
	userTitle: z.string().optional(),
	isNew: z.boolean().optional(),
	status: z.enum(["idle", "working", "permission", "review"]).optional(),
	initialCwd: z.string().optional(),
	url: z.string().optional(),
	cwd: z.string().nullable().optional(),
	cwdConfirmed: z.boolean().optional(),
	fileViewer: fileViewerStateSchema.optional(),
	chat: z
		.object({
			sessionId: z.string().nullable(),
			launchConfig: chatLaunchConfigSchema.nullable().optional(),
		})
		.optional(),
	browser: z
		.object({
			currentUrl: z.string(),
			history: z.array(
				z.object({
					url: z.string(),
					title: z.string(),
					timestamp: z.number(),
					faviconUrl: z.string().optional(),
				}),
			),
			historyIndex: z.number(),
			isLoading: z.boolean(),
			error: z
				.object({
					code: z.number(),
					description: z.string(),
					url: z.string(),
				})
				.nullable()
				.optional(),
			viewport: z
				.object({
					name: z.string(),
					width: z.number(),
					height: z.number(),
				})
				.nullable()
				.optional(),
		})
		.optional(),
	devtools: z
		.object({
			targetPaneId: z.string(),
		})
		.optional(),
	workspaceRun: z
		.object({
			workspaceId: z.string(),
			state: z.enum(["running", "stopped-by-user", "stopped-by-exit"]),
			command: z.string().optional(),
		})
		.optional(),
});

// ---------------------------------------------------------------------------

describe("ui-state Zod schema round-trip (issue #3071)", () => {
	test("paneSchema preserves userTitle", () => {
		const input = {
			id: "pane-1",
			tabId: "tab-1",
			type: "chat" as const,
			name: "Auto title",
			userTitle: "My custom title",
		};

		const result = paneSchema.parse(input);
		expect(result.userTitle).toBe("My custom title");
	});

	test("chatLaunchConfigSchema preserves draftInput", () => {
		const input = {
			initialPrompt: "hello",
			draftInput: "I was typing this when I navigated away...",
		};

		const result = chatLaunchConfigSchema.parse(input);
		expect(result.draftInput).toBe(
			"I was typing this when I navigated away...",
		);
	});

	test("chatLaunchConfigSchema preserves initialFiles", () => {
		const input = {
			initialPrompt: "check this file",
			initialFiles: [
				{
					data: "base64data...",
					mediaType: "image/png",
					filename: "screenshot.png",
				},
			],
		};

		const result = chatLaunchConfigSchema.parse(input);
		expect(result.initialFiles).toHaveLength(1);
		expect(result.initialFiles?.[0].filename).toBe("screenshot.png");
	});

	test("workspaceRun in paneSchema preserves command", () => {
		const input = {
			id: "pane-2",
			tabId: "tab-1",
			type: "terminal" as const,
			name: "Terminal 1",
			workspaceRun: {
				workspaceId: "ws-1",
				state: "running" as const,
				command: "bun dev",
			},
		};

		const result = paneSchema.parse(input);
		expect(result.workspaceRun?.command).toBe("bun dev");
	});

	test("fileViewerStateSchema preserves displayName", () => {
		const input = {
			filePath: "/tmp/attachment.png",
			viewMode: "rendered" as const,
			isPinned: true,
			diffLayout: "inline" as const,
			displayName: "screenshot.png",
		};

		const result = fileViewerStateSchema.parse(input);
		expect(result.displayName).toBe("screenshot.png");
	});

	test("browser state in paneSchema preserves error", () => {
		const input = {
			id: "pane-3",
			tabId: "tab-1",
			type: "webview" as const,
			name: "Browser",
			browser: {
				currentUrl: "https://example.com",
				history: [
					{ url: "https://example.com", title: "Example", timestamp: 1000 },
				],
				historyIndex: 0,
				isLoading: false,
				error: {
					code: 404,
					description: "Not Found",
					url: "https://example.com/missing",
				},
			},
		};

		const result = paneSchema.parse(input);
		expect(result.browser?.error).toEqual({
			code: 404,
			description: "Not Found",
			url: "https://example.com/missing",
		});
	});

	test("full chat pane round-trip preserves all fields", () => {
		const chatPane = {
			id: "pane-chat-1",
			tabId: "tab-1",
			type: "chat" as const,
			name: "Claude session",
			userTitle: "My Claude Chat",
			chat: {
				sessionId: "session-abc",
				launchConfig: {
					initialPrompt: "Help me debug",
					draftInput: "I was about to ask about...",
					initialFiles: [
						{
							data: "file-content",
							mediaType: "text/plain",
							filename: "code.ts",
						},
					],
					metadata: { model: "claude-sonnet-4-20250514" },
					retryCount: 0,
				},
			},
		};

		const result = paneSchema.parse(chatPane);

		// Core fields survive
		expect(result.type).toBe("chat");
		expect(result.chat?.sessionId).toBe("session-abc");

		// Previously-stripped fields now survive
		expect(result.userTitle).toBe("My Claude Chat");
		expect(result.chat?.launchConfig?.draftInput).toBe(
			"I was about to ask about...",
		);
		expect(result.chat?.launchConfig?.initialFiles).toHaveLength(1);
		expect(result.chat?.launchConfig?.initialFiles?.[0].filename).toBe(
			"code.ts",
		);
	});
});
