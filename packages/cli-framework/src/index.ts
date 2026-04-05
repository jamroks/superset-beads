// Option builders
export { string, boolean, number, positional } from "./option";
export type { TypeOf, GenericBuilderInternals, ProcessedBuilderConfig } from "./option";

// Command definition
export { command } from "./command";
export type { CommandConfig, CommandResult } from "./command";

// Middleware
export { middleware, skip } from "./middleware";
export type { MiddlewareFn, MiddlewareExport } from "./middleware";

// CLI entry point
export { cli } from "./cli";
export type { CLIConfig } from "./cli";

// Output utilities
export { table, formatOutput } from "./output";

// Router utilities (for static/compiled mode)
export { buildStaticTree, routeCommand, resolveStaticMiddleware } from "./router";
export type { CommandNode } from "./help";
export { generateRootHelp, generateGroupHelp, generateCommandHelp } from "./help";
export { parseArgv, isAgentMode, camelToKebab } from "./parser";

// Errors
export { CLIError, suggestSimilar } from "./errors";
