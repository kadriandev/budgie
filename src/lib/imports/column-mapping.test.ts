import { describe, expect, it } from "vitest";

import { suggestColumnMapping, validateColumnMapping } from "./column-mapping";

describe("suggestColumnMapping", () => {
	it("suggests mappings using second-row values", () => {
		const mapping = suggestColumnMapping([
			"col_1",
			"col_2",
			"col_3",
			"col_4",
		], {
			col_1: "2026-05-01",
			col_2: "Coffee shop",
			col_3: "-4.25",
			col_4: "Blue Bottle",
		});

		expect(mapping).toEqual({
			date: "col_1",
			description: "col_2",
			amount: "col_3",
			merchantName: "col_4",
		});
	});
});

describe("validateColumnMapping", () => {
	it("validates required mapped fields", () => {
		const result = validateColumnMapping({
			date: "date",
			description: "description",
			amount: "amount",
		});

		expect(result.isValid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("rejects missing required fields", () => {
		const result = validateColumnMapping({
			description: "description",
		});

		expect(result.isValid).toBe(false);
		expect(result.errors).toContain("Date column is required.");
		expect(result.errors).toContain("Amount column is required.");
	});

	it("rejects duplicate selected headers", () => {
		const result = validateColumnMapping({
			date: "Transaction",
			description: "Transaction",
			amount: "Amount",
		});

		expect(result.isValid).toBe(false);
		expect(result.errors).toContain(
			"Each mapped field must use a unique CSV column.",
		);
	});
});
