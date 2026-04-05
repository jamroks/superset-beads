// superset workspaces create --project abc --name fix-auth --branch main
// superset ws create --project abc --name fix-auth --branch main

export default command({
  description: "Create a workspace on a device",

  options: {
    device: string().env("SUPERSET_DEVICE").desc("Device ID"),
    project: string().required().desc("Project ID"),
    name: string().required().desc("Workspace name"),
    branch: string().required().desc("Git branch"),
  },

  run: async (opts) => {
    if (!opts.ctx.deviceId) throw new CLIError("No device found", "Use --device or run: superset devices list")
    const ws = await opts.ctx.api.v2Workspace.create.mutate({
      deviceId: opts.ctx.deviceId,
      projectId: opts.options.project,
      name: opts.options.name,
      branch: opts.options.branch,
    })

    return {
      data: ws,
      message: `Created workspace "${ws.name}"`,
    }
  },
})
