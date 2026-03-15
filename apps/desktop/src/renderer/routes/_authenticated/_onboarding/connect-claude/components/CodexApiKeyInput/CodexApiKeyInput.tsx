import { chatServiceTrpc } from "@superset/chat/client";
import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { Label } from "@superset/ui/label";
import { useState } from "react";

interface CodexApiKeyInputProps {
	onSuccess: () => void;
}

export function CodexApiKeyInput({ onSuccess }: CodexApiKeyInputProps) {
	const [apiKey, setApiKey] = useState("");
	const [error, setError] = useState<string | null>(null);

	const setOpenAIApiKeyMutation =
		chatServiceTrpc.auth.setOpenAIApiKey.useMutation();

	const handleSubmit = async () => {
		const trimmed = apiKey.trim();
		if (!trimmed) return;
		setError(null);

		try {
			await setOpenAIApiKeyMutation.mutateAsync({ apiKey: trimmed });
			onSuccess();
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to save OpenAI API key",
			);
		}
	};

	const errorId = "openai-api-key-error";

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="openai-api-key">OpenAI API Key</Label>
				<Input
					id="openai-api-key"
					type="password"
					value={apiKey}
					onChange={(e) => setApiKey(e.target.value)}
					placeholder="sk-..."
					onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
					disabled={setOpenAIApiKeyMutation.isPending}
					aria-invalid={Boolean(error)}
					aria-describedby={error ? errorId : undefined}
				/>
			</div>
			{error && (
				<p id={errorId} role="alert" className="text-destructive text-sm">
					{error}
				</p>
			)}
			<Button
				className="w-full"
				onClick={handleSubmit}
				disabled={!apiKey.trim() || setOpenAIApiKeyMutation.isPending}
			>
				{setOpenAIApiKeyMutation.isPending ? "Saving..." : "Save settings"}
			</Button>
		</div>
	);
}
