import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

export type AuthResult = {
	token: string;
	expiresAt: string;
	state: string;
};

/**
 * Start a local HTTP server, open the browser for OAuth, and wait
 * for the callback with a session token.
 *
 * Uses the existing /api/auth/desktop/connect endpoint which supports
 * localhost callbacks for native apps.
 */
export async function browserAuth(
	apiUrl: string,
	signal: AbortSignal,
	provider: "github" | "google" = "github",
): Promise<AuthResult> {
	const state = randomBytes(32).toString("base64url");

	return new Promise<AuthResult>((resolve, reject) => {
		const server = createServer((req, res) => {
			const url = new URL(req.url!, `http://127.0.0.1`);

			if (url.pathname !== "/auth/callback") {
				res.writeHead(404);
				res.end("Not found");
				return;
			}

			const token = url.searchParams.get("token");
			const expiresAt = url.searchParams.get("expiresAt");
			const returnedState = url.searchParams.get("state");

			if (!token || !expiresAt) {
				res.writeHead(400, { "Content-Type": "text/html" });
				res.end("<h1>Error: missing token</h1>");
				return;
			}

			if (returnedState !== state) {
				res.writeHead(400, { "Content-Type": "text/html" });
				res.end("<h1>Error: state mismatch — possible CSRF attack</h1>");
				return;
			}

			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(
				"<html><body style='font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a2e;color:#eee'>" +
					"<div style='text-align:center'><h1>Logged in!</h1><p>You can close this tab and return to the terminal.</p></div>" +
					"</body></html>",
			);

			server.close();
			resolve({ token, expiresAt, state: returnedState });
		});

		signal.addEventListener("abort", () => {
			server.close();
			reject(new Error("Login cancelled"));
		});

		server.listen(0, "127.0.0.1", async () => {
			const port = (server.address() as { port: number }).port;
			const callbackUrl = `http://127.0.0.1:${port}/auth/callback`;

			// Build the auth URL using the desktop connect endpoint
			const authUrl = new URL(`${apiUrl}/api/auth/desktop/connect`);
			authUrl.searchParams.set("provider", provider);
			authUrl.searchParams.set("state", state);
			authUrl.searchParams.set("protocol", "superset-cli");
			authUrl.searchParams.set("local_callback", callbackUrl);

			// Open browser
			const openCmd =
				process.platform === "darwin"
					? "open"
					: process.platform === "win32"
						? "start"
						: "xdg-open";

			const { exec } = await import("node:child_process");
			exec(`${openCmd} "${authUrl.toString()}"`);

			console.log("Opening browser to authenticate...");
			console.log(
				`If it doesn't open, visit:\n${authUrl.toString()}\n`,
			);
		});
	});
}
