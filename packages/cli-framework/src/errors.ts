export class CLIError extends Error {
	constructor(
		message: string,
		public suggestion?: string,
	) {
		super(message);
		this.name = "CLIError";
	}
}

export function suggestSimilar(
	input: string,
	candidates: string[],
	threshold = 3,
): string | undefined {
	let best: string | undefined;
	let bestDistance = threshold + 1;

	for (const candidate of candidates) {
		const distance = damerauLevenshtein(input, candidate);
		if (distance < bestDistance) {
			bestDistance = distance;
			best = candidate;
		}
	}

	return best;
}

function damerauLevenshtein(a: string, b: string): number {
	const lenA = a.length;
	const lenB = b.length;
	const d: number[][] = Array.from({ length: lenA + 1 }, () =>
		Array(lenB + 1).fill(0),
	);

	for (let i = 0; i <= lenA; i++) d[i]![0] = i;
	for (let j = 0; j <= lenB; j++) d[0]![j] = j;

	for (let i = 1; i <= lenA; i++) {
		for (let j = 1; j <= lenB; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			d[i]![j] = Math.min(
				d[i - 1]![j]! + 1, // deletion
				d[i]![j - 1]! + 1, // insertion
				d[i - 1]![j - 1]! + cost, // substitution
			);
			if (
				i > 1 &&
				j > 1 &&
				a[i - 1] === b[j - 2] &&
				a[i - 2] === b[j - 1]
			) {
				d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + cost); // transposition
			}
		}
	}

	return d[lenA]![lenB]!;
}
