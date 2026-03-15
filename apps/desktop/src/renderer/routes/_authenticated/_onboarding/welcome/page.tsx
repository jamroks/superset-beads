import { ChatServiceProvider, chatServiceTrpc } from "@superset/chat/client";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { createChatServiceIpcClient } from "renderer/lib/chat-service-ipc-client";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { electronQueryClient } from "renderer/providers/ElectronTRPCProvider";

const chatServiceClient = createChatServiceIpcClient();

export const Route = createFileRoute("/_authenticated/_onboarding/welcome/")({
	component: WelcomePage,
});

function WelcomePage() {
	return (
		<ChatServiceProvider
			client={chatServiceClient}
			queryClient={electronQueryClient}
		>
			<WelcomePageContent />
		</ChatServiceProvider>
	);
}

function WelcomePageContent() {
	const navigate = useNavigate();
	const { data: onboardingState, isLoading: isOnboardingLoading } =
		electronTrpc.uiState.onboarding.get.useQuery();
	const { data: anthropicStatus, isLoading: isStatusLoading } =
		chatServiceTrpc.auth.getAnthropicStatus.useQuery();

	const isLoading = isOnboardingLoading || isStatusLoading;

	useEffect(() => {
		if (isLoading) return;

		const isProviderReady =
			onboardingState?.providerOnboardingCompleted ||
			anthropicStatus?.authenticated;

		if (isProviderReady) {
			navigate({ to: "/select-repository", replace: true });
		} else {
			navigate({ to: "/connect-provider", replace: true });
		}
	}, [isLoading, onboardingState, anthropicStatus, navigate]);

	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
		</div>
	);
}
