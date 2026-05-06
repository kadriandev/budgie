import type { transactions } from "#/db/schema";

export type NeedsReviewTransaction = Pick<
	typeof transactions.$inferSelect,
	| "id"
	| "date"
	| "description"
	| "merchantName"
	| "amount"
	| "type"
	| "bucket"
	| "envelopeId"
	| "classificationConfidence"
	| "isUserReviewed"
>;

export const DEFAULT_REVIEW_CONFIDENCE_THRESHOLD = 0.7;

export type NeedsReviewQueryOptions = {
	confidenceThreshold?: number;
	limit?: number;
	offset?: number;
};

export type NeedsReviewQueryResult = {
	rows: NeedsReviewTransaction[];
	nextOffset: number | null;
};

export const getNeedsReviewTransactions = (
	transactions: NeedsReviewTransaction[],
	options: NeedsReviewQueryOptions = {},
): NeedsReviewQueryResult => {
	const confidenceThreshold =
		options.confidenceThreshold ?? DEFAULT_REVIEW_CONFIDENCE_THRESHOLD;
	const limit = clampLimit(options.limit ?? 50);
	const offset = Math.max(0, options.offset ?? 0);

	const filtered = transactions
		.filter((txn) => isNeedsReview(txn, confidenceThreshold))
		.sort((a, b) => {
			if (b.date.getTime() !== a.date.getTime()) {
				return b.date.getTime() - a.date.getTime();
			}

			if (a.id > b.id) return -1;
			if (a.id < b.id) return 1;
			return 0;
		});

	const rows = filtered.slice(offset, offset + limit);
	const nextOffset = offset + limit < filtered.length ? offset + limit : null;

	return { rows, nextOffset };
};

export const isNeedsReview = (
	txn: NeedsReviewTransaction,
	confidenceThreshold = DEFAULT_REVIEW_CONFIDENCE_THRESHOLD,
): boolean => {
	if (txn.isUserReviewed) return false;
	if (!txn.bucket) return true;
	if (!txn.envelopeId) return true;
	if (txn.classificationConfidence === null) return true;
	if (txn.classificationConfidence < confidenceThreshold) return true;
	return false;
};

const clampLimit = (value: number): number => {
	if (!Number.isFinite(value)) return 50;
	const normalized = Math.floor(value);
	if (normalized < 1) return 1;
	if (normalized > 200) return 200;
	return normalized;
};
