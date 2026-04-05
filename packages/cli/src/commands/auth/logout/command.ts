// superset auth logout

export default command({
  description: "Clear stored credentials",

  run: async () => {
    const config = readConfig()
    delete config.auth
    writeConfig(config)
    return { message: "Logged out." }
  },
})
