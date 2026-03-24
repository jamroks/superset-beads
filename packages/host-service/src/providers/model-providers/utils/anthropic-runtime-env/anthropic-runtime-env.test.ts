import { describe, expect, it } from "bun:test";
import { parseAnthropicEnvText } from "./anthropic-runtime-env";

describe("parseAnthropicEnvText", () => {
	it("parses valid env vars and ignores comments", () => {
		const variables = parseAnthropicEnvText(
			[
				"# Gateway settings",
				'export ANTHROPIC_BASE_URL="https://ai-gateway.vercel.sh"',
				"ANTHROPIC_AUTH_TOKEN='gw-token'",
				"CLAUDE_CODE_USE_BEDROCK=1",
				"",
			].join("\n"),
		);

		expect(variables).toEqual({
			ANTHROPIC_BASE_URL: "https://ai-gateway.vercel.sh",
			ANTHROPIC_AUTH_TOKEN: "gw-token",
			CLAUDE_CODE_USE_BEDROCK: "1",
		});
	});

	it("rejects malformed lines", () => {
		expect(() => parseAnthropicEnvText("ANTHROPIC_BASE_URL")).toThrow(
			"Please provide a valid .env block.",
		);
	});

	it("parses multiline double-quoted values", () => {
		const variables = parseAnthropicEnvText(
			['MY_CERT="line1', "line2", 'line3"', "OTHER_VAR=simple"].join("\n"),
		);

		expect(variables).toEqual({
			MY_CERT: "line1\nline2\nline3",
			OTHER_VAR: "simple",
		});
	});

	it("parses multiline value with export prefix", () => {
		const variables = parseAnthropicEnvText(
			['export MY_KEY="first', "second", 'third"'].join("\n"),
		);

		expect(variables).toEqual({
			MY_KEY: "first\nsecond\nthird",
		});
	});

	it("rejects unterminated multiline value", () => {
		expect(() =>
			parseAnthropicEnvText(['MY_VAR="line1', "line2"].join("\n")),
		).toThrow("Please provide a valid .env block. Invalid line 1.");
	});

	it("handles single-line double-quoted values normally", () => {
		const variables = parseAnthropicEnvText('MY_VAR="hello world"');
		expect(variables).toEqual({ MY_VAR: "hello world" });
	});

	it("handles multiple multiline values", () => {
		const variables = parseAnthropicEnvText(
			[
				'CERT="-----BEGIN CERTIFICATE-----',
				"abc123",
				'-----END CERTIFICATE-----"',
				'KEY="-----BEGIN KEY-----',
				"xyz789",
				'-----END KEY-----"',
			].join("\n"),
		);

		expect(variables).toEqual({
			CERT: "-----BEGIN CERTIFICATE-----\nabc123\n-----END CERTIFICATE-----",
			KEY: "-----BEGIN KEY-----\nxyz789\n-----END KEY-----",
		});
	});
});
