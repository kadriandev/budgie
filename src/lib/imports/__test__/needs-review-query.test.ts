import { describe, expect, it } from "vitest";

import {
	getNeedsReviewTransactions,
	isNeedsReview,
} from "../needs-review-query";

const makeTransaction = (
	overrides?: Partial<ReturnType<typeof baseTransaction>>,
) => ({
	...baseTransaction(),
	...overrides,
});

function baseTransaction() {
	return {
		id: "txn-1",
		date: new Date("2026-05-01T00:00:00.000Z"),
		description: "Coffee",
		merchantName: "Blue Bottle",
		amount: -4.25,
		type: "debit" as const,
		bucket: "wants" as const,
		envelopeId: "env-1",
		classificationConfidence: 0.9,
		isUserReviewed: false,
	};
}

describe("isNeedsReview", () => {
	it("returns true when bucket is missing", () => {
		expect(isNeedsReview(makeTransaction({ bucket: undefined }))).toBe(true);
	});

	it("returns true when envelope is missing", () => {
		expect(isNeedsReview(makeTransaction({ envelopeId: undefined }))).toBe(
			true,
		);
	});

	it("returns true when confidence is low", () => {
		expect(
			isNeedsReview(makeTransaction({ classificationConfidence: 0.2 })),
		).toBe(true);
	});

	it("returns false when transaction was manually reviewed", () => {
		expect(
			isNeedsReview(
				makeTransaction({
					bucket: undefined,
					classificationConfidence: 0.1,
					isUserReviewed: true,
				}),
			),
		).toBe(false);
	});
});

describe("getNeedsReviewTransactions", () => {
	it("filters and sorts by newest first", () => {
		const result = getNeedsReviewTransactions([
			makeTransaction({
				id: "txn-1",
				date: new Date("2026-05-01"),
				bucket: undefined,
			}),
			makeTransaction({
				id: "txn-2",
				date: new Date("2026-05-03"),
				envelopeId: undefined,
			}),
			makeTransaction({
				id: "txn-3",
				date: new Date("2026-05-02"),
				classificationConfidence: 0.1,
			}),
			makeTransaction({
				id: "txn-4",
				date: new Date("2026-05-04"),
				classificationConfidence: 0.95,
			}),
		]);

		expect(result.rows.map((row) => row.id)).toEqual([
			"txn-2",
			"txn-3",
			"txn-1",
		]);
		expect(result.nextOffset).toBeNull();
	});

	it("uses id descending as tie-breaker for same date", () => {
		const sameDate = new Date("2026-05-01");
		const result = getNeedsReviewTransactions([
			makeTransaction({ id: "txn-a", date: sameDate, bucket: undefined }),
			makeTransaction({ id: "txn-c", date: sameDate, bucket: undefined }),
			makeTransaction({ id: "txn-b", date: sameDate, bucket: undefined }),
		]);

		expect(result.rows.map((row) => row.id)).toEqual([
			"txn-c",
			"txn-b",
			"txn-a",
		]);
	});

	it("paginates results and returns next offset", () => {
		const result = getNeedsReviewTransactions(
			[
				makeTransaction({
					id: "txn-1",
					date: new Date("2026-05-04"),
					bucket: undefined,
				}),
				makeTransaction({
					id: "txn-2",
					date: new Date("2026-05-03"),
					bucket: undefined,
				}),
				makeTransaction({
					id: "txn-3",
					date: new Date("2026-05-02"),
					bucket: undefined,
				}),
			],
			{ limit: 2, offset: 0 },
		);

		expect(result.rows.map((row) => row.id)).toEqual(["txn-1", "txn-2"]);
		expect(result.nextOffset).toBe(2);
	});
});
