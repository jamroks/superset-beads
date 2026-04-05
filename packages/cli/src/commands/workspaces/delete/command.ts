// superset workspaces delete ws-123
// superset ws delete ws-123 ws-456

export default command({
  description: "Delete workspaces",

  args: [
    positional("ids").required().variadic().desc("Workspace IDs"),
  ],

  options: {
    device: string().env("SUPERSET_DEVICE").desc("Device ID"),
  },

  run: async (opts) => {
    if (!opts.ctx.deviceId) throw new CLIError("No device found", "Use --device or run: superset devices list")
    for (const id of opts.args.ids) {
      await opts.ctx.api.v2Workspace.delete.mutate({ id })
    }

    return {
      data: { count: opts.args.ids.length },
      message: opts.args.ids.length === 1
        ? `Deleted workspace ${opts.args.ids[0]}`
        : `Deleted ${opts.args.ids.length} workspaces`,
    }
  },
})
