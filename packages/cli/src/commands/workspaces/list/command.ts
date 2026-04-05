// superset workspaces list
// superset ws list
// superset ws list --device abc123

export default command({
  description: "List workspaces on a device",

  options: {
    device: string().env("SUPERSET_DEVICE").desc("Device ID"),
  },

  display: (data) => table(data, ["name", "branch", "projectName"]),

  run: async (opts) => {
    if (!opts.ctx.deviceId) throw new CLIError("No device found", "Use --device or run: superset devices list")
    return await opts.ctx.api.listWorkspaces({ deviceId: opts.ctx.deviceId })
  },
})
