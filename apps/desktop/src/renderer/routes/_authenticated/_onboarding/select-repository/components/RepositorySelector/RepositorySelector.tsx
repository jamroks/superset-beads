import { Button } from "@superset/ui/button";
import { LuFolderOpen, LuGithub } from "react-icons/lu";

interface RepositorySelectorProps {
	onSelectFolder: () => void;
	onCloneFromGitHub: () => void;
	isPending: boolean;
}

export function RepositorySelector({
	onSelectFolder,
	onCloneFromGitHub,
	isPending,
}: RepositorySelectorProps) {
	return (
		<div className="space-y-3 w-full">
			<Button
				className="w-full gap-2"
				onClick={onSelectFolder}
				disabled={isPending}
			>
				<LuFolderOpen className="h-4 w-4" />
				Select folder
			</Button>
			<Button
				variant="outline"
				className="w-full gap-2"
				onClick={onCloneFromGitHub}
				disabled={isPending}
			>
				<LuGithub className="h-4 w-4" />
				Clone from GitHub
			</Button>
		</div>
	);
}
