import { describe, expect, it } from "vitest";

import { createTransactionFingerprint } from "./fingerprint";
import type { NormalizedTransactionRow } from "./transaction-normalizer";

const row: NormalizedTransactionRow = {
	rowNumber: 2,
	date: new Date("2026-05-01T00:00:00.000Z"),
	merchantName: "Blue Bottle",
	description: "Coffee",
	amount: -4.25,
	type: "debit",
	raw: {
		date: "2026-05-01",
		description: "Coffee",
		amount: "-4.25",
	},
};

describe("createTransactionFingerprint", () => {
	it("creates deterministic fingerprints for same row and context", () => {
		const context = { userId: "user-1", accountId: "account-1" };

		const first = createTransactionFingerprint(row, context);
		const second = createTransactionFingerprint(row, context);

		expect(first).toBe(second);
		expect(first).toHaveLength(64);
	});

	it("changes fingerprint when context or row changes", () => {
		const base = createTransactionFingerprint(row, {
			userId: "user-1",
			accountId: "account-1",
		});

		const differentContext = createTransactionFingerprint(row, {
			userId: "user-2",
			accountId: "account-1",
		});

		const differentAmount = createTransactionFingerprint(
			{ ...row, amount: -5.25 },
			{
				userId: "user-1",
				accountId: "account-1",
			},
		);

		expect(base).not.toBe(differentContext);
		expect(base).not.toBe(differentAmount);
	});
});
