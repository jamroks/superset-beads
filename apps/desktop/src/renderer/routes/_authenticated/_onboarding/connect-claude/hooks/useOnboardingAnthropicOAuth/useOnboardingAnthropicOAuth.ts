import { chatServiceTrpc } from "@superset/chat/client";
import { useCallback, useState } from "react";
import { electronTrpcClient } from "renderer/lib/trpc-client";

export type OAuthPhase = "connect" | "auth-code";

export function useOnboardingAnthropicOAuth() {
	const [phase, setPhase] = useState<OAuthPhase>("connect");
	const [authUrl, setAuthUrl] = useState<string | null>(null);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);

	const startOAuthMutation =
		chatServiceTrpc.auth.startAnthropicOAuth.useMutation();
	const completeOAuthMutation =
		chatServiceTrpc.auth.completeAnthropicOAuth.useMutation();
	const cancelOAuthMutation =
		chatServiceTrpc.auth.cancelAnthropicOAuth.useMutation();

	const startOAuth = useCallback(async () => {
		setError(null);
		try {
			const result = await startOAuthMutation.mutateAsync();
			setAuthUrl(result.url);
			setCode("");
			setPhase("auth-code");

			// Open browser
			try {
				await electronTrpcClient.external.openUrl.mutate(result.url);
			} catch {
				// Browser failed to open, user can use manual link
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to start OAuth flow",
			);
		}
	}, [startOAuthMutation]);

	const completeOAuth = useCallback(
		async (codeOverride?: string) => {
			const trimmedCode = (codeOverride ?? code).trim();
			if (!trimmedCode) return;

			setError(null);
			try {
				await completeOAuthMutation.mutateAsync({ code: trimmedCode });
				return true;
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to complete OAuth",
				);
				return false;
			}
		},
		[code, completeOAuthMutation],
	);

	const openAuthUrl = useCallback(async () => {
		if (!authUrl) return;
		try {
			await electronTrpcClient.external.openUrl.mutate(authUrl);
		} catch {
			setError("Failed to open browser");
		}
	}, [authUrl]);

	const cancel = useCallback(() => {
		setPhase("connect");
		setCode("");
		setError(null);
		setAuthUrl(null);
		void cancelOAuthMutation.mutateAsync().catch(() => {});
	}, [cancelOAuthMutation]);

	return {
		phase,
		authUrl,
		code,
		error,
		isStarting: startOAuthMutation.isPending,
		isCompleting: completeOAuthMutation.isPending,
		setCode,
		startOAuth,
		completeOAuth,
		openAuthUrl,
		cancel,
	};
}
