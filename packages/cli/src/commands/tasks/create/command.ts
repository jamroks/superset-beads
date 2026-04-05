import { command, string } from "@superset/cli-framework";

export default command({
	description: "Create a task",
	options: {
		title: string().required().desc("Task title"),
		description: string().desc("Task description"),
		priority: string().enum("urgent", "high", "medium", "low", "none").desc("Priority"),
		assignee: string().desc("Assignee user ID"),
		branch: string().desc("Git branch"),
		dueDate: string().desc("Due date (YYYY-MM-DD)"),
	},
	run: async (opts) => {
		// TODO: opts.ctx.api.task.create.mutate()
		return { data: {}, message: `Created task: ${opts.options.title}` };
	},
});
