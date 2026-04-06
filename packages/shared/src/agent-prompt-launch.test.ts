import { describe, expect, test } from "bun:test";
import { buildAgentPromptCommand } from "./agent-command";
import { buildPromptCommandString } from "./agent-prompt-launch";

const RANDOM_ID = "a662aabea9f9472eb0bfc2211fe09920";

describe("buildPromptCommandString", () => {
	test("argv transport puts prompt as positional argument", () => {
		const result = buildPromptCommandString({
			command: "claude --dangerously-skip-permissions",
			transport: "argv",
			prompt: "hello world",
			randomId: RANDOM_ID,
		});
		expect(result).toContain('"$(cat');
		expect(result).toStartWith("claude --dangerously-skip-permissions");
	});

	test("stdin transport pipes prompt via heredoc", () => {
		const result = buildPromptCommandString({
			command: "amp",
			transport: "stdin",
			prompt: "hello world",
			randomId: RANDOM_ID,
		});
		expect(result).toContain("<<'SUPERSET_PROMPT_");
		expect(result).not.toContain('"$(cat');
		expect(result).toStartWith("amp");
	});

	test("argv transport with suffix places suffix after prompt", () => {
		const result = buildPromptCommandString({
			command: "gemini",
			suffix: "--yolo",
			transport: "argv",
			prompt: "hello world",
			randomId: RANDOM_ID,
		});
		expect(result).toContain('"$(cat');
		expect(result).toEndWith("--yolo");
	});

	test("stdin transport with suffix joins suffix before heredoc", () => {
		const result = buildPromptCommandString({
			command: "copilot -i --allow-all",
			suffix: "--yolo",
			transport: "stdin",
			prompt: "hello world",
			randomId: RANDOM_ID,
		});
		expect(result).toContain("<<'SUPERSET_PROMPT_");
		expect(result).not.toContain('"$(cat');
		expect(result).toStartWith(
			"copilot -i --allow-all --yolo <<'SUPERSET_PROMPT_",
		);
	});
});

describe("copilot prompt command uses stdin transport (issue #3212)", () => {
	test("copilot prompt command does not pass prompt as positional argument", () => {
		const result = buildAgentPromptCommand({
			prompt: "nav menu",
			randomId: RANDOM_ID,
			agent: "copilot",
		});

		// The copilot CLI does not accept positional arguments.
		// With argv transport this would produce:
		//   copilot -i --allow-all "$(cat <<'...' nav menu ...)" --yolo
		// which fails with "error: too many arguments. Expected 0 arguments but got 1."
		//
		// With stdin transport it should produce:
		//   copilot -i --allow-all --yolo <<'...'
		//   nav menu
		//   ...
		expect(result).not.toContain('"$(cat');
		expect(result).toContain("<<'SUPERSET_PROMPT_");
		expect(result).toStartWith("copilot -i --allow-all --yolo");
	});
});
