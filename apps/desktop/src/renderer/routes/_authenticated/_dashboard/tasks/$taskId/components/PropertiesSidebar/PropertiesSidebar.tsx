import { ScrollArea } from "@superset/ui/scroll-area";
import type { TaskWithStatus } from "../../../components/TasksView/hooks/useTasksTable";
import { AssigneeProperty } from "./components/AssigneeProperty";
import { LabelsProperty } from "./components/LabelsProperty";
import { OpenInWorkspace } from "./components/OpenInWorkspace";
import { PriorityProperty } from "./components/PriorityProperty";
import { StatusProperty } from "./components/StatusProperty";

interface PropertiesSidebarProps {
	task: TaskWithStatus;
}

export function PropertiesSidebar({ task }: PropertiesSidebarProps) {
	return (
		<div className="w-64 border-l border-border shrink-0">
			<ScrollArea className="h-full">
				<div className="p-4 space-y-6">
					<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
						Properties
					</h3>

					<div className="space-y-3">
						<StatusProperty task={task} />
						<PriorityProperty task={task} />
						<AssigneeProperty task={task} />
					</div>

					<LabelsProperty task={task} />

					<OpenInWorkspace task={task} />
				</div>
			</ScrollArea>
		</div>
	);
}
