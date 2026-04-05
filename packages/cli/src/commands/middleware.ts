// Root middleware — applies to all commands unless they skip

export default middleware(async (opts) => {
  const config = await readConfig()
  if (!config.auth) throw new CLIError("Not logged in", "Run: superset auth login")
  const api = createApiClient(config)
  const deviceId = opts.options.device ?? readDeviceConfig()?.deviceId
  return opts.next({ ctx: { api, config, deviceId } })
})
