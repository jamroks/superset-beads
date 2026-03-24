import { Button } from "@superset/ui/button";
import { Users } from "lucide-react";
import Link from "next/link";
import { AcceptInvitationButton } from "./AcceptInvitationButton";

interface PageProps {
	params: Promise<{ invitationId: string }>;
	searchParams: Promise<{ token?: string }>;
}

export default async function AcceptInvitationPage({
	params,
	searchParams,
}: PageProps) {
	const { invitationId } = await params;
	const { token } = await searchParams;

	if (!token) {
		return (
			<div className="flex min-h-screen items-center justify-center p-4">
				<div className="max-w-lg space-y-6 text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-border">
						<Users className="h-8 w-8 text-muted-foreground" />
					</div>
					<div className="space-y-4">
						<h1 className="text-2xl font-semibold">
							Invitation link does not exist
						</h1>
						<p className="text-muted-foreground">
							The team invitation has either expired or doesn't exist. Request a
							new link from the team owner or check the URL to make sure it is
							entered correctly.
						</p>
					</div>
					<Button asChild variant="outline">
						<Link href="/">Return to dashboard</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center p-4">
			<div className="max-w-lg space-y-6 text-center">
				<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl border border-border">
					<Users className="h-8 w-8 text-muted-foreground" />
				</div>

				<div className="space-y-4">
					<h1 className="text-2xl font-semibold">Accept team invitation</h1>
					<p className="text-muted-foreground">
						Continue to accept this invitation and sign in to the associated
						account.
					</p>
				</div>

				<AcceptInvitationButton invitationId={invitationId} token={token} />
			</div>
		</div>
	);
}
