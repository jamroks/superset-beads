import { command, string } from "@superset/cli-framework";
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
		const token = await deviceAuth(apiUrl, opts.signal);

		config.auth = { accessToken: token };
		writeConfig(config);

		return {
			data: { apiUrl },
			message: "Logged in successfully.",
		};
	},
});
