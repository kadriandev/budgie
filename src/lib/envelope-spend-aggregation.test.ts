import { describe, expect, it, vi } from "vitest";

import {
	EnvelopeSpendAggregationError,
	calculateEnvelopeActualSpend,
	getEnvelopeActualSpend,
	type EnvelopeTransaction,
} from "./envelope-spend-aggregation";

const txn = (overrides: Partial<EnvelopeTransaction>): EnvelopeTransaction => ({
	id: overrides.id ?? crypto.randomUUID(),
	userId: overrides.userId ?? "user-1",
	envelopeId: overrides.envelopeId ?? "env-1",
	date: overrides.date ?? new Date("2026-06-15T00:00:00.000Z"),
	amount: overrides.amount ?? 10,
	type: overrides.type ?? "debit",
});

describe("calculateEnvelopeActualSpend", () => {
	it("aggregates only matching month, user, and envelope rows", () => {
		const rows: EnvelopeTransaction[] = [
			txn({ amount: 20, date: new Date("2026-06-02T00:00:00.000Z") }),
			txn({ amount: 30, date: new Date("2026-06-30T00:00:00.000Z") }),
			txn({ amount: 40, date: new Date("2026-07-01T00:00:00.000Z") }),
			txn({ amount: 50, userId: "user-2" }),
			txn({ amount: 60, envelopeId: "env-2" }),
		];

		const result = calculateEnvelopeActualSpend(rows, {
			userId: "user-1",
			envelopeId: "env-1",
			month: "2026-06",
		});

		expect(result).toEqual({
			envelopeId: "env-1",
			month: "2026-06",
			actualAmount: 50,
			transactionCount: 2,
		});
	});

	it("excludes transfers and applies debit/credit sign behavior", () => {
		const rows: EnvelopeTransaction[] = [
			txn({ amount: -100, type: "debit" }),
			txn({ amount: 50, type: "credit" }),
			txn({ amount: -20, type: "credit" }),
			txn({ amount: 999, type: "transfer" }),
		];

		const result = calculateEnvelopeActualSpend(rows, {
			userId: "user-1",
			envelopeId: "env-1",
			month: "2026-06",
		});

		expect(result.actualAmount).toBe(30);
		expect(result.transactionCount).toBe(3);
	});

	it("normalizes amounts to cents before summing", () => {
		const rows: EnvelopeTransaction[] = [
			txn({ amount: 10.005, type: "debit" }),
			txn({ amount: 0.001, type: "credit" }),
		];

		const result = calculateEnvelopeActualSpend(rows, {
			userId: "user-1",
			envelopeId: "env-1",
			month: "2026-06",
		});

		expect(result.actualAmount).toBe(10.01);
	});

	it("aggregates with cent precision for repeated decimals", () => {
		const rows: EnvelopeTransaction[] = [
			txn({ amount: 0.1, type: "debit" }),
			txn({ amount: 0.1, type: "debit" }),
			txn({ amount: 0.1, type: "debit" }),
		];

		const result = calculateEnvelopeActualSpend(rows, {
			userId: "user-1",
			envelopeId: "env-1",
			month: "2026-06",
		});

		expect(result.actualAmount).toBe(0.3);
	});

	it("returns zero totals when no rows match", () => {
		const result = calculateEnvelopeActualSpend([], {
			userId: "user-1",
			envelopeId: "env-1",
			month: "2026-06",
		});

		expect(result.actualAmount).toBe(0);
		expect(result.transactionCount).toBe(0);
	});

	it("rejects invalid month format", () => {
		expect(() =>
			calculateEnvelopeActualSpend([], {
				userId: "user-1",
				envelopeId: "env-1",
				month: "06-2026",
			}),
		).toThrowError(EnvelopeSpendAggregationError);
	});
});

describe("getEnvelopeActualSpend", () => {
	it("checks ownership and uses month-bounded query deps", async () => {
		const findOwnedEnvelope = vi.fn().mockResolvedValue({ id: "env-1" });
		const listEnvelopeTransactionsForMonth = vi.fn().mockResolvedValue([
			txn({ amount: 25 }),
			txn({ amount: 5, type: "credit" }),
		]);

		const result = await getEnvelopeActualSpend(
			{ userId: "user-1", envelopeId: "env-1", month: "2026-06" },
			{ findOwnedEnvelope, listEnvelopeTransactionsForMonth },
		);

		expect(findOwnedEnvelope).toHaveBeenCalledWith("env-1", "user-1");
		expect(listEnvelopeTransactionsForMonth).toHaveBeenCalledTimes(1);
		expect(result.actualAmount).toBe(20);
		expect(result.transactionCount).toBe(2);
	});

	it("throws 404 when envelope is not owned by user", async () => {
		const findOwnedEnvelope = vi.fn().mockResolvedValue(null);
		const listEnvelopeTransactionsForMonth = vi.fn();

		await expect(
			getEnvelopeActualSpend(
				{ userId: "user-1", envelopeId: "env-missing", month: "2026-06" },
				{ findOwnedEnvelope, listEnvelopeTransactionsForMonth },
			),
		).rejects.toMatchObject({ status: 404 });
	});
});
