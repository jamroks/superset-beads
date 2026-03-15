import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useOpenProject } from "renderer/react-query/projects";
import { SupersetLogo } from "renderer/routes/sign-in/components/SupersetLogo";
import { RepositorySelector } from "./components/RepositorySelector";

export const Route = createFileRoute(
	"/_authenticated/_onboarding/select-repository/",
)({
	component: SelectRepositoryPage,
});

function SelectRepositoryPage() {
	const navigate = useNavigate();
	const { openNew, isPending } = useOpenProject();

	const handleSelectFolder = async () => {
		const projects = await openNew();
		const firstProjectId = projects[0]?.id;
		if (firstProjectId) {
			navigate({
				to: "/project/$projectId",
				params: { projectId: firstProjectId },
				replace: true,
			});
		}
	};

	const handleCloneFromGitHub = () => {
		navigate({ to: "/new-project", replace: true });
	};

	return (
		<div className="flex flex-1 items-center justify-center">
			<div className="w-full max-w-md px-6 flex flex-col items-center">
				<SupersetLogo className="h-8 w-auto mb-8 opacity-80" />

				<div className="text-center mb-8">
					<h1 className="text-2xl font-semibold">Select a repository</h1>
					<p className="text-sm text-muted-foreground mt-2">
						Choose a local folder to start working with.
					</p>
				</div>

				<RepositorySelector
					onSelectFolder={handleSelectFolder}
					onCloneFromGitHub={handleCloneFromGitHub}
					isPending={isPending}
				/>
			</div>
		</div>
	);
}
