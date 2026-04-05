// superset tasks delete SUP-42
// superset t delete SUP-42 SUP-43 SUP-44

export default command({
  description: "Delete tasks",

  args: [
    positional("ids").required().variadic().desc("Task IDs or slugs"),
  ],

  run: async (opts) => {
    for (const id of opts.args.ids) {
      const task = await opts.ctx.api.task.bySlug.query({ slug: id })
      await opts.ctx.api.task.delete.mutate({ id: task.id })
    }

    return {
      data: { count: opts.args.ids.length, ids: opts.args.ids },
      message: opts.args.ids.length === 1
        ? `Deleted task ${opts.args.ids[0]}`
        : `Deleted ${opts.args.ids.length} tasks`,
    }
  },
})
