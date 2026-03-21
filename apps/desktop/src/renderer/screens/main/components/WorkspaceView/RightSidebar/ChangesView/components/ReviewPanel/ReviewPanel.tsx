import type { GitHubStatus, PullRequestComment } from "@superset/local-db";
import { Avatar, AvatarFallback, AvatarImage } from "@superset/ui/avatar";
import { Button } from "@superset/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@superset/ui/collapsible";
import { Skeleton } from "@superset/ui/skeleton";
import { toast } from "@superset/ui/sonner";
import { cn } from "@superset/ui/utils";
import { useEffect, useRef, useState } from "react";
import {
	LuArrowUpRight,
	LuCheck,
	LuCopy,
	LuLoaderCircle,
	LuMessageSquareText,
	LuMinus,
	LuX,
} from "react-icons/lu";
import { VscChevronRight } from "react-icons/vsc";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { PRIcon } from "renderer/screens/main/components/PRIcon";

interface ReviewPanelProps {
	pr: GitHubStatus["pr"] | null;
	comments?: PullRequestComment[];
	isLoading?: boolean;
	isCommentsLoading?: boolean;
}

const reviewDecisionConfig = {
	approved: {
		label: "Approved",
		className:
			"border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
	},
	changes_requested: {
		label: "Changes requested",
		className:
			"border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
	},
	pending: {
		label: "Review pending",
		className:
			"border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
	},
} as const;

const checkIconConfig = {
	success: {
		icon: LuCheck,
		className: "text-emerald-600 dark:text-emerald-400",
		label: "Passed",
	},
	failure: {
		icon: LuX,
		className: "text-red-600 dark:text-red-400",
		label: "Failed",
	},
	pending: {
		icon: LuLoaderCircle,
		className: "text-amber-600 dark:text-amber-400",
		label: "Pending",
	},
	skipped: {
		icon: LuMinus,
		className: "text-muted-foreground",
		label: "Skipped",
	},
	cancelled: {
		icon: LuMinus,
		className: "text-muted-foreground",
		label: "Cancelled",
	},
} as const;

const checkSummaryIconConfig = {
	success: checkIconConfig.success,
	failure: checkIconConfig.failure,
	pending: checkIconConfig.pending,
	none: {
		icon: LuMinus,
		className: "text-muted-foreground",
		label: "No checks",
	},
} as const;

const prStateLabel = {
	open: "Open",
	draft: "Draft",
	merged: "Merged",
	closed: "Closed",
} as const;

function getCheckUrl(
	check: NonNullable<GitHubStatus["pr"]>["checks"][number],
	prUrl: string,
): string | undefined {
	if (check.url) {
		return check.url;
	}

	const normalizedName = check.name.trim().toLowerCase();
	if (
		normalizedName.includes("coderabbit") ||
		normalizedName.includes("code rabbit")
	) {
		return prUrl;
	}

	return undefined;
}

function getCommentPreview(body: string): string {
	return (
		body
			.replace(/<!--[\s\S]*?-->/g, "\n")
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find(Boolean)
			?.replace(/^[-*+>]\s*/, "")
			?.replace(/\s+/g, " ") ?? "No preview available"
	);
}

function getAvatarFallback(authorLogin: string): string {
	return authorLogin.slice(0, 2).toUpperCase();
}

function formatShortAge(timestamp?: number): string | null {
	if (!timestamp || Number.isNaN(timestamp)) {
		return null;
	}

	const deltaMs = Math.max(0, Date.now() - timestamp);
	const deltaSeconds = Math.round(deltaMs / 1000);

	if (deltaSeconds < 60) {
		return `${Math.max(1, deltaSeconds)}s`;
	}

	const deltaMinutes = Math.round(deltaSeconds / 60);
	if (deltaMinutes < 60) {
		return `${deltaMinutes}m`;
	}

	const deltaHours = Math.round(deltaMinutes / 60);
	if (deltaHours < 24) {
		return `${deltaHours}h`;
	}

	return `${Math.round(deltaHours / 24)}d`;
}

function getCommentLocation(comment: PullRequestComment): string | null {
	if (comment.path) {
		return comment.line ? `${comment.path}:${comment.line}` : comment.path;
	}

	return comment.kind === "conversation" ? "Conversation" : null;
}

function getCommentKindLabel(comment: PullRequestComment): string {
	return comment.kind === "review" ? "Review" : "Comment";
}

function formatCommentForClipboard(
	comment: PullRequestComment,
	includeMetadata = false,
): string {
	const body = comment.body.trim() || "No comment body";

	if (!includeMetadata) {
		return body;
	}

	const location = getCommentLocation(comment);
	const metadata = [
		comment.authorLogin,
		getCommentKindLabel(comment),
		location,
	].filter(Boolean);

	return [metadata.join(" • "), body].filter(Boolean).join("\n");
}

function formatAllCommentsForClipboard(comments: PullRequestComment[]): string {
	return comments
		.map((comment) => formatCommentForClipboard(comment, true))
		.join("\n\n---\n\n");
}

export function ReviewPanel({
	pr,
	comments = [],
	isLoading = false,
	isCommentsLoading = false,
}: ReviewPanelProps) {
	const [checksOpen, setChecksOpen] = useState(true);
	const [commentsOpen, setCommentsOpen] = useState(true);
	const [copiedItemKey, setCopiedItemKey] = useState<string | null>(null);
	const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const copyTextMutation = electronTrpc.external.copyText.useMutation();

	useEffect(() => {
		return () => {
			if (copyResetTimerRef.current) {
				clearTimeout(copyResetTimerRef.current);
			}
		};
	}, []);

	const setCopiedState = (key: string) => {
		if (copyResetTimerRef.current) {
			clearTimeout(copyResetTimerRef.current);
		}

		setCopiedItemKey(key);
		copyResetTimerRef.current = setTimeout(() => {
			setCopiedItemKey(null);
			copyResetTimerRef.current = null;
		}, 1500);
	};

	const handleCopyText = async ({
		text,
		key,
		errorLabel,
	}: {
		text: string;
		key: string;
		errorLabel: string;
	}) => {
		try {
			await copyTextMutation.mutateAsync(text);
			setCopiedState(key);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			toast.error(`${errorLabel}: ${message}`);
		}
	};

	const handleCopyComment = (comment: PullRequestComment) => {
		void handleCopyText({
			text: formatCommentForClipboard(comment),
			key: `comment-${comment.id}`,
			errorLabel: "Failed to copy comment",
		});
	};

	const handleCopyAllComments = () => {
		void handleCopyText({
			text: formatAllCommentsForClipboard(comments),
			key: "all-comments",
			errorLabel: "Failed to copy comments",
		});
	};

	if (isLoading && !pr) {
		return (
			<div className="flex h-full flex-col overflow-y-auto px-2 py-2">
				<div className="border-b border-border/70 px-0 pb-2">
					<div className="flex items-center gap-2 px-2">
						<Skeleton className="h-4 w-4 rounded-sm" />
						<Skeleton className="h-4 flex-1" />
						<Skeleton className="h-3 w-10" />
					</div>
					<div className="mt-2 flex items-center gap-2 px-2">
						<Skeleton className="h-4 w-24 rounded-sm" />
						<Skeleton className="h-3 w-28" />
					</div>
				</div>
				<div className="border-b border-border/60 px-0 py-2">
					<div className="flex items-center justify-between px-2 pb-1">
						<Skeleton className="h-3 w-10" />
						<Skeleton className="h-3 w-24" />
					</div>
					<div className="space-y-1 px-1">
						<Skeleton className="h-8 w-full rounded-sm" />
						<Skeleton className="h-8 w-full rounded-sm" />
					</div>
				</div>
				<div className="px-0 py-2">
					<div className="flex items-center justify-between px-2 pb-1">
						<Skeleton className="h-3 w-14" />
						<Skeleton className="h-3 w-6" />
					</div>
					<div className="space-y-1 px-1">
						<Skeleton className="h-11 w-full rounded-sm" />
						<Skeleton className="h-11 w-full rounded-sm" />
						<Skeleton className="h-11 w-full rounded-sm" />
					</div>
				</div>
			</div>
		);
	}

	if (!pr) {
		return (
			<div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
				Open a pull request to view review status, checks, and comments.
			</div>
		);
	}

	const requestedReviewers = pr.requestedReviewers ?? [];
	const reviewLabel =
		pr.reviewDecision === "pending" && requestedReviewers.length > 0
			? `Awaiting ${requestedReviewers.join(", ")}`
			: reviewDecisionConfig[pr.reviewDecision].label;

	const relevantChecks = pr.checks.filter(
		(check) => check.status !== "skipped" && check.status !== "cancelled",
	);
	const passingChecks = relevantChecks.filter(
		(check) => check.status === "success",
	).length;
	const checksSummary =
		relevantChecks.length > 0
			? `${passingChecks}/${relevantChecks.length} checks passing`
			: "No checks reported";
	const checksStatus = relevantChecks.length > 0 ? pr.checksStatus : "none";
	const checksStatusConfig = checkSummaryIconConfig[checksStatus];
	const ChecksStatusIcon = checksStatusConfig.icon;

	return (
		<div className="flex h-full min-h-0 flex-col overflow-y-auto">
			<div className="border-b border-border/70 px-2 py-2">
				<div className="flex items-center gap-1.5">
					<PRIcon state={pr.state} className="size-4 shrink-0" />
					<a
						href={pr.url}
						target="_blank"
						rel="noopener noreferrer"
						className="min-w-0 flex-1 truncate text-xs font-medium text-foreground hover:underline"
						title={pr.title}
					>
						{pr.title}
					</a>
					<span className="shrink-0 font-mono text-[10px] text-muted-foreground">
						#{pr.number}
					</span>
				</div>

				<div className="mt-1.5 flex items-center gap-1.5">
					<span
						className={cn(
							"shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium",
							reviewDecisionConfig[pr.reviewDecision].className,
						)}
					>
						{reviewDecisionConfig[pr.reviewDecision].label}
					</span>
					<span className="truncate text-[10px] text-muted-foreground">
						{requestedReviewers.length > 0
							? reviewLabel
							: prStateLabel[pr.state]}
					</span>
				</div>
			</div>

			<Collapsible open={checksOpen} onOpenChange={setChecksOpen}>
				<CollapsibleTrigger
					className={cn(
						"group flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left min-w-0",
						"hover:bg-accent/30 cursor-pointer transition-colors",
					)}
				>
					<div className="flex min-w-0 items-center gap-1.5">
						<VscChevronRight
							className={cn(
								"size-3 text-muted-foreground shrink-0 transition-transform duration-150",
								checksOpen && "rotate-90",
							)}
						/>
						<span className="text-xs font-medium truncate">Checks</span>
						<span className="text-[10px] text-muted-foreground shrink-0">
							{relevantChecks.length}
						</span>
					</div>
					<div
						className={cn(
							"shrink-0 flex items-center gap-1",
							checksStatusConfig.className,
						)}
					>
						<ChecksStatusIcon
							className={cn(
								"size-3.5 shrink-0",
								checksStatus === "pending" && "animate-spin",
							)}
						/>
						<span className="max-w-[140px] truncate text-[10px] normal-case">
							{checksSummary}
						</span>
					</div>
				</CollapsibleTrigger>
				<CollapsibleContent className="px-0.5 pb-1 min-w-0 overflow-hidden">
					{relevantChecks.length === 0 ? (
						<div className="px-1.5 py-1.5 text-xs text-muted-foreground">
							No active checks reported for this pull request yet.
						</div>
					) : (
						relevantChecks.map((check) => {
							const { icon: CheckIcon, className } =
								checkIconConfig[check.status];
							const checkUrl = getCheckUrl(check, pr.url);

							return checkUrl ? (
								<a
									key={check.name}
									href={checkUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="group block"
								>
									<div className="flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1.5 text-xs transition-colors hover:bg-accent/30">
										<CheckIcon
											className={cn(
												"size-3.5 shrink-0",
												className,
												check.status === "pending" && "animate-spin",
											)}
										/>
										<div className="flex min-w-0 flex-1 items-center gap-1">
											<span className="min-w-0 truncate">{check.name}</span>
											<LuArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
										</div>
										{check.durationText && (
											<span className="shrink-0 text-[10px] text-muted-foreground">
												{check.durationText}
											</span>
										)}
									</div>
								</a>
							) : (
								<div
									key={check.name}
									className="flex min-w-0 items-center gap-1.5 rounded-sm px-1.5 py-1.5 text-xs"
								>
									<CheckIcon
										className={cn(
											"size-3.5 shrink-0",
											className,
											check.status === "pending" && "animate-spin",
										)}
									/>
									<span className="min-w-0 flex-1 truncate">{check.name}</span>
									{check.durationText && (
										<span className="shrink-0 text-[10px] text-muted-foreground">
											{check.durationText}
										</span>
									)}
								</div>
							);
						})
					)}
				</CollapsibleContent>
			</Collapsible>

			<Collapsible
				open={commentsOpen}
				onOpenChange={setCommentsOpen}
				className="flex min-h-0 flex-1 flex-col"
			>
				<div className="group flex min-w-0 items-center">
					<CollapsibleTrigger
						className={cn(
							"flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left",
							"hover:bg-accent/30 cursor-pointer transition-colors",
						)}
					>
						<VscChevronRight
							className={cn(
								"size-3 text-muted-foreground shrink-0 transition-transform duration-150",
								commentsOpen && "rotate-90",
							)}
						/>
						<LuMessageSquareText className="size-3.5 shrink-0 text-muted-foreground" />
						<span className="text-xs font-medium truncate">Comments</span>
						<span className="text-[10px] text-muted-foreground shrink-0">
							{isCommentsLoading ? "..." : comments.length}
						</span>
					</CollapsibleTrigger>
					{comments.length > 0 && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="mr-1 h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								handleCopyAllComments();
							}}
						>
							{copiedItemKey === "all-comments" ? (
								<LuCheck className="size-3" />
							) : (
								<LuCopy className="size-3" />
							)}
							<span>
								{copiedItemKey === "all-comments" ? "Copied" : "Copy all"}
							</span>
						</Button>
					)}
				</div>
				<CollapsibleContent className="min-h-0 flex-1 overflow-hidden">
					<div className="h-full overflow-y-auto px-0.5 py-1">
						{isCommentsLoading ? (
							<div className="space-y-1 px-1">
								<Skeleton className="h-11 w-full rounded-sm" />
								<Skeleton className="h-11 w-full rounded-sm" />
								<Skeleton className="h-11 w-full rounded-sm" />
							</div>
						) : comments.length === 0 ? (
							<div className="px-1.5 py-1.5 text-xs text-muted-foreground">
								No comments yet.
							</div>
						) : (
							comments.map((comment) => {
								const location = getCommentLocation(comment);
								const age = formatShortAge(comment.createdAt);
								const copyKey = `comment-${comment.id}`;
								const isCopied = copiedItemKey === copyKey;
								const content = (
									<>
										<Avatar className="mt-0.5 size-5 shrink-0">
											{comment.avatarUrl ? (
												<AvatarImage
													src={comment.avatarUrl}
													alt={comment.authorLogin}
												/>
											) : null}
											<AvatarFallback className="text-[10px] font-medium">
												{getAvatarFallback(comment.authorLogin)}
											</AvatarFallback>
										</Avatar>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-1.5">
												<span className="truncate text-xs font-medium text-foreground">
													{comment.authorLogin}
												</span>
												<span className="shrink-0 rounded border border-border/70 bg-muted/35 px-1 py-0 text-[9px] uppercase tracking-wide text-muted-foreground">
													{getCommentKindLabel(comment)}
												</span>
												{age && (
													<span className="shrink-0 text-[10px] text-muted-foreground">
														{age}
													</span>
												)}
											</div>
											{location && (
												<p className="truncate text-[10px] font-mono text-muted-foreground">
													{location}
												</p>
											)}
											<p className="mt-0.5 line-clamp-1 text-xs leading-4 text-muted-foreground">
												{getCommentPreview(comment.body)}
											</p>
										</div>
										{comment.url ? (
											<LuArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
										) : null}
									</>
								);

								return (
									<div
										key={comment.id}
										className="group flex items-start gap-1 rounded-sm px-1.5 py-1.5 transition-colors hover:bg-accent/30"
									>
										{comment.url ? (
											<a
												href={comment.url}
												target="_blank"
												rel="noopener noreferrer"
												className="flex min-w-0 flex-1 items-start gap-2"
											>
												{content}
											</a>
										) : (
											<div className="flex min-w-0 flex-1 items-start gap-2">
												{content}
											</div>
										)}
										<Button
											type="button"
											variant="ghost"
											size="icon"
											className="mt-0.5 size-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-accent"
											onClick={(event) => {
												event.preventDefault();
												event.stopPropagation();
												handleCopyComment(comment);
											}}
											aria-label={isCopied ? "Copied comment" : "Copy comment"}
										>
											{isCopied ? (
												<LuCheck className="size-3" />
											) : (
												<LuCopy className="size-3" />
											)}
										</Button>
									</div>
								);
							})
						)}
					</div>
				</CollapsibleContent>
			</Collapsible>
		</div>
	);
}
