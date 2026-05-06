import { describe, expect, it } from "vitest";

import type { ParsedCsvRow } from "./csv-parser";
import { processImportRows } from "./import-row-processor";

const makeRow = (
	rowNumber: number,
	values: Record<string, string>,
): ParsedCsvRow => ({
	rowNumber,
	values,
});

describe("processImportRows", () => {
	it("returns valid normalized rows for good input", () => {
		const result = processImportRows([
			makeRow(2, {
				date: "2026-05-01",
				description: "Coffee",
				amount: "-4.25",
				merchant: "Blue Bottle",
			}),
		]);

		expect(result.errors).toHaveLength(0);
		expect(result.validRows).toHaveLength(1);
		expect(result.validRows[0]?.description).toBe("Coffee");
	});

	it("captures normalization errors with row metadata", () => {
		const result = processImportRows([
			makeRow(2, {
				description: "Coffee",
				amount: "-4.25",
			}),
		]);

		expect(result.validRows).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			rowNumber: 2,
			errorCode: "normalization_error",
		});
	});

	it("captures validation errors for future dates", () => {
		const nextYear = new Date().getFullYear() + 1;
		const result = processImportRows([
			makeRow(2, {
				date: `${nextYear}-01-01`,
				description: "Future txn",
				amount: "-10.00",
			}),
		]);

		expect(result.validRows).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			rowNumber: 2,
			errorCode: "validation_error",
			errorMessage: "Date cannot be in the future",
		});
	});
});
