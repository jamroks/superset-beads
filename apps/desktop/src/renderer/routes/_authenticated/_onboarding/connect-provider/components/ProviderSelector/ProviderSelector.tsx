import { cn } from "@superset/ui/utils";
import {
	type AuthMethod,
	CLAUDE_AUTH_METHOD_OPTIONS,
	CODEX_AUTH_METHOD_OPTIONS,
	type Provider,
} from "../../constants";

interface ProviderSelectorProps {
	provider: Provider;
	authMethod: AuthMethod;
	onProviderChange: (provider: Provider) => void;
	onAuthMethodChange: (method: AuthMethod) => void;
}

export function ProviderSelector({
	provider,
	authMethod,
	onProviderChange,
	onAuthMethodChange,
}: ProviderSelectorProps) {
	const options =
		provider === "codex"
			? CODEX_AUTH_METHOD_OPTIONS
			: CLAUDE_AUTH_METHOD_OPTIONS;

	return (
		<div className="w-full space-y-4">
			{/* Provider toggle */}
			<div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
				<button
					type="button"
					onClick={() => onProviderChange("claude-code")}
					className={cn(
						"flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all",
						provider === "claude-code"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					Claude Code
				</button>
				<button
					type="button"
					onClick={() => onProviderChange("codex")}
					className={cn(
						"flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all",
						provider === "codex"
							? "bg-background text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					Codex
				</button>
			</div>

			{/* Auth method options */}
			<div className="space-y-2">
				{options.map((option) => {
					const isSelected = authMethod === option.id;
					return (
						<button
							key={option.id}
							type="button"
							onClick={() => onAuthMethodChange(option.id)}
							className={cn(
								"w-full flex items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-all",
								isSelected
									? "border-primary/50 bg-primary/5"
									: "border-border/60 hover:border-border hover:bg-muted/30",
							)}
						>
							<div
								className={cn(
									"mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[1.5px] transition-all",
									isSelected
										? "border-primary bg-primary"
										: "border-muted-foreground/30",
								)}
							>
								{isSelected && (
									<div className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
								)}
							</div>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium">{option.label}</span>
									{option.badge && (
										<span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
											{option.badge}
										</span>
									)}
								</div>
								<p className="text-xs text-muted-foreground mt-0.5">
									{option.description}
								</p>
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
