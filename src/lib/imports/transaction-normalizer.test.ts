import { describe, expect, it } from "vitest";

import type { ParsedCsvRow } from "./csv-parser";
import { normalizeTransactionRow } from "./transaction-normalizer";

const makeRow = (
	values: Record<string, string>,
	rowNumber = 2,
): ParsedCsvRow => ({
	rowNumber,
	values,
});

describe("normalizeTransactionRow", () => {
	it("normalizes direct amount rows", () => {
		const result = normalizeTransactionRow(
			makeRow({
				date: "2026-05-01",
				description: "Coffee shop",
				merchant: "Blue Bottle",
				amount: "-4.25",
			}),
		);

		if ("message" in result) throw new Error("Expected normalized result");

		expect(result.amount).toBe(-4.25);
		expect(result.type).toBe("debit");
		expect(result.merchantName).toBe("Blue Bottle");
	});

	it("normalizes debit/credit split rows", () => {
		const result = normalizeTransactionRow(
			makeRow({
				"posted date": "2026-05-01",
				description: "Payroll",
				credit: "2,000.00",
			}),
		);

		if ("message" in result) throw new Error("Expected normalized result");

		expect(result.amount).toBe(2000);
		expect(result.type).toBe("credit");
	});

	it("detects transfer descriptions", () => {
		const result = normalizeTransactionRow(
			makeRow({
				date: "2026-05-01",
				description: "Transfer to savings",
				amount: "-100",
			}),
		);

		if ("message" in result) throw new Error("Expected normalized result");
		expect(result.type).toBe("transfer");
	});

	it("returns row error on invalid date", () => {
		const result = normalizeTransactionRow(
			makeRow({
				date: "not-a-date",
				description: "Coffee",
				amount: "-4.25",
			}),
		);

		expect("message" in result).toBe(true);
		if ("message" in result) {
			expect(result.message).toContain("Invalid date");
		}
	});

	it("returns row error when both debit and credit are populated", () => {
		const result = normalizeTransactionRow(
			makeRow({
				date: "2026-05-01",
				description: "Ambiguous row",
				debit: "20.00",
				credit: "20.00",
			}),
		);

		expect("message" in result).toBe(true);
		if ("message" in result) {
			expect(result.message).toContain("Missing or invalid amount");
		}
	});
});
