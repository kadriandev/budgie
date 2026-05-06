import type { budgetBucket, transactionType, transactions } from "#/db/schema";

type BudgetBucket = (typeof budgetBucket)[number];
type TransactionType = (typeof transactionType)[number];

type MonthlySummaryTxn = Pick<
	typeof transactions.$inferSelect,
	"amount" | "bucket" | "type"
>;

export type MonthlySummaryRecord = {
	id: string;
	userId: string;
	month: string;
	income: number;
	needsTotal: number;
	wantsTotal: number;
	savingsTotal: number;
	needsPercent: number;
	wantsPercent: number;
	savingsPercent: number;
	alignmentScore: number;
	calculatedAt: Date;
};

type Deps = {
	listTransactionsForMonth: (input: {
		userId: string;
		monthStart: Date;
		nextMonthStart: Date;
	}) => Promise<MonthlySummaryTxn[]>;
	upsertMonthlySummary: (input: {
		userId: string;
		month: string;
		income: number;
		needsTotal: number;
		wantsTotal: number;
		savingsTotal: number;
		needsPercent: number;
		wantsPercent: number;
		savingsPercent: number;
		alignmentScore: number;
	}) => Promise<MonthlySummaryRecord>;
};

export class MonthlySummaryRecomputeError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "MonthlySummaryRecomputeError";
	}
}

export const recomputeMonthlySummary = async (
	input: { userId: string; month: string },
	deps: Deps,
): Promise<MonthlySummaryRecord> => {
	assertValidMonth(input.month);

	const { monthStart, nextMonthStart } = monthRange(input.month);
	const transactions = await deps.listTransactionsForMonth({
		userId: input.userId,
		monthStart,
		nextMonthStart,
	});

	const aggregate = aggregateMonthlySummary(transactions);

	return deps.upsertMonthlySummary({
		userId: input.userId,
		month: input.month,
		...aggregate,
	});
};

export const recomputeMonthlySummaryForDate = async (
	input: { userId: string; date: Date },
	deps: Deps,
): Promise<MonthlySummaryRecord> => {
	return recomputeMonthlySummary(
		{ userId: input.userId, month: toMonthString(input.date) },
		deps,
	);
};

const aggregateMonthlySummary = (
	transactions: MonthlySummaryTxn[],
): Omit<MonthlySummaryRecord, "id" | "userId" | "month" | "calculatedAt"> => {
	let incomeCents = 0;
	const bucketTotalsCents: Record<BudgetBucket, number> = {
		needs: 0,
		wants: 0,
		savings: 0,
	};

	for (const txn of transactions) {
		if (txn.type === "transfer") continue;

		const amountCents = Math.round(Math.abs(txn.amount) * 100);

		if (txn.type === "credit") {
			incomeCents += amountCents;
			continue;
		}

		if (txn.type === "debit" && txn.bucket) {
			bucketTotalsCents[txn.bucket] += amountCents;
		}
	}

	const income = incomeCents / 100;
	const needsTotal = bucketTotalsCents.needs / 100;
	const wantsTotal = bucketTotalsCents.wants / 100;
	const savingsTotal = bucketTotalsCents.savings / 100;

	const needsPercent = percentage(needsTotal, income);
	const wantsPercent = percentage(wantsTotal, income);
	const savingsPercent = percentage(savingsTotal, income);

	const alignmentScore = calculateAlignmentScore({
		needsPercent,
		wantsPercent,
		savingsPercent,
	});

	return {
		income: roundMoney(income),
		needsTotal: roundMoney(needsTotal),
		wantsTotal: roundMoney(wantsTotal),
		savingsTotal: roundMoney(savingsTotal),
		needsPercent,
		wantsPercent,
		savingsPercent,
		alignmentScore,
	};
};

const percentage = (numerator: number, denominator: number): number => {
	if (denominator <= 0) return 0;
	return roundMoney((numerator / denominator) * 100);
};

const calculateAlignmentScore = (input: {
	needsPercent: number;
	wantsPercent: number;
	savingsPercent: number;
}): number => {
	const drift =
		Math.abs(input.needsPercent - 50) +
		Math.abs(input.wantsPercent - 30) +
		Math.abs(input.savingsPercent - 20);

	return roundMoney(Math.max(0, 100 - drift));
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const toMonthString = (value: Date): string => {
	const year = value.getUTCFullYear();
	const month = String(value.getUTCMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
};

const monthRange = (month: string): { monthStart: Date; nextMonthStart: Date } => {
	const [yearText, monthText] = month.split("-");
	const year = Number(yearText);
	const monthIndex = Number(monthText) - 1;
	return {
		monthStart: new Date(Date.UTC(year, monthIndex, 1)),
		nextMonthStart: new Date(Date.UTC(year, monthIndex + 1, 1)),
	};
};

const assertValidMonth = (month: string): void => {
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
		throw new MonthlySummaryRecomputeError(
			400,
			"month must be formatted as YYYY-MM",
		);
	}
};
