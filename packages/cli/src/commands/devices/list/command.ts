import { command, boolean, table } from "@superset/cli-framework";

export default command({
	description: "List all devices in the org",
	options: {
		includeOffline: boolean().desc("Include offline devices"),
	},
	display: (data) => table(data as Record<string, unknown>[], ["deviceName", "deviceType", "status", "lastSeen"]),
	run: async (opts) => {
		// TODO: opts.ctx.api.device.list.query()
		return [];
	},
});
