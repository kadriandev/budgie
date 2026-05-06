import { describe, expect, it } from "vitest";

import type { merchantRules } from "#/db/schema";

import { classifyTransactionWithMerchantRules } from "./merchant-classifier";
import type { NormalizedTransactionRow } from "./transaction-normalizer";

type MerchantRule = typeof merchantRules.$inferSelect;

const makeRule = (overrides: Partial<MerchantRule>): MerchantRule => ({
	id: overrides.id ?? "rule-1",
	userId: overrides.userId ?? "user-1",
	pattern: overrides.pattern ?? "COFFEE",
	bucket: overrides.bucket ?? "wants",
	envelopeId: overrides.envelopeId ?? null,
	priority: overrides.priority ?? 0,
	createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
});

const transaction: NormalizedTransactionRow = {
	rowNumber: 2,
	date: new Date("2026-05-01T00:00:00.000Z"),
	merchantName: "Blue Bottle Coffee",
	description: "Morning coffee",
	amount: -4.25,
	type: "debit",
	raw: {},
};

describe("classifyTransactionWithMerchantRules", () => {
	it("uses the highest-priority matching rule", () => {
		const result = classifyTransactionWithMerchantRules(transaction, [
			makeRule({ id: "rule-low", pattern: "coffee", bucket: "wants", priority: 1 }),
			makeRule({ id: "rule-high", pattern: "blue bottle", bucket: "needs", priority: 10 }),
		]);

		expect(result).toEqual({
			bucket: "needs",
			envelopeId: null,
			classificationConfidence: 1,
			matchedRuleId: "rule-high",
		});
	});

	it("returns unclassified result when no rules match", () => {
		const result = classifyTransactionWithMerchantRules(transaction, [
			makeRule({ id: "rule-1", pattern: "netflix", priority: 5 }),
		]);

		expect(result).toEqual({
			bucket: null,
			envelopeId: null,
			classificationConfidence: 0,
			matchedRuleId: null,
		});
	});

	it("uses deterministic tie-breaker for equal priority", () => {
		const result = classifyTransactionWithMerchantRules(transaction, [
			makeRule({ id: "rule-b", pattern: "coffee", bucket: "wants", priority: 5 }),
			makeRule({ id: "rule-a", pattern: "blue bottle", bucket: "needs", priority: 5 }),
		]);

		expect(result.matchedRuleId).toBe("rule-a");
		expect(result.bucket).toBe("needs");
	});
});
