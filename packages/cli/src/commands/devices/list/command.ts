// superset devices list
// superset devices list --include-offline

export default command({
  description: "List all devices in the org",

  options: {
    includeOffline: boolean().desc("Include offline devices"),
  },

  display: (data) => table(data, ["deviceName", "deviceType", "status", "lastSeen"]),

  run: async (opts) => {
    return await opts.ctx.api.device.list.query({
      includeOffline: opts.options.includeOffline,
    })
  },
})
