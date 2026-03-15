export const PROVIDERS = ["claude-code", "codex"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const AUTH_METHODS = ["oauth", "api-key"] as const;
export type AuthMethod = (typeof AUTH_METHODS)[number];

export interface AuthMethodOption {
	id: AuthMethod;
	label: string;
	description: string;
	badge?: string;
}

export const CLAUDE_AUTH_METHOD_OPTIONS: AuthMethodOption[] = [
	{
		id: "oauth",
		label: "Claude Pro / Max",
		description: "Connect with your Anthropic account.",
		badge: "Recommended",
	},
	{
		id: "api-key",
		label: "API Key / Environment",
		description: "Configure API key or environment variables.",
	},
];

export const CODEX_AUTH_METHOD_OPTIONS: AuthMethodOption[] = [
	{
		id: "api-key",
		label: "OpenAI API Key",
		description: "Pay-as-you-go with your own API key.",
	},
];
