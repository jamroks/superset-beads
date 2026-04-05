import { command, string } from "@superset/cli-framework";

export default command({
	description: "Authenticate with Superset",

	options: {
		apiUrl: string().env("SUPERSET_API_URL").desc("Override API URL"),
	},

	run: async (opts) => {
		// TODO: implement browser auth flow
		// 1. Start local callback server
		// 2. Open browser to app.superset.sh/cli-auth
		// 3. Wait for callback with token
		// 4. Store in ~/.superset/config.json
		return { message: "Not implemented yet" };
	},
});
