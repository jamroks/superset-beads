import { ColumnsIcon, XIcon } from "lucide-react";
import type { PaneActionConfig } from "../../../../../../types";

export function getDefaultPaneActions<TData>(): PaneActionConfig<TData>[] {
	return [
		{
			key: "split",
			icon: <ColumnsIcon className="size-3.5" />,
			tooltip: "Split pane",
			onClick: (ctx) =>
				ctx.actions.splitRight({ kind: ctx.pane.kind, data: ctx.pane.data }),
		},
		{
			key: "close",
			icon: <XIcon className="size-3.5" />,
			tooltip: "Close pane",
			onClick: (ctx) => ctx.actions.close(),
		},
	];
}
