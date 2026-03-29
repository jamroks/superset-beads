interface WorkflowState {
	id: string;
	name: string;
	color: string;
	type: string;
	position: number;
}

/**
 * Deduplicates workflow states by name+type.
 * In Linear, each team has its own workflow states with unique IDs,
 * but they often share the same names (e.g. "Todo", "In Progress", "Done").
 * Without deduplication, orgs with N teams get N copies of each status.
 */
export function deduplicateWorkflowStates<T extends WorkflowState>(
	states: T[],
): T[] {
	const seen = new Map<string, T>();
	for (const state of states) {
		const key = `${state.name}::${state.type}`;
		if (!seen.has(key)) {
			seen.set(key, state);
		}
	}
	return Array.from(seen.values());
}
