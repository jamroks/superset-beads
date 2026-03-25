import { beforeEach, describe, expect, it, mock } from "bun:test";

const SESSION_A = "aaaa-aaaa-aaaa";
const SESSION_B = "bbbb-bbbb-bbbb";
const SESSION_C = "cccc-cccc-cccc";

const destroyMock = mock(async () => {});
const harnessSubscribeMock = mock((_: (event: unknown) => void) => () => {});

const createMastraCodeMock = mock(async () => ({
	harness: {
		init: mock(async () => {}),
		setResourceId: mock((_: { resourceId: string }) => {}),
		selectOrCreateThread: mock(async () => {}),
		subscribe: harnessSubscribeMock,
		destroy: destroyMock,
	},
	mcpManager: null,
	hookManager: {
		setSessionId: mock((_: string) => {}),
		runSessionStart: mock(async () => ({
			allowed: true,
			results: [],
			warnings: [],
		})),
		runSessionEnd: mock(async () => {}),
		reload: mock(() => {}),
	},
}));

mock.module("mastracode", () => ({
	createAuthStorage: mock(() => ({
		reload: () => {},
		get: () => undefined,
	})),
	createMastraCode: createMastraCodeMock,
}));

const { ChatRuntimeService } = await import("./service");

function createService(maxIdleSessions?: number) {
	return new ChatRuntimeService({
		headers: async () => ({}),
		apiUrl: "http://localhost:3000",
		maxIdleSessions,
	});
}

type ServiceInternal = {
	getOrCreateRuntime: (
		sessionId: string,
		cwd?: string,
	) => Promise<{ sessionId: string }>;
	runtimes: Map<string, unknown>;
};

describe("ChatRuntimeService session cleanup", () => {
	beforeEach(() => {
		destroyMock.mockClear();
		createMastraCodeMock.mockClear();
		harnessSubscribeMock.mockClear();
	});

	it("accumulates sessions in the runtimes map without cleanup", async () => {
		const service = createService() as unknown as ServiceInternal;

		await service.getOrCreateRuntime(SESSION_A, "/tmp/a");
		await service.getOrCreateRuntime(SESSION_B, "/tmp/b");
		await service.getOrCreateRuntime(SESSION_C, "/tmp/c");

		expect(service.runtimes.size).toBe(3);
		expect(createMastraCodeMock).toHaveBeenCalledTimes(3);
	});

	it("destroySession removes a session from the map", async () => {
		const service = createService();
		const internal = service as unknown as ServiceInternal;

		await internal.getOrCreateRuntime(SESSION_A, "/tmp/a");
		await internal.getOrCreateRuntime(SESSION_B, "/tmp/b");
		expect(internal.runtimes.size).toBe(2);

		await service.destroySession(SESSION_A);
		expect(internal.runtimes.size).toBe(1);
		expect(internal.runtimes.has(SESSION_A)).toBe(false);
		expect(internal.runtimes.has(SESSION_B)).toBe(true);
		expect(destroyMock).toHaveBeenCalledTimes(1);
	});

	it("destroySession is a no-op for unknown sessions", async () => {
		const service = createService();
		await service.destroySession("nonexistent");
		expect(destroyMock).not.toHaveBeenCalled();
	});

	it("evicts oldest idle sessions when maxIdleSessions is exceeded", async () => {
		const service = createService(2);
		const internal = service as unknown as ServiceInternal;

		await internal.getOrCreateRuntime(SESSION_A, "/tmp/a");
		await internal.getOrCreateRuntime(SESSION_B, "/tmp/b");
		expect(internal.runtimes.size).toBe(2);

		// Adding a third session should evict the oldest (SESSION_A)
		await internal.getOrCreateRuntime(SESSION_C, "/tmp/c");
		expect(internal.runtimes.size).toBe(2);
		expect(internal.runtimes.has(SESSION_A)).toBe(false);
		expect(internal.runtimes.has(SESSION_C)).toBe(true);
		expect(destroyMock).toHaveBeenCalledTimes(1);
	});

	it("destroyAllSessions clears every session", async () => {
		const service = createService();
		const internal = service as unknown as ServiceInternal;

		await internal.getOrCreateRuntime(SESSION_A, "/tmp/a");
		await internal.getOrCreateRuntime(SESSION_B, "/tmp/b");
		expect(internal.runtimes.size).toBe(2);

		await service.destroyAllSessions();
		expect(internal.runtimes.size).toBe(0);
		expect(destroyMock).toHaveBeenCalledTimes(2);
	});
});
