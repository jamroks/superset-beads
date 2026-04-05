import { command, string } from "@superset/cli-framework";
import { readConfig, writeConfig, getApiUrl } from "../../../lib/config";
import { waitForAuthCallback } from "../../../lib/auth";

export default command({
	description: "Authenticate with Superset",

	options: {
		apiUrl: string().env("SUPERSET_API_URL").desc("Override API URL"),
	},

	run: async (opts) => {
		const config = readConfig();
		if (opts.options.apiUrl) config.apiUrl = opts.options.apiUrl;

		// Start local callback server and wait for browser redirect
		const callbackPromise = waitForAuthCallback(opts.signal);

		// We need the port before opening the browser, but the server
		// starts async. waitForAuthCallback resolves when the callback hits.
		// For now, we use a two-step approach:
		const { createServer } = await import("node:http");
		const { URL } = await import("node:url");

		const server = createServer((req, res) => {
			const url = new URL(req.url!, "http://localhost");
			if (url.pathname === "/callback") {
				const token = url.searchParams.get("token");
				if (!token) {
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end("<h1>Error: no token received</h1>");
					return;
				}
				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(
					"<h1>Logged in!</h1><p>You can close this tab and return to the terminal.</p>",
				);
				server.close();

				// Store token
				config.auth = { accessToken: token };
				writeConfig(config);
			}
		});

		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", resolve),
		);
		const port = (server.address() as { port: number }).port;

		const baseUrl = getApiUrl(config).replace("/api", "").replace("api.", "app.");
		const authUrl = `${baseUrl}/cli-auth?callback=http://localhost:${port}/callback`;

		// Open browser
		const { exec } = await import("node:child_process");
		const openCmd =
			process.platform === "darwin"
				? "open"
				: process.platform === "win32"
					? "start"
					: "xdg-open";
		exec(`${openCmd} "${authUrl}"`);

		console.log(`Opening browser to authenticate...`);
		console.log(`If it doesn't open, visit: ${authUrl}`);

		// Wait for callback
		await new Promise<void>((resolve, reject) => {
			server.on("close", resolve);
			opts.signal.addEventListener("abort", () => {
				server.close();
				reject(new Error("Login cancelled"));
			});
		});

		return {
			data: { apiUrl: getApiUrl(config) },
			message: "Logged in successfully.",
		};
	},
});
