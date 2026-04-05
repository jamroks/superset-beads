// superset auth login

export default command({
  description: "Authenticate with Superset",

  options: {
    apiUrl: string().env("SUPERSET_API_URL").desc("Override API URL"),
  },

  run: async (opts) => {
    // Start local callback server
    const { server, port } = await startCallbackServer(opts.signal)

    // Open browser to auth page
    const authUrl = `${opts.options.apiUrl ?? "https://app.superset.sh"}/cli-auth?callback=http://localhost:${port}`
    await open(authUrl)

    // Wait for callback with token (or signal abort)
    const { token, user, org } = await server.waitForCallback()

    // Store credentials
    const config = await readConfig()
    config.auth = { accessToken: token }
    if (opts.options.apiUrl) config.apiUrl = opts.options.apiUrl
    await writeConfig(config)

    return {
      data: { userId: user.id, email: user.email, name: user.name, orgName: org.name },
      message: `Logged in as ${user.name} (${user.email})\nOrganization: ${org.name}`,
    }
  },
})
