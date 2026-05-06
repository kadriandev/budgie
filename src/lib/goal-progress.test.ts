import { describe, expect, it, vi } from "vitest";

import { recomputeGoalProgressFromEnvelopeActivity } from "./goal-progress";

const depsFactory = () => ({
	findOwnedGoalByEnvelope: vi.fn(),
	listEnvelopeMonthlySummaries: vi.fn(),
	updateGoalProgress: vi.fn(),
});

describe("recomputeGoalProgressFromEnvelopeActivity", () => {
	it("returns null when envelope has no owned goal", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedGoalByEnvelope).mockResolvedValue(null);

		const result = await recomputeGoalProgressFromEnvelopeActivity(
			{ userId: "user-1", envelopeId: "env-1" },
			deps,
		);

		expect(result).toBeNull();
		expect(deps.updateGoalProgress).not.toHaveBeenCalled();
	});

	it("updates progress using planned minus actual contributions", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedGoalByEnvelope).mockResolvedValue({
			id: "goal-1",
			envelopeId: "env-1",
			targetAmount: 1000,
			currentAmount: 0,
			targetDate: null,
			suggestedMonthlyContribution: null,
			isCompleted: false,
		});
		vi.mocked(deps.listEnvelopeMonthlySummaries).mockResolvedValue([
			{ month: "2026-06", plannedAmount: 200, actualAmount: 150, variance: -50 },
			{ month: "2026-07", plannedAmount: 200, actualAmount: 260, variance: 60 },
		]);
		vi.mocked(deps.updateGoalProgress).mockResolvedValue({
			id: "goal-1",
			envelopeId: "env-1",
			targetAmount: 1000,
			currentAmount: 0,
			targetDate: null,
			suggestedMonthlyContribution: null,
			isCompleted: false,
		});

		await recomputeGoalProgressFromEnvelopeActivity(
			{ userId: "user-1", envelopeId: "env-1" },
			deps,
		);

		expect(deps.updateGoalProgress).toHaveBeenCalledWith({
			goalId: "goal-1",
			currentAmount: 0,
			suggestedMonthlyContribution: null,
			isCompleted: false,
		});
	});

	it("caps overshoot at target and marks goal completed", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedGoalByEnvelope).mockResolvedValue({
			id: "goal-1",
			envelopeId: "env-1",
			targetAmount: 300,
			currentAmount: 0,
			targetDate: new Date("2026-12-01T00:00:00.000Z"),
			suggestedMonthlyContribution: null,
			isCompleted: false,
		});
		vi.mocked(deps.listEnvelopeMonthlySummaries).mockResolvedValue([
			{ month: "2026-06", plannedAmount: 250, actualAmount: 20, variance: -230 },
			{ month: "2026-07", plannedAmount: 250, actualAmount: 20, variance: -230 },
		]);
		vi.mocked(deps.updateGoalProgress).mockResolvedValue({} as never);

		await recomputeGoalProgressFromEnvelopeActivity(
			{ userId: "user-1", envelopeId: "env-1", asOf: new Date("2026-07-10T00:00:00.000Z") },
			deps,
		);

		expect(deps.updateGoalProgress).toHaveBeenCalledWith({
			goalId: "goal-1",
			currentAmount: 300,
			suggestedMonthlyContribution: 0,
			isCompleted: true,
		});
	});

	it("computes suggested monthly contribution when target date exists", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedGoalByEnvelope).mockResolvedValue({
			id: "goal-1",
			envelopeId: "env-1",
			targetAmount: 1000,
			currentAmount: 0,
			targetDate: new Date("2026-12-31T00:00:00.000Z"),
			suggestedMonthlyContribution: null,
			isCompleted: false,
		});
		vi.mocked(deps.listEnvelopeMonthlySummaries).mockResolvedValue([
			{ month: "2026-06", plannedAmount: 300, actualAmount: 100, variance: -200 },
		]);
		vi.mocked(deps.updateGoalProgress).mockResolvedValue({} as never);

		await recomputeGoalProgressFromEnvelopeActivity(
			{ userId: "user-1", envelopeId: "env-1", asOf: new Date("2026-07-01T00:00:00.000Z") },
			deps,
		);

		expect(deps.updateGoalProgress).toHaveBeenCalledWith(
			expect.objectContaining({
				goalId: "goal-1",
				currentAmount: 200,
				suggestedMonthlyContribution: 133.33,
				isCompleted: false,
			}),
		);
	});

	it("ignores future monthly summaries when recomputing progress", async () => {
		const deps = depsFactory();
		vi.mocked(deps.findOwnedGoalByEnvelope).mockResolvedValue({
			id: "goal-1",
			envelopeId: "env-1",
			targetAmount: 1000,
			currentAmount: 0,
			targetDate: null,
			suggestedMonthlyContribution: null,
			isCompleted: false,
		});
		vi.mocked(deps.listEnvelopeMonthlySummaries).mockResolvedValue([
			{ month: "2026-06", plannedAmount: 300, actualAmount: 100, variance: -200 },
			{ month: "2026-12", plannedAmount: 300, actualAmount: 100, variance: -200 },
		]);
		vi.mocked(deps.updateGoalProgress).mockResolvedValue({} as never);

		await recomputeGoalProgressFromEnvelopeActivity(
			{ userId: "user-1", envelopeId: "env-1", asOf: new Date("2026-07-01T00:00:00.000Z") },
			deps,
		);

		expect(deps.updateGoalProgress).toHaveBeenCalledWith(
			expect.objectContaining({ currentAmount: 200 }),
		);
	});
});
