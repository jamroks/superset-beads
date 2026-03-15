import { chatServiceTrpc } from "@superset/chat/client";
import { Button } from "@superset/ui/button";
import { Label } from "@superset/ui/label";
import { Textarea } from "@superset/ui/textarea";
import { useEffect, useState } from "react";

interface ApiKeyInputProps {
	onSuccess: () => void;
}

export function ApiKeyInput({ onSuccess }: ApiKeyInputProps) {
	const [envText, setEnvText] = useState("");
	const [error, setError] = useState<string | null>(null);

	const { data: envConfig } =
		chatServiceTrpc.auth.getAnthropicEnvConfig.useQuery();
	const setEnvConfigMutation =
		chatServiceTrpc.auth.setAnthropicEnvConfig.useMutation();

	useEffect(() => {
		if (envConfig?.envText) {
			setEnvText(envConfig.envText);
		}
	}, [envConfig?.envText]);

	const handleSubmit = async () => {
		if (!envText.trim()) return;
		setError(null);

		try {
			await setEnvConfigMutation.mutateAsync({ envText: envText.trim() });
			onSuccess();
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to save Anthropic settings",
			);
		}
	};

	const errorId = "anthropic-env-error";

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="anthropic-env-block">Environment variables</Label>
				<Textarea
					id="anthropic-env-block"
					value={envText}
					onChange={(e) => setEnvText(e.target.value)}
					placeholder={
						"ANTHROPIC_API_KEY=sk-ant-...\nCLAUDE_CODE_USE_BEDROCK=1\nAWS_REGION=us-east-1\nAWS_PROFILE=default"
					}
					disabled={setEnvConfigMutation.isPending}
					aria-invalid={Boolean(error)}
					aria-describedby={error ? errorId : undefined}
					className="min-h-24 min-w-0 w-full max-w-full max-h-44 field-sizing-fixed resize-y font-mono text-xs"
				/>
				<p className="text-muted-foreground text-xs">
					One per line, format: VAR_NAME=value or export VAR_NAME=value.
				</p>
			</div>
			{error && (
				<p id={errorId} role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}
			<Button
				className="w-full"
				onClick={handleSubmit}
				disabled={!envText.trim() || setEnvConfigMutation.isPending}
			>
				{setEnvConfigMutation.isPending ? "Saving..." : "Save settings"}
			</Button>
		</div>
	);
}
