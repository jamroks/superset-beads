import { Button } from "@superset/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@superset/ui/tooltip";
import {
	type FileTreeNode,
	useFileTree,
	useWorkspaceFsEventBridge,
	useWorkspaceFsEvents,
	workspaceTrpc,
} from "@superset/workspace-client";
import { FilePlus, FolderPlus, RefreshCw, Shrink } from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import {
	ROW_HEIGHT,
	TREE_INDENT,
} from "renderer/screens/main/components/WorkspaceView/RightSidebar/FilesView/constants";
import { NewItemInput } from "./components/NewItemInput";
import { WorkspaceFilesTreeItem } from "./components/WorkspaceFilesTreeItem";

const STICKY_SHADOW =
	"0 1px 0 0 color-mix(in srgb, currentColor 8%, transparent)";

type CreatingState = { mode: "file" | "folder"; parentPath: string } | null;

interface FilesTabProps {
	onSelectFile: (absolutePath: string) => void;
	selectedFilePath?: string;
	workspaceId: string;
	workspaceName?: string;
}

function TreeNode({
	node,
	depth,
	indent,
	rowHeight,
	selectedFilePath,
	hoveredPath,
	creating,
	onSelectFile,
	onToggleDirectory,
	onNewItemSubmit,
	onNewItemCancel,
	onNewFile,
	onNewFolder,
}: {
	node: FileTreeNode;
	depth: number;
	indent: number;
	rowHeight: number;
	selectedFilePath?: string;
	hoveredPath?: string | null;
	creating: CreatingState;
	onSelectFile: (absolutePath: string) => void;
	onToggleDirectory: (absolutePath: string) => void;
	onNewItemSubmit: (name: string) => void;
	onNewItemCancel: () => void;
	onNewFile: (parentPath: string) => void;
	onNewFolder: (parentPath: string) => void;
}) {
	const isCreatingHere = creating?.parentPath === node.absolutePath;
	const isCreatingFile = isCreatingHere && creating?.mode === "file";
	const lastFolderIndex = node.children.findLastIndex(
		(n) => n.kind === "directory",
	);

	return (
		<div>
			<WorkspaceFilesTreeItem
				node={node}
				depth={depth}
				indent={indent}
				rowHeight={rowHeight}
				selectedFilePath={selectedFilePath}
				isHovered={hoveredPath === node.absolutePath}
				onSelectFile={onSelectFile}
				onToggleDirectory={onToggleDirectory}
				onNewFile={onNewFile}
				onNewFolder={onNewFolder}
			/>
			{node.kind === "directory" && node.isExpanded && (
				<>
					{isCreatingHere && creating.mode === "folder" && (
						<NewItemInput
							mode="folder"
							depth={depth + 1}
							indent={indent}
							rowHeight={rowHeight}
							onSubmit={onNewItemSubmit}
							onCancel={onNewItemCancel}
						/>
					)}
					{node.children.map((child, index) => (
						<Fragment key={child.absolutePath}>
							<TreeNode
								node={child}
								depth={depth + 1}
								indent={indent}
								rowHeight={rowHeight}
								selectedFilePath={selectedFilePath}
								hoveredPath={hoveredPath}
								creating={creating}
								onSelectFile={onSelectFile}
								onToggleDirectory={onToggleDirectory}
								onNewItemSubmit={onNewItemSubmit}
								onNewItemCancel={onNewItemCancel}
								onNewFile={onNewFile}
								onNewFolder={onNewFolder}
							/>
							{isCreatingFile && index === lastFolderIndex && (
								<NewItemInput
									mode="file"
									depth={depth + 1}
									indent={indent}
									rowHeight={rowHeight}
									onSubmit={onNewItemSubmit}
									onCancel={onNewItemCancel}
								/>
							)}
						</Fragment>
					))}
					{isCreatingFile && lastFolderIndex === -1 && (
						<NewItemInput
							mode="file"
							depth={depth + 1}
							indent={indent}
							rowHeight={rowHeight}
							onSubmit={onNewItemSubmit}
							onCancel={onNewItemCancel}
						/>
					)}
				</>
			)}
		</div>
	);
}

export function FilesTab({
	onSelectFile,
	selectedFilePath,
	workspaceId,
	workspaceName,
}: FilesTabProps) {
	const [_isRefreshing, setIsRefreshing] = useState(false);
	const [hoveredPath, setHoveredPath] = useState<string | null>(null);
	const [creating, setCreating] = useState<CreatingState>(null);
	const utils = workspaceTrpc.useUtils();
	const workspaceQuery = workspaceTrpc.workspace.get.useQuery({
		id: workspaceId,
	});
	const rootPath = workspaceQuery.data?.worktreePath ?? "";

	const writeFile = workspaceTrpc.filesystem.writeFile.useMutation();
	const createDirectory =
		workspaceTrpc.filesystem.createDirectory.useMutation();

	useWorkspaceFsEventBridge(
		workspaceId,
		Boolean(workspaceId && workspaceQuery.data?.worktreePath),
	);

	const fileTree = useFileTree({ workspaceId, rootPath });

	useWorkspaceFsEvents(
		workspaceId,
		() => void utils.filesystem.searchFiles.invalidate(),
		Boolean(workspaceId),
	);

	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const lastMousePos = useRef<{ x: number; y: number } | null>(null);
	const prevSelectedRef = useRef(selectedFilePath);
	const lastStickyRef = useRef<Element | null>(null);

	const updateHoverFromPoint = useCallback((x: number, y: number) => {
		const el = document.elementFromPoint(x, y)?.closest("[data-filepath]");
		setHoveredPath(el?.getAttribute("data-filepath") ?? null);
	}, []);

	const updateStickyShadow = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		const scrollTop = container.scrollTop;
		const containerRect = container.getBoundingClientRect();
		const folders = container.querySelectorAll<HTMLElement>(
			"[data-sticky-depth]",
		);

		let deepest: HTMLElement | null = null;
		let deepestTop = -1;

		for (const el of folders) {
			const depth = Number(el.dataset.stickyDepth);
			const stickyTop = depth * ROW_HEIGHT;
			const naturalTop = el.offsetTop - scrollTop;
			const isStuck =
				naturalTop < stickyTop + 1 &&
				el.getBoundingClientRect().top - containerRect.top <= stickyTop + 1;
			if (isStuck && stickyTop > deepestTop) {
				deepestTop = stickyTop;
				deepest = el;
			}
		}

		if (lastStickyRef.current !== deepest) {
			if (lastStickyRef.current instanceof HTMLElement)
				lastStickyRef.current.style.boxShadow = "";
			if (deepest) deepest.style.boxShadow = STICKY_SHADOW;
			lastStickyRef.current = deepest;
		}
	}, []);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent) => {
			lastMousePos.current = { x: e.clientX, y: e.clientY };
			updateHoverFromPoint(e.clientX, e.clientY);
		},
		[updateHoverFromPoint],
	);

	const handleScroll = useCallback(() => {
		if (lastMousePos.current)
			updateHoverFromPoint(lastMousePos.current.x, lastMousePos.current.y);
		updateStickyShadow();
	}, [updateHoverFromPoint, updateStickyShadow]);

	const handleMouseLeave = useCallback(() => {
		lastMousePos.current = null;
		setHoveredPath(null);
	}, []);

	useEffect(() => {
		if (
			selectedFilePath &&
			selectedFilePath !== prevSelectedRef.current &&
			rootPath
		) {
			void fileTree.reveal(selectedFilePath).then(() => {
				requestAnimationFrame(() => {
					scrollContainerRef.current
						?.querySelector(`[data-filepath="${CSS.escape(selectedFilePath)}"]`)
						?.scrollIntoView({ block: "center" });
				});
			});
		}
		prevSelectedRef.current = selectedFilePath;
	}, [selectedFilePath, rootPath, fileTree]);

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await fileTree.refreshAll();
		} finally {
			setIsRefreshing(false);
		}
	}, [fileTree]);

	// --- Inline creation ---

	const getParentForCreation = useCallback((): string => {
		if (!selectedFilePath || !rootPath) return rootPath;
		// Walk tree to check if selected is a directory
		function isDirectory(nodes: FileTreeNode[]): boolean {
			for (const n of nodes) {
				if (n.absolutePath === selectedFilePath) return n.kind === "directory";
				if (n.children.length > 0 && isDirectory(n.children)) return true;
			}
			return false;
		}
		if (isDirectory(fileTree.rootEntries)) return selectedFilePath;
		const lastSlash = selectedFilePath.lastIndexOf("/");
		return lastSlash > 0 ? selectedFilePath.slice(0, lastSlash) : rootPath;
	}, [selectedFilePath, rootPath, fileTree.rootEntries]);

	const startCreating = useCallback(
		async (mode: "file" | "folder", targetPath?: string) => {
			const parentPath = targetPath ?? getParentForCreation();
			if (parentPath !== rootPath) await fileTree.expand(parentPath);
			setCreating({ mode, parentPath });
			requestAnimationFrame(() => {
				scrollContainerRef.current
					?.querySelector("[data-new-item-input]")
					?.scrollIntoView({ block: "nearest" });
			});
		},
		[getParentForCreation, rootPath, fileTree],
	);

	const handleNewItemSubmit = useCallback(
		async (name: string) => {
			if (!creating || !rootPath) return;
			const { mode, parentPath } = creating;
			const segments = name.split("/").filter(Boolean);
			if (segments.length === 0) return;

			const absolutePath = `${parentPath}/${name}`;

			try {
				if (mode === "folder") {
					await createDirectory.mutateAsync({
						workspaceId,
						absolutePath,
						recursive: true,
					});
				} else {
					if (segments.length > 1) {
						const dirPath = `${parentPath}/${segments.slice(0, -1).join("/")}`;
						await createDirectory.mutateAsync({
							workspaceId,
							absolutePath: dirPath,
							recursive: true,
						});
					}
					await writeFile.mutateAsync({
						workspaceId,
						absolutePath,
						content: "",
						options: { create: true, overwrite: false },
					});
					onSelectFile(absolutePath);
				}
			} catch {
				// TODO: error toast
			}
			setCreating(null);
		},
		[creating, rootPath, workspaceId, writeFile, createDirectory, onSelectFile],
	);

	const handleNewItemCancel = useCallback(() => setCreating(null), []);

	// --- Render ---

	if (workspaceQuery.isPending) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Loading workspace files...
			</div>
		);
	}

	if (!workspaceQuery.data?.worktreePath) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				Workspace worktree not available
			</div>
		);
	}

	const isCreatingAtRoot = creating?.parentPath === rootPath;
	const isCreatingFileAtRoot = isCreatingAtRoot && creating?.mode === "file";
	const isCreatingFolderAtRoot =
		isCreatingAtRoot && creating?.mode === "folder";
	const rootLastFolderIndex = fileTree.rootEntries.findLastIndex(
		(n) => n.kind === "directory",
	);

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: mouse tracking for hover state */}
			<div
				ref={scrollContainerRef}
				className="min-h-0 flex-1 overflow-y-auto"
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
				onScroll={handleScroll}
			>
				<div
					className="group flex items-center justify-between bg-background px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
					style={{
						height: ROW_HEIGHT,
						position: "sticky",
						top: 0,
						zIndex: 20,
					}}
				>
					<span className="truncate">{workspaceName ?? "Explorer"}</span>
					<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-5"
									onClick={() => void startCreating("file")}
								>
									<FilePlus className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">New File</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-5"
									onClick={() => void startCreating("folder")}
								>
									<FolderPlus className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">New Folder</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-5"
									onClick={() => void handleRefresh()}
								>
									<RefreshCw className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">Refresh</TooltipContent>
						</Tooltip>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="size-5"
									onClick={fileTree.collapseAll}
								>
									<Shrink className="size-3" />
								</Button>
							</TooltipTrigger>
							<TooltipContent side="bottom">Collapse All</TooltipContent>
						</Tooltip>
					</div>
				</div>

				{fileTree.isLoadingRoot && fileTree.rootEntries.length === 0 ? (
					<div className="px-2 py-3 text-sm text-muted-foreground">
						Loading files...
					</div>
				) : fileTree.rootEntries.length === 0 && !isCreatingAtRoot ? (
					<div className="px-2 py-3 text-sm text-muted-foreground">
						No files found
					</div>
				) : (
					<>
						{isCreatingFolderAtRoot && (
							<NewItemInput
								mode="folder"
								depth={1}
								indent={TREE_INDENT}
								rowHeight={ROW_HEIGHT}
								onSubmit={handleNewItemSubmit}
								onCancel={handleNewItemCancel}
							/>
						)}
						{fileTree.rootEntries.map((node, index) => (
							<Fragment key={node.absolutePath}>
								<TreeNode
									node={node}
									depth={1}
									indent={TREE_INDENT}
									rowHeight={ROW_HEIGHT}
									selectedFilePath={selectedFilePath}
									hoveredPath={hoveredPath}
									creating={creating}
									onSelectFile={onSelectFile}
									onToggleDirectory={(absolutePath) =>
										void fileTree.toggle(absolutePath)
									}
									onNewItemSubmit={handleNewItemSubmit}
									onNewItemCancel={handleNewItemCancel}
									onNewFile={(parentPath) =>
										void startCreating("file", parentPath)
									}
									onNewFolder={(parentPath) =>
										void startCreating("folder", parentPath)
									}
								/>
								{isCreatingFileAtRoot && index === rootLastFolderIndex && (
									<NewItemInput
										mode="file"
										depth={1}
										indent={TREE_INDENT}
										rowHeight={ROW_HEIGHT}
										onSubmit={handleNewItemSubmit}
										onCancel={handleNewItemCancel}
									/>
								)}
							</Fragment>
						))}
						{isCreatingFileAtRoot && rootLastFolderIndex === -1 && (
							<NewItemInput
								mode="file"
								depth={1}
								indent={TREE_INDENT}
								rowHeight={ROW_HEIGHT}
								onSubmit={handleNewItemSubmit}
								onCancel={handleNewItemCancel}
							/>
						)}
					</>
				)}
			</div>
		</div>
	);
}
