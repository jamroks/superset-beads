// superset tasks get SUP-42
// superset t get SUP-42 --json

export default command({
  description: "Get a task by ID or slug",

  args: [
    positional("idOrSlug").required().desc("Task ID or slug"),
  ],

  run: async (opts) => {
    const task = await opts.ctx.api.task.bySlug.query({ slug: opts.args.idOrSlug })

    return {
      data: task,
      message: [
        `${task.slug}: ${task.title}`,
        `Status:   ${task.status?.name ?? "—"}`,
        `Priority: ${task.priority ?? "—"}`,
        task.description ? `\n${task.description}` : "",
      ].filter(Boolean).join("\n"),
    }
  },
})
