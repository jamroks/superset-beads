#!/usr/bin/env bun
import { cli, string, boolean } from "@superset/cli-framework";

await cli({
	name: "superset",
	version: "0.1.0",
	commands: new URL("./commands", import.meta.url).pathname,
	globals: {
		json: boolean().desc("Output as JSON"),
		quiet: boolean().desc("Output IDs only"),
		device: string().env("SUPERSET_DEVICE").desc("Override device"),
	},
});
