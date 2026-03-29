"use client";

import {
	PromptInput,
	PromptInputAttachment,
	PromptInputAttachments,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from "@superset/ui/ai-elements/prompt-input";
import { ArrowUpIcon } from "lucide-react";
import {
	AGENTS_WEB_PREVIEW_MESSAGE,
	MAX_FILE_SIZE,
	MAX_FILES,
} from "../../constants";
import { PlusMenu } from "../PlusMenu";
import { BranchSelector } from "./components/BranchSelector";
import { ModelPicker } from "./components/ModelPicker";
import { RepoSelector } from "./components/RepoSelector";
import { useAgentPrompt } from "./hooks/useAgentPrompt";

export function AgentPromptInput() {
	const isPreview = true;
	const {
		selectedModel,
		setSelectedModel,
		selectedRepo,
		setSelectedRepo,
		selectedBranch,
		setSelectedBranch,
		handleSubmit,
	} = useAgentPrompt();

	return (
		<div className="flex flex-col overflow-hidden rounded-[13px] border-[0.5px] border-border bg-foreground/[0.02]">
			<PromptInput
				onSubmit={handleSubmit}
				className="[&>[data-slot=input-group]]:rounded-none [&>[data-slot=input-group]]:border-none [&>[data-slot=input-group]]:shadow-none"
				multiple
				maxFiles={MAX_FILES}
				maxFileSize={MAX_FILE_SIZE}
			>
				<PromptInputAttachments>
					{(file) => <PromptInputAttachment key={file.id} data={file} />}
				</PromptInputAttachments>
				<PromptInputTextarea
					disabled={isPreview}
					placeholder="Session creation on web is coming soon"
					className="min-h-10"
				/>
				<PromptInputFooter>
					<PromptInputTools className="gap-1.5">
						<ModelPicker
							selectedModel={selectedModel}
							onModelChange={setSelectedModel}
							disabled={isPreview}
						/>
					</PromptInputTools>
					<div className="flex items-center gap-2">
						<PlusMenu disabled={isPreview} />
						<PromptInputSubmit
							disabled={isPreview}
							className="size-[23px] rounded-full border border-transparent bg-foreground/10 p-[5px] shadow-none hover:bg-foreground/20"
						>
							<ArrowUpIcon className="size-3.5 text-muted-foreground" />
						</PromptInputSubmit>
					</div>
				</PromptInputFooter>
			</PromptInput>
			<div className="flex items-center gap-2 border-t border-border/50 px-3 py-2">
				<RepoSelector
					selectedRepo={selectedRepo}
					onRepoChange={setSelectedRepo}
					disabled={isPreview}
				/>
				<BranchSelector
					selectedBranch={selectedBranch}
					onBranchChange={setSelectedBranch}
					disabled={isPreview}
				/>
			</div>
			<p className="border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
				{AGENTS_WEB_PREVIEW_MESSAGE}
			</p>
		</div>
	);
}
