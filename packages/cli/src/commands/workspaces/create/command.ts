import { command, string } from "@superset/cli-framework";

export default command({
	description: "Create a workspace on a device",
	options: {
		device: string().env("SUPERSET_DEVICE").desc("Device ID"),
		project: string().required().desc("Project ID"),
		name: string().required().desc("Workspace name"),
		branch: string().required().desc("Git branch"),
	},
	run: async (opts) => {
		// TODO: opts.ctx.api.v2Workspace.create.mutate()
		return { data: {}, message: `Created workspace "${opts.options.name}"` };
	},
});
