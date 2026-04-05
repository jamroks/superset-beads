// superset host install
// superset-host install

export default command({
  description: "Install host service to run on boot",

  run: async () => {
    const platform = process.platform
    const path = installService()

    return {
      data: { platform, path },
      message: [
        "Installed host service",
        `  ${platform === "darwin" ? "macOS" : "Linux"}: ${path}`,
        "  Starts on boot, restarts on crash",
        "  Run `superset host uninstall` to remove",
      ].join("\n"),
    }
  },
})
