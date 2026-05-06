import { describe, expect, it, vi } from "vitest";

import {
	MonthlySummaryRecomputeError,
	recomputeMonthlySummary,
	recomputeMonthlySummaryForDate,
} from "./monthly-summary-recompute";

const depsFactory = () => ({
	listTransactionsForMonth: vi.fn(),
	upsertMonthlySummary: vi.fn(),
});

describe("recomputeMonthlySummary", () => {
	it("aggregates income, bucket totals, percentages, and alignment", async () => {
		const deps = depsFactory();
		vi.mocked(deps.listTransactionsForMonth).mockResolvedValue([
			{ amount: 4000, type: "credit", bucket: null },
			{ amount: 2000, type: "debit", bucket: "needs" },
			{ amount: 1200, type: "debit", bucket: "wants" },
			{ amount: 800, type: "debit", bucket: "savings" },
			{ amount: 50, type: "transfer", bucket: "needs" },
		]);
		vi.mocked(deps.upsertMonthlySummary).mockResolvedValue({
			id: "summary-1",
			userId: "user-1",
			month: "2026-06",
			income: 4000,
			needsTotal: 2000,
			wantsTotal: 1200,
			savingsTotal: 800,
			needsPercent: 50,
			wantsPercent: 30,
			savingsPercent: 20,
			alignmentScore: 100,
			calculatedAt: new Date(),
		});

		await recomputeMonthlySummary({ userId: "user-1", month: "2026-06" }, deps);

		expect(deps.upsertMonthlySummary).toHaveBeenCalledWith({
			userId: "user-1",
			month: "2026-06",
			income: 4000,
			needsTotal: 2000,
			wantsTotal: 1200,
			savingsTotal: 800,
			needsPercent: 50,
			wantsPercent: 30,
			savingsPercent: 20,
			alignmentScore: 100,
		});
	});

	it("is idempotent by upserting same month key", async () => {
		const deps = depsFactory();
		vi.mocked(deps.listTransactionsForMonth).mockResolvedValue([
			{ amount: 1000, type: "credit", bucket: null },
		]);
		vi.mocked(deps.upsertMonthlySummary).mockResolvedValue({} as never);

		await recomputeMonthlySummary({ userId: "user-1", month: "2026-06" }, deps);
		await recomputeMonthlySummary({ userId: "user-1", month: "2026-06" }, deps);

		expect(deps.upsertMonthlySummary).toHaveBeenCalledTimes(2);
		expect(deps.upsertMonthlySummary).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ userId: "user-1", month: "2026-06" }),
		);
		expect(deps.upsertMonthlySummary).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ userId: "user-1", month: "2026-06" }),
		);
	});

	it("rejects invalid month", async () => {
		const deps = depsFactory();

		await expect(
			recomputeMonthlySummary({ userId: "user-1", month: "06-2026" }, deps),
		).rejects.toBeInstanceOf(MonthlySummaryRecomputeError);
	});
});

describe("recomputeMonthlySummaryForDate", () => {
	it("normalizes date into month and recomputes", async () => {
		const deps = depsFactory();
		vi.mocked(deps.listTransactionsForMonth).mockResolvedValue([]);
		vi.mocked(deps.upsertMonthlySummary).mockResolvedValue({
			id: "summary-1",
			userId: "user-1",
			month: "2026-07",
			income: 0,
			needsTotal: 0,
			wantsTotal: 0,
			savingsTotal: 0,
			needsPercent: 0,
			wantsPercent: 0,
			savingsPercent: 0,
			alignmentScore: 0,
			calculatedAt: new Date(),
		});

		await recomputeMonthlySummaryForDate(
			{ userId: "user-1", date: new Date("2026-07-15T00:00:00.000Z") },
			deps,
		);

		expect(deps.upsertMonthlySummary).toHaveBeenCalledWith(
			expect.objectContaining({ month: "2026-07" }),
		);
	});
});
