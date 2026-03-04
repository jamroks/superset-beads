import {
	MAX_SIDEBAR_WIDTH,
	MIN_SIDEBAR_WIDTH,
	SidebarMode,
	useSidebarStore,
} from "renderer/stores/sidebar-state";
import { shallow } from "zustand/shallow";
import { ResizablePanel } from "../../ResizablePanel";
import { ChangesContent, ScrollProvider } from "../ChangesContent";
import { ContentView } from "../ContentView";
import { useBrowserLifecycle } from "../hooks/useBrowserLifecycle";
import { RightSidebar } from "../RightSidebar";

export function WorkspaceLayout() {
	useBrowserLifecycle();
	const {
		isSidebarOpen,
		sidebarWidth,
		setSidebarWidth,
		isResizing,
		setIsResizing,
		currentMode,
	} = useSidebarStore(
		(s) => ({
			isSidebarOpen: s.isSidebarOpen,
			sidebarWidth: s.sidebarWidth,
			setSidebarWidth: s.setSidebarWidth,
			isResizing: s.isResizing,
			setIsResizing: s.setIsResizing,
			currentMode: s.currentMode,
		}),
		shallow,
	);

	const isExpanded = currentMode === SidebarMode.Changes;

	return (
		<ScrollProvider>
			<div className="flex-1 min-w-0 overflow-hidden">
				{isExpanded ? <ChangesContent /> : <ContentView />}
			</div>
			{isSidebarOpen && (
				<ResizablePanel
					width={sidebarWidth}
					onWidthChange={setSidebarWidth}
					isResizing={isResizing}
					onResizingChange={setIsResizing}
					minWidth={MIN_SIDEBAR_WIDTH}
					maxWidth={MAX_SIDEBAR_WIDTH}
					handleSide="left"
					className={isExpanded ? "border-l-0" : undefined}
				>
					<RightSidebar />
				</ResizablePanel>
			)}
		</ScrollProvider>
	);
}
