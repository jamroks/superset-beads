// superset auth whoami
// Note: auth/ skips root middleware, but whoami needs auth.
// So it handles auth itself inline.

export default command({
  description: "Show current user and organization",

  run: async () => {
    const config = await readConfig()
    if (!config.auth) throw new CLIError("Not logged in", "Run: superset auth login")
    const api = createApiClient(config)

    const user = await api.user.me.query()
    const org = await api.user.myOrganization.query()

    return {
      data: { userId: user.id, email: user.email, name: user.name, orgId: org.id, orgName: org.name },
      message: `${user.name} (${user.email})\nOrganization: ${org.name}`,
    }
  },
})
