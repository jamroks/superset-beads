// superset host start
// superset host start --daemon
// superset host start --port 8080

export default command({
  description: "Start the host service",

  options: {
    daemon: boolean().desc("Run in background"),
    port: number().default(51741).desc("Port to listen on"),
  },

  run: async (opts) => {
    if (opts.options.daemon) {
      const pid = spawnDaemon(opts.options.port)
      return {
        data: { pid, port: opts.options.port, daemon: true },
        message: `Host service started (PID ${pid})\nLogs: ~/.superset/host.log`,
      }
    }

    // Foreground — blocks until ctrl+c
    const server = startHostService(opts.options.port)
    opts.signal.addEventListener("abort", () => server.close())
    await server.listening()
  },
})
