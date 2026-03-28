import { beforeEach, describe, expect, it } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import path from "node:path";
import { TERMINAL_ATTACH_CANCELED_MESSAGE } from "../lib/terminal/errors";
import {
	createFrameHeader,
	PtySubprocessFrameDecoder,
	PtySubprocessIpcType,
} from "./pty-subprocess-ipc";
import "./xterm-env-polyfill";

const { Session } = await import("./session");

class FakeStdout extends EventEmitter {}

class FakeStdin extends EventEmitter {
	readonly writes: Buffer[] = [];

	write(chunk: Buffer | string): boolean {
		this.writes.push(
			Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8"),
		);
		return true;
	}
}

class FakeChildProcess extends EventEmitter {
	readonly stdout = new FakeStdout();
	readonly stdin = new FakeStdin();
	pid = 4242;
	kill(): boolean {
		return true;
	}
}

let fakeChildProcess: FakeChildProcess;
let spawnCalls: Array<{ command: string; args: string[] }> = [];

function getSpawnPayload(fakeChild: FakeChildProcess) {
	fakeChild.stdout.emit(
		"data",
		createFrameHeader(PtySubprocessIpcType.Ready, 0),
	);

	const decoder = new PtySubprocessFrameDecoder();
	const frames = fakeChild.stdin.writes.flatMap((chunk) => decoder.push(chunk));
	const spawnFrame = frames.find(
		(frame) => frame.type === PtySubprocessIpcType.Spawn,
	);
	expect(spawnFrame).toBeDefined();
	return JSON.parse(spawnFrame?.payload.toString("utf8") ?? "{}") as {
		args?: string[];
	};
}

describe("Terminal Host Session shell args", () => {
	beforeEach(() => {
		fakeChildProcess = new FakeChildProcess();
		spawnCalls = [];
	});

	it("sends bash --rcfile args in spawn payload", () => {
		const session = new Session({
			sessionId: "session-bash-args",
			workspaceId: "workspace-1",
			paneId: "pane-1",
			tabId: "tab-1",
			cols: 80,
			rows: 24,
			cwd: "/tmp",
			shell: "/bin/bash",
			spawnProcess: (command: string, args: readonly string[], _options) => {
				spawnCalls.push({ command, args: [...args] });
				return fakeChildProcess as unknown as ChildProcess;
			},
		});

		session.spawn({
			cwd: "/tmp",
			cols: 80,
			rows: 24,
			env: { PATH: "/usr/bin" },
		});

		expect(spawnCalls.length).toBe(1);

		const spawnPayload = getSpawnPayload(fakeChildProcess);

		expect(spawnPayload?.args?.[0]).toBe("--rcfile");
		expect(spawnPayload?.args?.[1]?.endsWith(path.join("bash", "rcfile"))).toBe(
			true,
		);
	});

	it("uses -lc command args when command is provided", () => {
		const session = new Session({
			sessionId: "session-command-args",
			workspaceId: "workspace-1",
			paneId: "pane-1",
			tabId: "tab-1",
			cols: 80,
			rows: 24,
			cwd: "/tmp",
			shell: "/bin/bash",
			command: "echo hello && exit 1",
			spawnProcess: (command: string, args: readonly string[], _options) => {
				spawnCalls.push({ command, args: [...args] });
				return fakeChildProcess as unknown as ChildProcess;
			},
		});

		session.spawn({
			cwd: "/tmp",
			cols: 80,
			rows: 24,
			env: { PATH: "/usr/bin" },
		});

		expect(spawnCalls.length).toBe(1);

		const spawnPayload = getSpawnPayload(fakeChildProcess);

		// Should use -c style args (getCommandShellArgs), not --rcfile (getShellArgs)
		expect(spawnPayload?.args?.[0]).not.toBe("--rcfile");
		expect(spawnPayload?.args?.[0]).toMatch(/^-[l]?c$/);
		const argsStr = spawnPayload?.args?.join(" ") ?? "";
		expect(argsStr).toContain("echo hello && exit 1");
	});

	it("detaches and aborts attach when the signal is already canceled", async () => {
		const session = new Session({
			sessionId: "session-attach-canceled",
			workspaceId: "workspace-1",
			paneId: "pane-1",
			tabId: "tab-1",
			cols: 80,
			rows: 24,
			cwd: "/tmp",
			shell: "/bin/bash",
			spawnProcess: (command: string, args: readonly string[], _options) => {
				spawnCalls.push({ command, args: [...args] });
				return fakeChildProcess as unknown as ChildProcess;
			},
		});

		session.spawn({
			cwd: "/tmp",
			cols: 80,
			rows: 24,
			env: { PATH: "/usr/bin" },
		});

		const controller = new AbortController();
		controller.abort();

		await expect(
			session.attach(
				{} as unknown as import("node:net").Socket,
				controller.signal,
			),
		).rejects.toThrow(TERMINAL_ATTACH_CANCELED_MESSAGE);
		expect(session.clientCount).toBe(0);
	});

	it("keeps a replacement attach registered when an older attach is canceled", async () => {
		const session = new Session({
			sessionId: "session-replacement-attach",
			workspaceId: "workspace-1",
			paneId: "pane-1",
			tabId: "tab-1",
			cols: 80,
			rows: 24,
			cwd: "/tmp",
			shell: "/bin/bash",
		});

		let resolveBoundary!: (value: boolean) => void;
		const boundaryPromise = new Promise<boolean>((resolve) => {
			resolveBoundary = resolve;
		});
		(
			session as unknown as {
				flushToSnapshotBoundary: (_timeoutMs: number) => Promise<boolean>;
			}
		).flushToSnapshotBoundary = () => boundaryPromise;

		const writes: string[] = [];
		const socket = {
			write(message: string) {
				writes.push(message);
				return true;
			},
		} as unknown as import("node:net").Socket;

		const firstController = new AbortController();
		const firstAttach = session.attach(socket, firstController.signal);
		await Promise.resolve();

		const secondAttach = session.attach(socket);
		await Promise.resolve();

		firstController.abort();
		await expect(firstAttach).rejects.toThrow(TERMINAL_ATTACH_CANCELED_MESSAGE);
		expect(session.clientCount).toBe(1);

		resolveBoundary(true);
		await expect(secondAttach).resolves.toBeDefined();

		(
			session as unknown as {
				broadcastEvent: (
					eventType: string,
					payload: { type: "data"; data: string },
				) => void;
			}
		).broadcastEvent("data", { type: "data", data: "hello" });

		expect(writes.some((message) => message.includes('"hello"'))).toBe(true);
	});
});

describe("Terminal Host Session backpressure (#2968)", () => {
	/**
	 * Helper: create a session with a fake socket attached, bypassing the
	 * spawn/attach lifecycle so we can test broadcastEvent in isolation.
	 */
	function createSessionWithSocket(socketOverrides: {
		write: (message: string) => boolean;
		once?: (event: string, listener: () => void) => void;
	}) {
		const session = new Session({
			sessionId: "session-backpressure",
			workspaceId: "workspace-1",
			paneId: "pane-1",
			tabId: "tab-1",
			cols: 80,
			rows: 24,
			cwd: "/tmp",
			shell: "/bin/bash",
		});

		// Directly register the fake socket as an attached client
		const socket = socketOverrides as unknown as import("node:net").Socket;
		const attachedClients = (
			session as unknown as {
				attachedClients: Map<
					import("node:net").Socket,
					{
						socket: import("node:net").Socket;
						attachedAt: number;
						attachToken: symbol;
					}
				>;
			}
		).attachedClients;
		attachedClients.set(socket, {
			socket,
			attachedAt: Date.now(),
			attachToken: Symbol("test"),
		});

		const broadcast = (data: string) => {
			(
				session as unknown as {
					broadcastEvent: (
						eventType: string,
						payload: { type: "data"; data: string },
					) => void;
				}
			).broadcastEvent("data", { type: "data", data });
		};

		return { session, socket, broadcast };
	}

	it("stops writing to a backpressured socket instead of growing the buffer", () => {
		const writes: string[] = [];
		let drainCallback: (() => void) | null = null;

		const { broadcast } = createSessionWithSocket({
			write(message: string) {
				writes.push(message);
				// First write succeeds, subsequent ones signal backpressure
				return writes.length <= 1;
			},
			once(event: string, listener: () => void) {
				if (event === "drain") drainCallback = listener;
			},
		});

		// First broadcast: write succeeds (returns true)
		broadcast("frame-1");
		expect(writes).toHaveLength(1);
		expect(writes[0]).toContain("frame-1");

		// Second broadcast: write returns false → socket becomes backpressured
		broadcast("frame-2");
		expect(writes).toHaveLength(2);
		expect(writes[1]).toContain("frame-2");
		expect(drainCallback).not.toBeNull();

		// Subsequent broadcasts should be SKIPPED (not written to the socket)
		// This is the fix for #2968: previously these would keep writing,
		// growing Node's internal buffer without bound.
		broadcast("frame-3");
		broadcast("frame-4");
		broadcast("frame-5");
		expect(writes).toHaveLength(2); // No new writes!
	});

	it("resumes writing after the socket drains", () => {
		const writes: string[] = [];
		let drainCallback: (() => void) | null = null;

		const { broadcast } = createSessionWithSocket({
			write(message: string) {
				writes.push(message);
				// After drain, writes succeed again
				return writes.length <= 1 || writes.length > 5;
			},
			once(event: string, listener: () => void) {
				if (event === "drain") drainCallback = listener;
			},
		});

		// Fill up the socket
		broadcast("frame-1"); // succeeds
		broadcast("frame-2"); // backpressures

		// Skipped during backpressure
		broadcast("frame-3");
		broadcast("frame-4");
		expect(writes).toHaveLength(2);

		// Simulate drain
		expect(drainCallback).not.toBeNull();
		drainCallback?.();

		// After drain, new broadcasts should write again
		broadcast("frame-5");
		expect(writes).toHaveLength(3);
		expect(writes[2]).toContain("frame-5");
	});
});
