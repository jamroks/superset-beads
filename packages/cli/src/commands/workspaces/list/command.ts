import { command, string, table } from "@superset/cli-framework";

export default command({
	description: "List workspaces on a device",
	options: {
		device: string().env("SUPERSET_DEVICE").desc("Device ID"),
	},
	display: (data) => table(data as Record<string, unknown>[], ["name", "branch", "projectName"]),
	run: async (opts) => {
		// TODO: route to device
		return [];
	},
});
