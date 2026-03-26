import { WebClient } from "@slack/web-api";
import { db, dbWs } from "@superset/db/client";
import type { SlackConfig } from "@superset/db/schema";
import {
	integrationConnections,
	members,
	usersSlackUsers,
} from "@superset/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

import { env } from "@/env";
import { posthog } from "@/lib/analytics";
import { verifySignedState } from "@/lib/oauth-state";

type DbWsTransaction = Parameters<Parameters<typeof dbWs.transaction>[0]>[0];

async function acquireSlackTeamLock(tx: DbWsTransaction, teamId: string) {
	await tx.execute(
		sql`select pg_advisory_xact_lock(hashtextextended(${teamId}, 0))`,
	);
}

export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	if (error) {
		return Response.redirect(
			`${env.NEXT_PUBLIC_WEB_URL}/integrations/slack?error=oauth_denied`,
		);
	}

	if (!code || !state) {
		return Response.redirect(
			`${env.NEXT_PUBLIC_WEB_URL}/integrations/slack?error=missing_params`,
		);
	}

	const stateData = verifySignedState(state);
	if (!stateData) {
		return Response.redirect(
			`${env.NEXT_PUBLIC_WEB_URL}/integrations/slack?error=invalid_state`,
		);
	}

	const { organizationId, userId } = stateData;

	// Re-verify membership at callback time (state was signed earlier)
	const membership = await db.query.members.findFirst({
		where: and(
			eq(members.organizationId, organizationId),
			eq(members.userId, userId),
		),
	});

	if (!membership) {
		console.error("[slack/callback] Membership verification failed:", {
			organizationId,
			userId,
		});
		return Response.redirect(
			`${env.NEXT_PUBLIC_WEB_URL}/integrations/slack?error=unauthorized`,
		);
	}

	const redirectUri = `${env.NEXT_PUBLIC_API_URL}/api/integrations/slack/callback`;
	const client = new WebClient();

	try {
		const tokenData = await client.oauth.v2.access({
			client_id: env.SLACK_CLIENT_ID,
			client_secret: env.SLACK_CLIENT_SECRET,
			redirect_uri: redirectUri,
			code,
		});

		if (!tokenData.ok || !tokenData.access_token || !tokenData.team) {
			console.error("[slack/callback] Slack API error:", tokenData.error);
			return Response.redirect(
				`${env.NEXT_PUBLIC_WEB_URL}/integrations/slack?error=slack_api_error`,
			);
		}

		const teamId = tokenData.team.id;
		if (!teamId) {
			console.error("[slack/callback] Slack team ID missing in OAuth response");
			return Response.redirect(
				`${env.NEXT_PUBLIC_WEB_URL}/integrations/slack?error=slack_api_error`,
			);
		}
		const accessToken = tokenData.access_token;
		const teamName = tokenData.team.name ?? null;

		const config: SlackConfig = {
			provider: "slack",
		};

		await dbWs.transaction(async (tx) => {
			await acquireSlackTeamLock(tx, teamId);

			await tx
				.delete(integrationConnections)
				.where(
					and(
						eq(integrationConnections.provider, "slack"),
						eq(integrationConnections.externalOrgId, teamId),
						ne(integrationConnections.organizationId, organizationId),
					),
				);

			await tx
				.insert(integrationConnections)
				.values({
					organizationId,
					connectedByUserId: userId,
					provider: "slack",
					accessToken,
					externalOrgId: teamId,
					externalOrgName: teamName,
					config,
				})
				.onConflictDoUpdate({
					target: [
						integrationConnections.organizationId,
						integrationConnections.provider,
					],
					set: {
						accessToken,
						externalOrgId: teamId,
						externalOrgName: teamName,
						connectedByUserId: userId,
						config,
						updatedAt: new Date(),
					},
				});

			await tx
				.delete(usersSlackUsers)
				.where(
					and(
						eq(usersSlackUsers.teamId, teamId),
						ne(usersSlackUsers.organizationId, organizationId),
					),
				);
		});

		console.log("[slack/callback] Connected workspace:", {
			organizationId,
			teamId,
			teamName,
		});

		posthog.capture({
			distinctId: userId,
			event: "slack_connected",
			properties: { team_id: teamId },
		});

		return Response.redirect(`${env.NEXT_PUBLIC_WEB_URL}/integrations/slack`);
	} catch (error) {
		console.error("[slack/callback] Token exchange failed:", error);
		return Response.redirect(
			`${env.NEXT_PUBLIC_WEB_URL}/integrations/slack?error=token_exchange_failed`,
		);
	}
}
