#!/usr/bin/env bun

// Entry point. What should this look like?
// Option A: scan commands/ dir automatically
// Option B: explicit registration
// Option C: both

// For now, just showing the ideal:

cli({
  name: "superset",
  version: "0.1.0",
  commands: "./commands",
  globals: {
    json: boolean().desc("Output as JSON"),
    quiet: boolean().desc("Output IDs only"),
    device: string().env("SUPERSET_DEVICE").desc("Override device"),
  },
})
