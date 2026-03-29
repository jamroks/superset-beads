import { describe, expect, test } from "bun:test";
import { deduplicateWorkflowStates } from "./deduplicateWorkflowStates";

describe("syncWorkflowStates", () => {
	describe("deduplicateWorkflowStates", () => {
		test("should deduplicate states with the same name and type across teams", () => {
			// Simulate two teams that each have "Todo", "In Progress", "Done"
			// with different Linear IDs (as happens in real Linear orgs)
			const team1States = [
				{
					id: "state-1a",
					name: "Todo",
					color: "#gray",
					type: "unstarted",
					position: 0,
				},
				{
					id: "state-1b",
					name: "In Progress",
					color: "#blue",
					type: "started",
					position: 1,
				},
				{
					id: "state-1c",
					name: "Done",
					color: "#green",
					type: "completed",
					position: 2,
				},
			];

			const team2States = [
				{
					id: "state-2a",
					name: "Todo",
					color: "#gray",
					type: "unstarted",
					position: 0,
				},
				{
					id: "state-2b",
					name: "In Progress",
					color: "#blue",
					type: "started",
					position: 1,
				},
				{
					id: "state-2c",
					name: "Done",
					color: "#green",
					type: "completed",
					position: 2,
				},
			];

			const allStates = [...team1States, ...team2States];
			const deduplicated = deduplicateWorkflowStates(allStates);

			// Should only have 3 unique states, not 6
			expect(deduplicated).toHaveLength(3);

			const names = deduplicated.map((s) => s.name);
			expect(names).toContain("Todo");
			expect(names).toContain("In Progress");
			expect(names).toContain("Done");
		});

		test("should keep states that have different names even if same type", () => {
			const states = [
				{
					id: "state-1",
					name: "Todo",
					color: "#gray",
					type: "unstarted",
					position: 0,
				},
				{
					id: "state-2",
					name: "Backlog",
					color: "#gray",
					type: "unstarted",
					position: 1,
				},
			];

			const deduplicated = deduplicateWorkflowStates(states);
			expect(deduplicated).toHaveLength(2);
		});

		test("should keep the first occurrence when deduplicating", () => {
			const states = [
				{
					id: "state-1a",
					name: "Todo",
					color: "#red",
					type: "unstarted",
					position: 0,
				},
				{
					id: "state-2a",
					name: "Todo",
					color: "#blue",
					type: "unstarted",
					position: 5,
				},
			];

			const deduplicated = deduplicateWorkflowStates(states);
			expect(deduplicated).toHaveLength(1);
			expect(deduplicated[0]?.id).toBe("state-1a");
			expect(deduplicated[0]?.color).toBe("#red");
		});

		test("should treat states with same name but different type as distinct", () => {
			// Edge case: same name but different type should be kept separate
			const states = [
				{
					id: "state-1",
					name: "Review",
					color: "#blue",
					type: "started",
					position: 0,
				},
				{
					id: "state-2",
					name: "Review",
					color: "#blue",
					type: "completed",
					position: 1,
				},
			];

			const deduplicated = deduplicateWorkflowStates(states);
			expect(deduplicated).toHaveLength(2);
		});

		test("reproduces issue #2974: multiple teams cause duplicate statuses in dropdown", () => {
			// This is the exact scenario from the bug report:
			// A Linear org with multiple teams where each team has the default
			// workflow states. Each team's states have unique Linear IDs,
			// so the DB unique constraint (org, provider, externalId) doesn't
			// catch the duplicates. The user sees N copies of each status.
			const teamCount = 4;
			const defaultStates = [
				{ name: "Backlog", color: "#bec2c8", type: "backlog", position: 0 },
				{ name: "Todo", color: "#e2e2e2", type: "unstarted", position: 1 },
				{
					name: "In Progress",
					color: "#f2c94c",
					type: "started",
					position: 2,
				},
				{ name: "In Review", color: "#f2994a", type: "started", position: 3 },
				{ name: "Done", color: "#5e6ad2", type: "completed", position: 4 },
				{
					name: "Canceled",
					color: "#95a2b3",
					type: "cancelled",
					position: 5,
				},
			];

			const allStates = [];
			for (let t = 0; t < teamCount; t++) {
				for (const state of defaultStates) {
					allStates.push({
						id: `team${t}-${state.name.toLowerCase().replace(/\s/g, "-")}`,
						...state,
					});
				}
			}

			// Without deduplication, we'd have 24 states (4 teams × 6 states)
			expect(allStates).toHaveLength(24);

			const deduplicated = deduplicateWorkflowStates(allStates);

			// After deduplication, we should have exactly 6 unique states
			expect(deduplicated).toHaveLength(6);
		});
	});
});
