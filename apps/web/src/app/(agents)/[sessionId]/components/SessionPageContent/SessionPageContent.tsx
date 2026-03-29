"use client";

import { useState } from "react";
import type { MockSession } from "../../../mock-data";
import { FollowUpInput } from "../FollowUpInput";
import { SessionChat } from "../SessionChat";
import { SessionDiff } from "../SessionDiff";
import { SessionHeader } from "../SessionHeader";
import { SessionTabs } from "../SessionTabs";

type ActiveTab = "chat" | "diff";

type SessionPageContentProps = {
	session: MockSession;
};

export function SessionPageContent({ session }: SessionPageContentProps) {
	const [activeTab, setActiveTab] = useState<ActiveTab>("chat");

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<SessionHeader session={session} />
			<SessionTabs activeTab={activeTab} onTabChange={setActiveTab} />
			<div className="flex-1 overflow-hidden">
				{activeTab === "chat" ? <SessionChat /> : <SessionDiff />}
			</div>
			{activeTab === "chat" && <FollowUpInput />}
		</div>
	);
}
