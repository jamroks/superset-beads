// superset host status
// superset-host status

export default command({
  description: "Check host service status",

  run: async () => {
    const pid = readPidFile()
    if (!pid || !isProcessAlive(pid)) {
      return { data: { running: false }, message: "Host service is not running" }
    }

    const info = await getHostInfo(pid)
    return {
      data: { running: true, ...info },
      message: [
        "Host service is running",
        `PID:     ${info.pid}`,
        `Port:    ${info.port}`,
        `Uptime:  ${info.uptime}`,
        `Device:  ${info.deviceName}`,
      ].join("\n"),
    }
  },
})
