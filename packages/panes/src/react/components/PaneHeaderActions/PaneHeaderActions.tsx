import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import type { PaneActionConfig, RendererContext } from "../../types";

export function PaneHeaderActions<TData>({
	actions,
	context,
}: {
	actions: PaneActionConfig<TData>[];
	context: RendererContext<TData>;
}) {
	return (
		<div className="flex shrink-0 items-center gap-0.5">
			{actions.map((action, _index) => {
				const icon =
					typeof action.icon === "function"
						? action.icon(context)
						: action.icon;
				const tooltip =
					typeof action.tooltip === "function"
						? action.tooltip(context)
						: action.tooltip;

				return (
					<Tooltip key={action.key}>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => action.onClick(context)}
								className="rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
							>
								{icon}
							</button>
						</TooltipTrigger>
						<TooltipContent side="bottom" showArrow={false}>
							{tooltip}
						</TooltipContent>
					</Tooltip>
				);
			})}
		</div>
	);
}
