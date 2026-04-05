import { createServer, type Server } from "node:http";

type AuthCallbackResult = {
	token: string;
};

export async function waitForAuthCallback(
	signal: AbortSignal,
): Promise<{ token: string; port: number }> {
	return new Promise((resolve, reject) => {
		const server = createServer((req, res) => {
			const url = new URL(req.url!, `http://localhost`);

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
				resolve({ token, port: (server.address() as any).port });
			}
		});

		signal.addEventListener("abort", () => {
			server.close();
			reject(new Error("Login cancelled"));
		});

		server.listen(0, "127.0.0.1", () => {
			// Port 0 = OS picks a random available port
		});
	});
}

export function getCallbackPort(server: Server): number {
	const addr = server.address();
	if (typeof addr === "object" && addr) return addr.port;
	throw new Error("Server not listening");
}
