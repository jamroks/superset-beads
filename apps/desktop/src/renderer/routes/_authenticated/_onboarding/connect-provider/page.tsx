import { Button } from "@superset/ui/button";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { SupersetLogo } from "renderer/routes/sign-in/components/SupersetLogo";
import { ProviderSelector } from "./components/ProviderSelector";
import type { AuthMethod, Provider } from "./constants";

export const Route = createFileRoute(
	"/_authenticated/_onboarding/connect-provider/",
)({
	component: ConnectProviderPage,
});

function ConnectProviderPage() {
	const navigate = useNavigate();
	const [provider, setProvider] = useState<Provider>("claude-code");
	const [authMethod, setAuthMethod] = useState<AuthMethod>("oauth");

	const setOnboarding = electronTrpc.uiState.onboarding.set.useMutation();

	const handleContinue = async () => {
		await setOnboarding.mutateAsync({
			selectedProvider: provider,
			selectedAuthMethod: authMethod,
		});
		navigate({
			to: "/connect-claude",
			search: { method: authMethod, provider },
			replace: true,
		});
	};

	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="w-full max-w-md px-6 flex flex-col items-center">
				<SupersetLogo className="h-8 w-auto mb-8 opacity-80" />

				<div className="mb-6 text-center">
					<h1 className="text-2xl font-semibold">Connect AI Provider</h1>
					<p className="text-sm text-muted-foreground mt-2">
						Choose how you'd like to connect your provider.
					</p>
				</div>

				<ProviderSelector
					provider={provider}
					authMethod={authMethod}
					onProviderChange={(p) => {
						setProvider(p);
						// Reset auth method to first available for the new provider
						setAuthMethod(p === "codex" ? "api-key" : "oauth");
					}}
					onAuthMethodChange={setAuthMethod}
				/>

				<Button
					className="w-full mt-6"
					onClick={handleContinue}
					disabled={setOnboarding.isPending}
				>
					Continue
				</Button>
			</div>
		</div>
	);
}
