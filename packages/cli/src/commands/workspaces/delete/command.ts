import { command, string, positional } from "@superset/cli-framework";

export default command({
	description: "Delete workspaces",
	args: [positional("ids").required().variadic().desc("Workspace IDs")],
	options: {
		device: string().env("SUPERSET_DEVICE").desc("Device ID"),
	},
	run: async (opts) => {
		const ids = opts.args.ids as string[];
		// TODO: delete each workspace
		return {
			data: { count: ids.length },
			message: ids.length === 1 ? `Deleted workspace ${ids[0]}` : `Deleted ${ids.length} workspaces`,
		};
	},
});
