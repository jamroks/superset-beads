import type { registerRoute } from "lib/window-loader";

type Route = Parameters<typeof registerRoute>[0];

export interface WindowProps extends Electron.BrowserWindowConstructorOptions {
	id: Route["id"];
	path?: Route["path"];
	query?: Route["query"];
}
