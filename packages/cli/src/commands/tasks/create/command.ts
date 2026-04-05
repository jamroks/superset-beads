// superset tasks create --title "Fix auth redirect" --priority high
// superset t create --title "Fix auth" --json

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
    const task = await opts.ctx.api.task.create.mutate({
      title: opts.options.title,
      description: opts.options.description,
      priority: opts.options.priority,
      branch: opts.options.branch,
    })

    return {
      data: task,
      message: `Created task ${task.slug}: ${task.title}`,
    }
  },
})
