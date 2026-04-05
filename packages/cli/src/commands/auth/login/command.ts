import { command, string } from "@superset/cli-framework";
import { readConfig, writeConfig, getApiUrl } from "../../../lib/config";
import { browserAuth } from "../../../lib/auth";

export default command({
	description: "Authenticate with Superset",

	options: {
		apiUrl: string().env("SUPERSET_API_URL").desc("Override API URL"),
		provider: string()
			.enum("github", "google")
			.default("github")
			.desc("OAuth provider"),
	},

	run: async (opts) => {
		const config = readConfig();
		if (opts.options.apiUrl) config.apiUrl = opts.options.apiUrl;

		const apiUrl = getApiUrl(config);
		const result = await browserAuth(
			apiUrl,
			opts.signal,
			opts.options.provider as "github" | "google",
		);

		config.auth = { accessToken: result.token };
		writeConfig(config);

		return {
			data: { expiresAt: result.expiresAt },
			message: "Logged in successfully.",
		};
	},
});
