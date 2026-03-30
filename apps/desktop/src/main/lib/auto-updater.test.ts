import { describe, expect, mock, test } from "bun:test";
import { EventEmitter } from "node:events";
import { AUTO_UPDATE_STATUS } from "shared/auto-update";

// Create a mock autoUpdater that behaves like electron-updater's autoUpdater
const mockAutoUpdater = Object.assign(new EventEmitter(), {
	autoDownload: false,
	autoInstallOnAppQuit: false,
	disableDifferentialDownload: false,
	allowDowngrade: false,
	checkForUpdates: mock(() => Promise.resolve(null)),
	quitAndInstall: mock(() => {}),
	setFeedURL: mock(() => {}),
});

mock.module("electron-updater", () => ({
	autoUpdater: mockAutoUpdater,
}));

mock.module("electron", () => ({
	app: {
		getVersion: () => "1.4.4",
		isReady: () => true,
		whenReady: () => Promise.resolve(),
	},
	dialog: {
		showMessageBox: mock(() => Promise.resolve({ response: 0 })),
	},
}));

mock.module("main/env.main", () => ({
	env: { NODE_ENV: "production" },
}));

mock.module("main/index", () => ({
	setSkipQuitConfirmation: mock(() => {}),
}));

mock.module("shared/constants", () => ({
	PLATFORM: { IS_MAC: true, IS_LINUX: false },
}));

// Import after mocks are set up
const {
	autoUpdateEmitter,
	getUpdateStatus,
	dismissUpdate,
	setupAutoUpdater,
	checkForUpdates,
} = await import("./auto-updater");

// Initialize the auto-updater once (registers event handlers on mockAutoUpdater)
setupAutoUpdater();
// Wait a tick so the initial checkForUpdates resolves
await new Promise((r) => setTimeout(r, 10));

function collectEvents() {
	const events: Array<{
		status: string;
		version?: string;
		error?: string;
	}> = [];
	const handler = (event: (typeof events)[0]) => events.push(event);
	autoUpdateEmitter.on("status-changed", handler);
	return {
		events,
		cleanup: () => autoUpdateEmitter.off("status-changed", handler),
	};
}

describe("auto-updater dismiss behavior", () => {
	test("BUG: dismissed update for same version reappears after periodic check", () => {
		// This test demonstrates the bug reported in #3023:
		// When the user dismisses an update notification, it keeps reappearing
		// every time the 4-hour periodic check runs, even for the same version.

		const { cleanup } = collectEvents();

		// 1. Update v1.5.0 is downloaded and ready
		mockAutoUpdater.emit("update-downloaded", { version: "1.5.0" });
		expect(getUpdateStatus().status).toBe(AUTO_UPDATE_STATUS.READY);
		expect(getUpdateStatus().version).toBe("1.5.0");

		// 2. User dismisses version 1.5.0
		dismissUpdate();
		expect(getUpdateStatus().status).toBe(AUTO_UPDATE_STATUS.IDLE);

		// Verify the READY status is suppressed while dismissed
		mockAutoUpdater.emit("update-downloaded", { version: "1.5.0" });
		expect(getUpdateStatus().status).toBe(AUTO_UPDATE_STATUS.IDLE);

		// 3. After 4 hours, checkForUpdates() runs again.
		//    In the current code, this resets isDismissed = false (line 108).
		checkForUpdates();

		// 4. The same version 1.5.0 is found again
		mockAutoUpdater.emit("update-downloaded", { version: "1.5.0" });

		// BUG: The user explicitly dismissed version 1.5.0, but the toast
		// reappears because checkForUpdates() blindly resets isDismissed.
		//
		// Expected (after fix): IDLE — version 1.5.0 was already dismissed
		// Actual (bug): READY — the toast shows again
		expect(getUpdateStatus().status).toBe(AUTO_UPDATE_STATUS.IDLE);

		cleanup();
	});

	test("dismissed version should not block notification for a newer version", () => {
		// Continuing from previous test: version 1.5.0 is dismissed.
		// A new check cycle finds a NEWER version 1.6.0.
		const { cleanup } = collectEvents();

		checkForUpdates();

		// A NEWER version 1.6.0 becomes available — should show notification
		// even though 1.5.0 was dismissed
		mockAutoUpdater.emit("update-downloaded", { version: "1.6.0" });

		const status = getUpdateStatus();
		expect(status.status).toBe(AUTO_UPDATE_STATUS.READY);
		expect(status.version).toBe("1.6.0");

		cleanup();
	});
});
