import type { transactionType, transactions } from "#/db/schema";

type TransactionType = (typeof transactionType)[number];

export type EnvelopeTransaction = Pick<
	typeof transactions.$inferSelect,
	"id" | "date" | "amount" | "type" | "envelopeId" | "userId"
>;

export type EnvelopeActualSpendResult = {
	envelopeId: string;
	month: string;
	actualAmount: number;
	transactionCount: number;
};

type GetEnvelopeActualSpendDeps = {
	findOwnedEnvelope: (
		envelopeId: string,
		userId: string,
	) => Promise<{ id: string } | null>;
	listEnvelopeTransactionsForMonth: (input: {
		userId: string;
		envelopeId: string;
		monthStart: Date;
		nextMonthStart: Date;
	}) => Promise<EnvelopeTransaction[]>;
};

export class EnvelopeSpendAggregationError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "EnvelopeSpendAggregationError";
	}
}

export const calculateEnvelopeActualSpend = (
	transactions: EnvelopeTransaction[],
	input: {
		userId: string;
		envelopeId: string;
		month: string;
	},
): EnvelopeActualSpendResult => {
	assertValidMonth(input.month);

	let actualAmount = 0;
	let actualAmountCents = 0;
	let transactionCount = 0;

	for (const txn of transactions) {
		if (txn.userId !== input.userId) continue;
		if (txn.envelopeId !== input.envelopeId) continue;
		if (txn.type === "transfer") continue;
		if (!isInMonth(txn.date, input.month)) continue;

		transactionCount += 1;
		actualAmountCents += signedSpendCents(txn.amount, txn.type);
	}

	actualAmount = actualAmountCents / 100;

	return {
		envelopeId: input.envelopeId,
		month: input.month,
		actualAmount: roundMoney(actualAmount),
		transactionCount,
	};
};

export const getEnvelopeActualSpend = async (
	input: {
		userId: string;
		envelopeId: string;
		month: string;
	},
	deps: GetEnvelopeActualSpendDeps,
): Promise<EnvelopeActualSpendResult> => {
	assertValidMonth(input.month);

	const envelope = await deps.findOwnedEnvelope(input.envelopeId, input.userId);
	if (!envelope) {
		throw new EnvelopeSpendAggregationError(404, "envelope not found");
	}

	const { monthStart, nextMonthStart } = monthRange(input.month);
	const rows = await deps.listEnvelopeTransactionsForMonth({
		userId: input.userId,
		envelopeId: input.envelopeId,
		monthStart,
		nextMonthStart,
	});

	return calculateEnvelopeActualSpend(rows, input);
};

const signedSpendCents = (amount: number, type: TransactionType): number => {
	const absoluteAmountCents = Math.round(Math.abs(amount) * 100);

	if (type === "debit") {
		return absoluteAmountCents;
	}

	if (type === "credit") {
		return -absoluteAmountCents;
	}

	return 0;
};

const isInMonth = (value: Date, month: string): boolean => {
	const year = value.getUTCFullYear();
	const currentMonth = String(value.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${currentMonth}` === month;
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
		throw new EnvelopeSpendAggregationError(
			400,
			"month must be formatted as YYYY-MM",
		);
	}
};
