import { join } from "node:path";
import { BrowserWindow, nativeTheme } from "electron";
import { createWindow } from "lib/electron-app/factories/windows/create";
import { PLATFORM } from "shared/constants";
import { productName } from "~/package.json";

interface IpcWindowHandler {
	attachWindow: (window: BrowserWindow) => void;
	detachWindow: (window: BrowserWindow) => void;
}

interface OpenWorkspaceWindowInput {
	workspaceId: string;
	tabId?: string;
	paneId?: string;
}

let ipcWindowHandler: IpcWindowHandler | null = null;

export function registerIpcWindowHandler(
	handler: IpcWindowHandler | null,
): void {
	ipcWindowHandler = handler;
}

export function openWorkspaceWindow({
	workspaceId,
	tabId,
	paneId,
}: OpenWorkspaceWindowInput): BrowserWindow {
	const sourceWindow =
		BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;

	const [sourceWidth, sourceHeight] = sourceWindow
		? sourceWindow.getSize()
		: [1280, 900];
	const [sourceX, sourceY] = sourceWindow
		? sourceWindow.getPosition()
		: [undefined, undefined];
	const windowTitle = sourceWindow?.getTitle() ?? productName;
	const zoomLevel = sourceWindow?.webContents.getZoomLevel();

	const query: Record<string, string> = {};
	if (tabId) query.tabId = tabId;
	if (paneId) query.paneId = paneId;

	const window = createWindow({
		id: "main",
		title: windowTitle,
		width: sourceWidth,
		height: sourceHeight,
		x: sourceX !== undefined ? sourceX + 32 : undefined,
		y: sourceY !== undefined ? sourceY + 32 : undefined,
		minWidth: 400,
		minHeight: 400,
		show: false,
		backgroundColor: nativeTheme.shouldUseDarkColors ? "#252525" : "#ffffff",
		movable: true,
		resizable: true,
		alwaysOnTop: false,
		autoHideMenuBar: true,
		frame: false,
		titleBarStyle: "hidden",
		trafficLightPosition: { x: 16, y: 16 },
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			webviewTag: true,
			partition: "persist:superset",
		},
		path: `/workspace/${workspaceId}`,
		query: Object.keys(query).length > 0 ? query : undefined,
	});

	if (PLATFORM.IS_MAC) {
		window.webContents.setBackgroundThrottling(false);
	}

	ipcWindowHandler?.attachWindow(window);

	window.webContents.once("did-finish-load", () => {
		if (zoomLevel !== undefined) {
			window.webContents.setZoomLevel(zoomLevel);
		}
		window.show();
		window.focus();
	});

	window.on("close", () => {
		ipcWindowHandler?.detachWindow(window);
	});

	return window;
}
