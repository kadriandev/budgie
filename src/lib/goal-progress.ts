export type GoalRecord = {
	id: string;
	envelopeId: string;
	targetAmount: number;
	currentAmount: number;
	targetDate: Date | null;
	suggestedMonthlyContribution: number | null;
	isCompleted: boolean;
};

export type EnvelopeMonthlySummarySnapshot = {
	month: string;
	plannedAmount: number;
	actualAmount: number;
	variance: number;
};

type Deps = {
	findOwnedGoalByEnvelope: (
		userId: string,
		envelopeId: string,
	) => Promise<GoalRecord | null>;
	listEnvelopeMonthlySummaries: (
		envelopeId: string,
	) => Promise<EnvelopeMonthlySummarySnapshot[]>;
	updateGoalProgress: (input: {
		goalId: string;
		currentAmount: number;
		suggestedMonthlyContribution: number | null;
		isCompleted: boolean;
	}) => Promise<GoalRecord>;
};

export class GoalProgressError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "GoalProgressError";
	}
}

export const recomputeGoalProgressFromEnvelopeActivity = async (
	input: { userId: string; envelopeId: string; asOf?: Date },
	deps: Deps,
): Promise<GoalRecord | null> => {
	const goal = await deps.findOwnedGoalByEnvelope(input.userId, input.envelopeId);
	if (!goal) {
		return null;
	}

	const snapshots = await deps.listEnvelopeMonthlySummaries(input.envelopeId);
	const asOfMonth = toMonthString(input.asOf ?? new Date());
	const netContribution = snapshots.reduce(
		(total, row) =>
			row.month <= asOfMonth
				? total + roundMoney(row.plannedAmount - row.actualAmount)
				: total,
		0,
	);

	const unclampedCurrent = roundMoney(netContribution);
	const currentAmount = clamp(unclampedCurrent, 0, goal.targetAmount);
	const isCompleted = currentAmount >= goal.targetAmount;

	const suggestedMonthlyContribution = isCompleted
		? 0
		: computeSuggestedMonthlyContribution({
			remainingAmount: roundMoney(goal.targetAmount - currentAmount),
			targetDate: goal.targetDate,
			asOf: input.asOf ?? new Date(),
		});

	return deps.updateGoalProgress({
		goalId: goal.id,
		currentAmount,
		suggestedMonthlyContribution,
		isCompleted,
	});
};

const computeSuggestedMonthlyContribution = (input: {
	remainingAmount: number;
	targetDate: Date | null;
	asOf: Date;
}): number | null => {
	if (input.remainingAmount <= 0) return 0;
	if (!input.targetDate) return null;

	const months = monthsUntil(input.asOf, input.targetDate);
	if (months <= 0) return roundMoney(input.remainingAmount);

	return roundMoney(input.remainingAmount / months);
};

const monthsUntil = (start: Date, end: Date): number => {
	const yearDiff = end.getUTCFullYear() - start.getUTCFullYear();
	const monthDiff = end.getUTCMonth() - start.getUTCMonth();
	const raw = yearDiff * 12 + monthDiff;
	return Math.max(0, raw + (end.getUTCDate() >= start.getUTCDate() ? 1 : 0));
};

const clamp = (value: number, min: number, max: number): number =>
	Math.min(max, Math.max(min, value));

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const toMonthString = (value: Date): string => {
	const year = value.getUTCFullYear();
	const month = String(value.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
};
