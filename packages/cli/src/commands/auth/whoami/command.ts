import { command } from "@superset/cli-framework";

export default command({
	description: "Show current user and organization",

	run: async () => {
		// TODO: readConfig(), createApiClient(), query user + org
		return {
			data: { userId: "todo", email: "todo", name: "todo" },
			message: "Not implemented yet",
		};
	},
});
