import { Badge } from "@superset/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@superset/ui/popover";
import { useState } from "react";
import { useCollections } from "renderer/routes/_authenticated/providers/CollectionsProvider";
import type { TaskWithStatus } from "../../../../../components/TasksView/hooks/useTasksTable";

interface LabelsPropertyProps {
	task: TaskWithStatus;
}

export function LabelsProperty({ task }: LabelsPropertyProps) {
	const collections = useCollections();
	const [open, setOpen] = useState(false);
	const [inputValue, setInputValue] = useState("");

	const labels = task.labels ?? [];

	const handleAddLabel = () => {
		const trimmed = inputValue.trim();
		if (!trimmed || labels.includes(trimmed)) {
			setInputValue("");
			return;
		}

		try {
			collections.tasks.update(task.id, (draft) => {
				draft.labels = [...(draft.labels ?? []), trimmed];
			});
			setInputValue("");
		} catch (error) {
			console.error("[LabelsProperty] Failed to add label:", error);
		}
	};

	const handleRemoveLabel = (labelToRemove: string) => {
		try {
			collections.tasks.update(task.id, (draft) => {
				draft.labels = (draft.labels ?? []).filter((l) => l !== labelToRemove);
			});
		} catch (error) {
			console.error("[LabelsProperty] Failed to remove label:", error);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleAddLabel();
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<span className="text-xs text-muted-foreground">Labels</span>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button
						type="button"
						className="flex flex-wrap items-center gap-1 hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors w-full min-h-[28px] text-left"
					>
						{labels.length > 0 ? (
							labels.map((label) => (
								<Badge key={label} variant="outline" className="text-xs">
									{label}
								</Badge>
							))
						) : (
							<span className="text-sm text-muted-foreground">No labels</span>
						)}
					</button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-56 p-2">
					<div className="space-y-2">
						<div className="flex gap-1">
							<input
								type="text"
								value={inputValue}
								onChange={(e) => setInputValue(e.target.value)}
								onKeyDown={handleKeyDown}
								placeholder="Add label..."
								className="flex-1 bg-transparent border border-border rounded px-2 py-1 text-sm outline-none focus:border-muted-foreground/50"
							/>
							<button
								type="button"
								onClick={handleAddLabel}
								disabled={!inputValue.trim()}
								className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
							>
								Add
							</button>
						</div>
						{labels.length > 0 && (
							<div className="flex flex-wrap gap-1 pt-1">
								{labels.map((label) => (
									<Badge
										key={label}
										variant="outline"
										className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
										onClick={() => handleRemoveLabel(label)}
									>
										{label} ×
									</Badge>
								))}
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
}
