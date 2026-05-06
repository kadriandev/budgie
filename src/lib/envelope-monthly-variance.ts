import { calculateEnvelopeActualSpend, type EnvelopeTransaction } from "#/lib/envelope-spend-aggregation";

export type EnvelopeMonthlyVarianceInput = {
	userId: string;
	envelopeId: string;
	month: string;
};

export type EnvelopeMonthlySummaryRecord = {
	id: string;
	envelopeId: string;
	month: string;
	plannedAmount: number;
	actualAmount: number;
	variance: number;
	calculatedAt: Date;
};

type Deps = {
	findOwnedEnvelope: (
		envelopeId: string,
		userId: string,
	) => Promise<{ id: string } | null>;
	getPlannedAmountForMonth: (input: {
		envelopeId: string;
		month: string;
	}) => Promise<number | null>;
	listEnvelopeTransactionsForMonth: (input: {
		userId: string;
		envelopeId: string;
		monthStart: Date;
		nextMonthStart: Date;
	}) => Promise<EnvelopeTransaction[]>;
	upsertEnvelopeMonthlySummary: (input: {
		envelopeId: string;
		month: string;
		plannedAmount: number;
		actualAmount: number;
		variance: number;
	}) => Promise<EnvelopeMonthlySummaryRecord>;
	getEnvelopeMonthlySummary: (input: {
		envelopeId: string;
		month: string;
	}) => Promise<EnvelopeMonthlySummaryRecord | null>;
};

export class EnvelopeMonthlyVarianceError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "EnvelopeMonthlyVarianceError";
	}
}

export const calculateEnvelopeVariance = (
	plannedAmount: number,
	actualAmount: number,
): number => {
	const plannedCents = Math.round(plannedAmount * 100);
	const actualCents = Math.round(actualAmount * 100);
	return (actualCents - plannedCents) / 100;
};

export const recomputeEnvelopeMonthlyVariance = async (
	input: EnvelopeMonthlyVarianceInput,
	deps: Deps,
): Promise<EnvelopeMonthlySummaryRecord> => {
	assertValidMonth(input.month);

	const envelope = await deps.findOwnedEnvelope(input.envelopeId, input.userId);
	if (!envelope) {
		throw new EnvelopeMonthlyVarianceError(404, "envelope not found");
	}

	const planned = await deps.getPlannedAmountForMonth({
		envelopeId: input.envelopeId,
		month: input.month,
	});

	const { monthStart, nextMonthStart } = monthRange(input.month);
	const transactions = await deps.listEnvelopeTransactionsForMonth({
		userId: input.userId,
		envelopeId: input.envelopeId,
		monthStart,
		nextMonthStart,
	});

	const actual = calculateEnvelopeActualSpend(transactions, {
		userId: input.userId,
		envelopeId: input.envelopeId,
		month: input.month,
	}).actualAmount;

	const plannedAmount = roundMoney(planned ?? 0);
	const actualAmount = roundMoney(actual);
	const variance = roundMoney(calculateEnvelopeVariance(plannedAmount, actualAmount));

	return deps.upsertEnvelopeMonthlySummary({
		envelopeId: input.envelopeId,
		month: input.month,
		plannedAmount,
		actualAmount,
		variance,
	});
};

export const getEnvelopeMonthlyVariance = async (
	input: EnvelopeMonthlyVarianceInput,
	deps: Deps,
): Promise<EnvelopeMonthlySummaryRecord | null> => {
	assertValidMonth(input.month);

	const envelope = await deps.findOwnedEnvelope(input.envelopeId, input.userId);
	if (!envelope) {
		throw new EnvelopeMonthlyVarianceError(404, "envelope not found");
	}

	return deps.getEnvelopeMonthlySummary({
		envelopeId: input.envelopeId,
		month: input.month,
	});
};

const monthRange = (month: string): { monthStart: Date; nextMonthStart: Date } => {
	const [yearText, monthText] = month.split("-");
	const year = Number(yearText);
	const monthIndex = Number(monthText) - 1;
	const monthStart = new Date(Date.UTC(year, monthIndex, 1));
	const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1));
	return { monthStart, nextMonthStart };
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const assertValidMonth = (month: string): void => {
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
		throw new EnvelopeMonthlyVarianceError(
			400,
			"month must be formatted as YYYY-MM",
		);
	}
};
