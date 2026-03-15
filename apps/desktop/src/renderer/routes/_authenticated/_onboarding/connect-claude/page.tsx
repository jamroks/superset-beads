import { ChatServiceProvider } from "@superset/chat/client";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LuArrowLeft } from "react-icons/lu";
import { createChatServiceIpcClient } from "renderer/lib/chat-service-ipc-client";
import { electronTrpcClient } from "renderer/lib/trpc-client";
import { electronQueryClient } from "renderer/providers/ElectronTRPCProvider";
import type { AuthMethod, Provider } from "../connect-provider/constants";
import { ApiKeyInput } from "./components/ApiKeyInput";
import { CodexApiKeyInput } from "./components/CodexApiKeyInput";
import { ConnectClaudeLogo } from "./components/ConnectClaudeLogo";
import { useOnboardingAnthropicOAuth } from "./hooks/useOnboardingAnthropicOAuth";

const chatServiceClient = createChatServiceIpcClient();

export const Route = createFileRoute(
	"/_authenticated/_onboarding/connect-claude/",
)({
	component: ConnectClaudePage,
	validateSearch: (
		search: Record<string, unknown>,
	): { method?: AuthMethod; provider?: Provider } => ({
		method: (["oauth", "api-key"] as const).includes(
			search.method as AuthMethod,
		)
			? (search.method as AuthMethod)
			: undefined,
		provider: (["claude-code", "codex"] as const).includes(
			search.provider as Provider,
		)
			? (search.provider as Provider)
			: undefined,
	}),
});

function ConnectClaudePage() {
	return (
		<ChatServiceProvider
			client={chatServiceClient}
			queryClient={electronQueryClient}
		>
			<ConnectClaudePageContent />
		</ChatServiceProvider>
	);
}

function ConnectClaudePageContent() {
	const navigate = useNavigate();
	const { method: searchMethod, provider: searchProvider } = Route.useSearch();

	const selectedAuthMethod = searchMethod ?? "oauth";
	const selectedProvider = searchProvider ?? "claude-code";

	const oauth = useOnboardingAnthropicOAuth();

	const handleSuccess = async () => {
		// Use imperative client to avoid React context nesting issues
		await electronTrpcClient.uiState.onboarding.set.mutate({
			providerOnboardingCompleted: true,
		});
		navigate({ to: "/select-repository", replace: true });
	};

	const handleBack = () => {
		if (
			selectedAuthMethod === "oauth" &&
			selectedProvider === "claude-code" &&
			oauth.phase === "auth-code"
		) {
			oauth.cancel();
		} else {
			navigate({ to: "/connect-provider", replace: true });
		}
	};

	const handleOAuthSubmit = async (code?: string) => {
		const success = await oauth.completeOAuth(code);
		if (success) {
			await handleSuccess();
		}
	};

	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="w-full max-w-md px-6">
				{/* Back button */}
				<button
					type="button"
					onClick={handleBack}
					className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<LuArrowLeft className="h-4 w-4" />
					Back
				</button>

				<ConnectClaudeLogo />

				{/* Claude Code — OAuth */}
				{selectedProvider === "claude-code" &&
					selectedAuthMethod === "oauth" && (
						<OAuthFlow oauth={oauth} onSubmit={handleOAuthSubmit} />
					)}

				{/* Claude Code — API Key / Environment */}
				{selectedProvider === "claude-code" &&
					selectedAuthMethod === "api-key" && (
						<>
							<div className="text-center mb-6">
								<h1 className="text-xl font-semibold">Connect with API Key</h1>
								<p className="text-sm text-muted-foreground mt-1">
									Paste your Anthropic API key or environment variables.
								</p>
							</div>
							<ApiKeyInput onSuccess={handleSuccess} />
						</>
					)}

				{/* Codex — API Key */}
				{selectedProvider === "codex" && selectedAuthMethod === "api-key" && (
					<>
						<div className="text-center mb-6">
							<h1 className="text-xl font-semibold">Connect Codex</h1>
							<p className="text-sm text-muted-foreground mt-1">
								Paste your OpenAI API key to enable Codex.
							</p>
						</div>
						<CodexApiKeyInput onSuccess={handleSuccess} />
					</>
				)}
			</div>
		</div>
	);
}

function OAuthFlow({
	oauth,
	onSubmit,
}: {
	oauth: ReturnType<typeof useOnboardingAnthropicOAuth>;
	onSubmit: (code?: string) => void;
}) {
	const [showSpinner, setShowSpinner] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		};
	}, []);

	const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
		const pasted = e.clipboardData.getData("text").trim();
		if (!pasted) return;

		e.preventDefault();
		oauth.setCode(pasted);

		// Brief delay to show pasted value, then auto-submit with code directly
		setShowSpinner(true);
		timerRef.current = setTimeout(() => {
			setShowSpinner(false);
			onSubmit(pasted);
		}, 500);
	};

	const isVerifying = oauth.isCompleting || showSpinner;

	if (oauth.phase === "connect") {
		return (
			<div className="text-center">
				<h1 className="text-xl font-semibold mb-2">Connect Claude Code</h1>
				<p className="text-sm text-muted-foreground mb-6">
					Sign in with your Anthropic account to get started.
				</p>
				<Button
					className="w-full"
					onClick={oauth.startOAuth}
					disabled={oauth.isStarting}
				>
					{oauth.isStarting ? "Opening browser..." : "Connect"}
				</Button>
				{oauth.error && (
					<p className="text-sm text-destructive mt-3">{oauth.error}</p>
				)}
			</div>
		);
	}

	return (
		<div>
			<div className="text-center mb-6">
				<h1 className="text-xl font-semibold">Enter Auth Code</h1>
				<p className="text-sm text-muted-foreground mt-1">
					Paste the authorization code from your browser.
				</p>
			</div>

			<div className="space-y-4">
				<div className="relative">
					<Input
						value={oauth.code}
						onChange={(e) => oauth.setCode(e.target.value)}
						onPaste={handlePaste}
						placeholder="Paste auth code here..."
						onKeyDown={(e) => e.key === "Enter" && onSubmit()}
						autoFocus
						disabled={isVerifying}
						className={isVerifying ? "pr-10" : ""}
					/>
					{isVerifying && (
						<div className="absolute right-3 top-1/2 -translate-y-1/2">
							<div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
						</div>
					)}
				</div>
				{oauth.error && !isVerifying && (
					<p className="text-sm text-destructive">{oauth.error}</p>
				)}
				<p className="text-center text-xs text-muted-foreground">
					Didn't open?{" "}
					<button
						type="button"
						onClick={oauth.openAuthUrl}
						className="underline underline-offset-2 hover:text-foreground"
					>
						Click here
					</button>
				</p>
			</div>
		</div>
	);
}
