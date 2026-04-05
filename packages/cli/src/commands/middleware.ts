import { middleware, CLIError } from "@superset/cli-framework";

// Root middleware — applies to all commands unless they skip
export default middleware(async (opts) => {
	// TODO: wire up readConfig(), createApiClient() from packages/cli/src/lib/
	const config = {};
	const api = {};
	const deviceId = (opts.options.device as string) ?? undefined;
	return opts.next({ ctx: { api, config, deviceId } });
});
