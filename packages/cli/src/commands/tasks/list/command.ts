import { command, string, number, boolean, table } from "@superset/cli-framework";

export default command({
	description: "List tasks in the org",
	options: {
		status: string().enum("backlog", "todo", "in_progress", "done", "cancelled").desc("Filter by status"),
		priority: string().enum("urgent", "high", "medium", "low", "none").desc("Filter by priority"),
		assigneeMe: boolean().alias("m").desc("Filter to my tasks"),
		creatorMe: boolean().desc("Filter to tasks I created"),
		search: string().alias("s").desc("Search query"),
		limit: number().default(50).desc("Max results"),
		offset: number().default(0).desc("Skip results"),
	},
	display: (data) => table(data as Record<string, unknown>[], ["slug", "title", "status", "priority", "assignee"]),
	run: async (opts) => {
		// TODO: opts.ctx.api.task.all.query()
		return [];
	},
});
