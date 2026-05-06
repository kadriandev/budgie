import { describe, expect, it, vi } from "vitest";

import {
	calculateEnvelopeVariance,
	EnvelopeMonthlyVarianceError,
	getEnvelopeMonthlyVariance,
	recomputeEnvelopeMonthlyVariance,
} from "./envelope-monthly-variance";

const depsFactory = () => ({
	findOwnedEnvelope: vi.fn(),
	getPlannedAmountForMonth: vi.fn(),
	listEnvelopeTransactionsForMonth: vi.fn(),
	upsertEnvelopeMonthlySummary: vi.fn(),
	getEnvelopeMonthlySummary: vi.fn(),
});

describe("calculateEnvelopeVariance", () => {
	it("returns actual minus planned", () => {
		expect(calculateEnvelopeVariance(200, 250)).toBe(50);
		expect(calculateEnvelopeVariance(300, 250)).toBe(-50);
	});
});

describe("recomputeEnvelopeMonthlyVariance", () => {
	it("computes and upserts monthly summary for owned envelope", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue({ id: "env-1" });
		vi.mocked(deps.getPlannedAmountForMonth).mockResolvedValue(200);
		vi.mocked(deps.listEnvelopeTransactionsForMonth).mockResolvedValue([
			{
				id: "txn-1",
				date: new Date("2026-06-01T00:00:00.000Z"),
				amount: 150,
				type: "debit",
				envelopeId: "env-1",
				userId: "user-1",
			},
			{
				id: "txn-2",
				date: new Date("2026-06-02T00:00:00.000Z"),
				amount: 30,
				type: "credit",
				envelopeId: "env-1",
				userId: "user-1",
			},
		]);
		vi.mocked(deps.upsertEnvelopeMonthlySummary).mockResolvedValue({
			id: "summary-1",
			envelopeId: "env-1",
			month: "2026-06",
			plannedAmount: 200,
			actualAmount: 120,
			variance: -80,
			calculatedAt: new Date("2026-06-03T00:00:00.000Z"),
		});

		const result = await recomputeEnvelopeMonthlyVariance(
			{ userId: "user-1", envelopeId: "env-1", month: "2026-06" },
			deps,
		);

		expect(deps.upsertEnvelopeMonthlySummary).toHaveBeenCalledWith({
			envelopeId: "env-1",
			month: "2026-06",
			plannedAmount: 200,
			actualAmount: 120,
			variance: -80,
		});
		expect(result.id).toBe("summary-1");
	});

	it("defaults planned amount to zero when allocation is missing", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue({ id: "env-1" });
		vi.mocked(deps.getPlannedAmountForMonth).mockResolvedValue(null);
		vi.mocked(deps.listEnvelopeTransactionsForMonth).mockResolvedValue([
			{
				id: "txn-1",
				date: new Date("2026-06-01T00:00:00.000Z"),
				amount: 45,
				type: "debit",
				envelopeId: "env-1",
				userId: "user-1",
			},
		]);
		vi.mocked(deps.upsertEnvelopeMonthlySummary).mockResolvedValue({
			id: "summary-1",
			envelopeId: "env-1",
			month: "2026-06",
			plannedAmount: 0,
			actualAmount: 45,
			variance: 45,
			calculatedAt: new Date(),
		});

		await recomputeEnvelopeMonthlyVariance(
			{ userId: "user-1", envelopeId: "env-1", month: "2026-06" },
			deps,
		);

		expect(deps.upsertEnvelopeMonthlySummary).toHaveBeenCalledWith(
			expect.objectContaining({ plannedAmount: 0, actualAmount: 45, variance: 45 }),
		);
	});

	it("is idempotent by recomputing and upserting same envelope-month key", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue({ id: "env-1" });
		vi.mocked(deps.getPlannedAmountForMonth).mockResolvedValue(100);
		vi.mocked(deps.listEnvelopeTransactionsForMonth)
			.mockResolvedValueOnce([
				{
					id: "txn-1",
					date: new Date("2026-06-01T00:00:00.000Z"),
					amount: 110,
					type: "debit",
					envelopeId: "env-1",
					userId: "user-1",
				},
			])
			.mockResolvedValueOnce([
				{
					id: "txn-2",
					date: new Date("2026-06-02T00:00:00.000Z"),
					amount: 90,
					type: "debit",
					envelopeId: "env-1",
					userId: "user-1",
				},
			]);

		vi.mocked(deps.upsertEnvelopeMonthlySummary).mockResolvedValue({
			id: "summary-1",
			envelopeId: "env-1",
			month: "2026-06",
			plannedAmount: 100,
			actualAmount: 110,
			variance: 10,
			calculatedAt: new Date(),
		});

		await recomputeEnvelopeMonthlyVariance(
			{ userId: "user-1", envelopeId: "env-1", month: "2026-06" },
			deps,
		);
		await recomputeEnvelopeMonthlyVariance(
			{ userId: "user-1", envelopeId: "env-1", month: "2026-06" },
			deps,
		);

		expect(deps.upsertEnvelopeMonthlySummary).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({ envelopeId: "env-1", month: "2026-06", variance: 10 }),
		);
		expect(deps.upsertEnvelopeMonthlySummary).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({ envelopeId: "env-1", month: "2026-06", variance: -10 }),
		);
	});

	it("throws when envelope is not owned by user", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue(null);

		await expect(
			recomputeEnvelopeMonthlyVariance(
				{ userId: "user-1", envelopeId: "env-1", month: "2026-06" },
				deps,
			),
		).rejects.toMatchObject({ status: 404 });
		expect(deps.upsertEnvelopeMonthlySummary).not.toHaveBeenCalled();
	});

	it("throws for invalid month", async () => {
		const deps = depsFactory();

		await expect(
			recomputeEnvelopeMonthlyVariance(
				{ userId: "user-1", envelopeId: "env-1", month: "06-2026" },
				deps,
			),
		).rejects.toBeInstanceOf(EnvelopeMonthlyVarianceError);
	});
});

describe("getEnvelopeMonthlyVariance", () => {
	it("returns summary for owned envelope", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue({ id: "env-1" });
		vi.mocked(deps.getEnvelopeMonthlySummary).mockResolvedValue({
			id: "summary-1",
			envelopeId: "env-1",
			month: "2026-06",
			plannedAmount: 100,
			actualAmount: 80,
			variance: -20,
			calculatedAt: new Date(),
		});

		const result = await getEnvelopeMonthlyVariance(
			{ userId: "user-1", envelopeId: "env-1", month: "2026-06" },
			deps,
		);

		expect(result?.id).toBe("summary-1");
	});
});
