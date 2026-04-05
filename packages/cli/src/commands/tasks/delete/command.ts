import { command, positional } from "@superset/cli-framework";

export default command({
	description: "Delete tasks",
	args: [positional("ids").required().variadic().desc("Task IDs or slugs")],
	run: async (opts) => {
		const ids = opts.args.ids as string[];
		// TODO: delete each task
		return {
			data: { count: ids.length, ids },
			message: ids.length === 1 ? `Deleted task ${ids[0]}` : `Deleted ${ids.length} tasks`,
		};
	},
});
