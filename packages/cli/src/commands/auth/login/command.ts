import { command, string } from "@superset/cli-framework";
import * as p from "@clack/prompts";
import { readConfig, writeConfig, getApiUrl } from "../../../lib/config";
import { deviceAuth } from "../../../lib/auth";

export default command({
	description: "Authenticate with Superset",

	options: {
		apiUrl: string().env("SUPERSET_API_URL").desc("Override API URL"),
	},

	run: async (opts) => {
		const config = readConfig();
		if (opts.options.apiUrl) config.apiUrl = opts.options.apiUrl;

		const apiUrl = getApiUrl(config);

		p.intro("superset auth login");

		const s = p.spinner();
		s.start("Waiting for browser authorization...");

		const token = await deviceAuth(apiUrl, opts.signal);

		config.auth = { accessToken: token };
		writeConfig(config);

		s.stop("Authorized!");
		p.outro("Logged in successfully.");

		return {
			data: { apiUrl },
		};
	},
});
