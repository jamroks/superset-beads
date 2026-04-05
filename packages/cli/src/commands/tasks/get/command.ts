import { command, positional } from "@superset/cli-framework";

export default command({
	description: "Get a task by ID or slug",
	args: [positional("idOrSlug").required().desc("Task ID or slug")],
	run: async (opts) => {
		// TODO: opts.ctx.api.task.bySlug.query()
		return { data: {}, message: "Not implemented yet" };
	},
});
