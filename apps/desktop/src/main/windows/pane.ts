import { join } from "node:path";
import type { BrowserWindow } from "electron";
import { nativeTheme } from "electron";
import { createWindow } from "lib/electron-app/factories/windows/create";
import { attachWindowToIpcHandler } from "main/lib/ipc-handler";

const paneWindows = new Map<string, BrowserWindow>();

interface OpenPaneWindowInput {
	paneId: string;
	paneName?: string;
	workspaceName?: string;
}

interface OpenPaneWindowResult {
	reused: boolean;
}

export function openPaneWindow({
	paneId,
	paneName,
	workspaceName,
}: OpenPaneWindowInput): OpenPaneWindowResult {
	const trimmedPaneName = paneName?.trim();
	const trimmedWorkspaceName = workspaceName?.trim();
	const windowTitle =
		trimmedPaneName && trimmedWorkspaceName
			? `${trimmedPaneName} - ${trimmedWorkspaceName}`
			: trimmedPaneName || trimmedWorkspaceName || "Pane";

	const existingWindow = paneWindows.get(paneId);
	if (existingWindow && !existingWindow.isDestroyed()) {
		existingWindow.setTitle(windowTitle);
		if (existingWindow.isMinimized()) {
			existingWindow.restore();
		}
		existingWindow.show();
		existingWindow.focus();
		return { reused: true };
	}

	const window = createWindow({
		id: "pane",
		title: windowTitle,
		width: 1200,
		height: 760,
		minWidth: 520,
		minHeight: 360,
		show: false,
		autoHideMenuBar: true,
		backgroundColor: nativeTheme.shouldUseDarkColors ? "#252525" : "#ffffff",
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			webviewTag: true,
			partition: "persist:superset",
		},
		hash: `/pane/${encodeURIComponent(paneId)}`,
	});
	attachWindowToIpcHandler(window);

	paneWindows.set(paneId, window);

	window.webContents.on("did-finish-load", () => {
		if (!window.isDestroyed()) {
			window.show();
		}
	});

	window.on("closed", () => {
		paneWindows.delete(paneId);
	});

	return { reused: false };
}
