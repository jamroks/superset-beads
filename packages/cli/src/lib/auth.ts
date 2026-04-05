import { CLIError } from "@superset/cli-framework";

export type DeviceCodeResponse = {
	deviceCode: string;
	userCode: string;
	verificationUri: string;
	verificationUriComplete: string;
	expiresIn: number;
	interval: number;
};

export type DeviceTokenResponse = {
	accessToken: string;
	tokenType: string;
};

/**
 * OAuth 2.0 Device Authorization Flow (RFC 8628).
 *
 * 1. Request device code from the API
 * 2. Open browser with pre-filled code
 * 3. Poll until user approves
 * 4. Return the access token
 */
export async function deviceAuth(
	apiUrl: string,
	signal: AbortSignal,
): Promise<string> {
	// Step 1: Request device code
	const codeRes = await fetch(`${apiUrl}/api/auth/device/code`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({}),
	});

	if (!codeRes.ok) {
		throw new CLIError(
			`Failed to start auth flow: ${codeRes.status}`,
			"Is the API running?",
		);
	}

	const codeData = (await codeRes.json()) as DeviceCodeResponse;

	// Step 2: Open browser with pre-filled code
	const verificationUrl =
		codeData.verificationUriComplete || codeData.verificationUri;

	const openCmd =
		process.platform === "darwin"
			? "open"
			: process.platform === "win32"
				? "start"
				: "xdg-open";

	const { exec } = await import("node:child_process");
	exec(`${openCmd} "${verificationUrl}"`);

	console.log("Opening browser to authorize...");
	console.log(`If it doesn't open, visit: ${verificationUrl}`);
	if (codeData.userCode) {
		console.log(`Your code: ${codeData.userCode}\n`);
	}

	// Step 3: Poll for token
	const interval = (codeData.interval || 5) * 1000;
	const deadline = Date.now() + codeData.expiresIn * 1000;

	while (Date.now() < deadline) {
		if (signal.aborted) {
			throw new CLIError("Login cancelled");
		}

		await sleep(interval);

		const tokenRes = await fetch(`${apiUrl}/api/auth/device/token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				deviceCode: codeData.deviceCode,
				grantType: "urn:ietf:params:oauth:grant-type:device_code",
			}),
		});

		if (tokenRes.ok) {
			const tokenData = (await tokenRes.json()) as DeviceTokenResponse;
			return tokenData.accessToken;
		}

		const error = (await tokenRes.json()) as { error?: string };

		if (error.error === "authorization_pending") {
			continue;
		}
		if (error.error === "slow_down") {
			await sleep(5000); // Back off 5 more seconds
			continue;
		}
		if (error.error === "access_denied") {
			throw new CLIError("Authorization denied by user");
		}
		if (error.error === "expired_token") {
			throw new CLIError("Authorization expired — please try again");
		}

		throw new CLIError(`Auth error: ${error.error ?? tokenRes.status}`);
	}

	throw new CLIError("Authorization timed out — please try again");
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
