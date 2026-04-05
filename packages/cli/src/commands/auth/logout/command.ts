import { command } from "@superset/cli-framework";

export default command({
	description: "Clear stored credentials",

	run: async () => {
		// TODO: readConfig(), delete auth, writeConfig()
		return { message: "Logged out." };
	},
});
