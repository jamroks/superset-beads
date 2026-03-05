import { Button } from "@superset/ui/button";
import { XIcon } from "lucide-react";
import { LinearIcon } from "renderer/components/icons/LinearIcon";
import { useTabsStore } from "renderer/stores/tabs/store";

interface LinkedIssuePillProps {
	slug: string;
	title: string;
	workspaceId: string;
	onRemove: () => void;
}

export function LinkedIssuePill({
	slug,
	title,
	workspaceId,
	onRemove,
}: LinkedIssuePillProps) {
	const addTaskViewerPane = useTabsStore((s) => s.addTaskViewerPane);

	const openTask = () => {
		addTaskViewerPane(workspaceId, slug);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: Contains nested interactive elements
		<div
			role="button"
			tabIndex={0}
			title={title}
			className="group relative flex h-8 cursor-pointer select-none items-center gap-1.5 rounded-md border border-border px-1.5 font-medium text-sm transition-all hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
			onClick={openTask}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					openTask();
				}
			}}
		>
			<div className="relative size-5 shrink-0">
				<div className="absolute inset-0 flex size-5 items-center justify-center overflow-hidden rounded transition-opacity group-hover:opacity-0">
					<LinearIcon className="size-5 rounded" />
				</div>
				<Button
					aria-label="Remove linked issue"
					className="pointer-events-none absolute inset-0 size-5 cursor-pointer rounded p-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [&>svg]:size-2.5"
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
					type="button"
					variant="ghost"
				>
					<XIcon />
					<span className="sr-only">Remove</span>
				</Button>
			</div>
			<span className="shrink-0 font-semibold">{slug}</span>
			<span className="text-muted-foreground text-xs">LINEAR</span>
		</div>
	);
}
