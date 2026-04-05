// superset host stop
// superset-host stop

export default command({
  description: "Stop the host service daemon",

  run: async () => {
    const pid = readPidFile()
    if (!pid) throw new CLIError("Host service is not running")
    process.kill(pid)
    removePidFile()
    return { data: { pid }, message: `Host service stopped (PID ${pid})` }
  },
})
