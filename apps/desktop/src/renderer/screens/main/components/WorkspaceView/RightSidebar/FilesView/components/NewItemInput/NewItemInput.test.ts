import { describe, expect, test } from "bun:test";

/**
 * Regression test for #2796
 *
 * The NewItemInput component must auto-focus its input field on mount so users
 * can immediately start typing after clicking "New File" or "New Folder".
 *
 * Because there is no DOM testing library in this project, we verify the
 * required patterns exist in the component source as a structural regression
 * check.
 */

const source = await Bun.file(`${import.meta.dir}/NewItemInput.tsx`).text();

describe("NewItemInput", () => {
	test("imports useRef and useEffect for auto-focus", () => {
		expect(source).toContain("useRef");
		expect(source).toContain("useEffect");
	});

	test("creates an inputRef", () => {
		expect(source).toMatch(/useRef<HTMLInputElement>/);
	});

	test("attaches ref to the input element", () => {
		expect(source).toMatch(/ref=\{inputRef\}/);
	});

	test("calls focus() on mount via useEffect", () => {
		expect(source).toMatch(/inputRef\.current\?\.focus\(\)/);
	});
});
