import { describe, expect, test } from "bun:test";

/**
 * Regression test for https://github.com/supersetapp/superset/issues/3158
 *
 * The Properties sidebar in the task detail view must constrain its height
 * so the inner ScrollArea can scroll when content overflows (e.g. long task
 * titles or many properties). Without `overflow-hidden` on the outer
 * container, Radix ScrollArea cannot determine the scrollable boundary and
 * the panel content is clipped without a scrollbar.
 */
describe("PropertiesSidebar", () => {
	test("outer container includes overflow-hidden so ScrollArea can scroll", async () => {
		const source = await Bun.file(
			`${import.meta.dir}/PropertiesSidebar.tsx`,
		).text();

		// The outermost wrapper div must include overflow-hidden to give the
		// Radix ScrollArea a bounded height for its virtualised viewport.
		// Match the className string on the container div that holds ScrollArea.
		const containerClassMatch = source.match(
			/<div\s+className="([^"]*?\bw-64\b[^"]*)"/,
		);

		expect(containerClassMatch).not.toBeNull();
		const classes = containerClassMatch?.[1];
		expect(classes).toContain("overflow-hidden");
	});
});
