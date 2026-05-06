import { describe, expect, it } from "vitest";

import type { merchantRules } from "#/db/schema";

import { applyPostImportClassification } from "./post-import-classifier";

type MerchantRule = typeof merchantRules.$inferSelect;

const makeRule = (overrides: Partial<MerchantRule>): MerchantRule => ({
	id: overrides.id ?? "rule-1",
	userId: overrides.userId ?? "user-1",
	pattern: overrides.pattern ?? "coffee",
	bucket: overrides.bucket ?? "wants",
	envelopeId: overrides.envelopeId ?? null,
	priority: overrides.priority ?? 0,
	createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00.000Z"),
});

const makeRow = (overrides?: Partial<Parameters<typeof applyPostImportClassification>[0][number]>) => ({
	rowNumber: 2,
	date: new Date("2026-05-01T00:00:00.000Z"),
	merchantName: "Blue Bottle Coffee",
	description: "Morning coffee",
	amount: -4.25,
	type: "debit" as const,
	raw: {},
	fingerprint: "fp-1",
	...overrides,
});

describe("applyPostImportClassification", () => {
	it("applies merchant rules and sets source to rule", () => {
		const rows = [makeRow()];
		const rules = [
			makeRule({
				id: "rule-coffee",
				pattern: "blue bottle",
				bucket: "needs",
				envelopeId: "env-1",
				priority: 10,
			}),
		];

		const result = applyPostImportClassification(rows, rules);

		expect(result[0]).toMatchObject({
			bucket: "needs",
			envelopeId: "env-1",
			classificationConfidence: 1,
			classificationSource: "rule",
			matchedRuleId: "rule-coffee",
		});
	});

	it("returns none source when no rules match", () => {
		const rows = [makeRow({ description: "Taxi ride", merchantName: "City Cab" })];
		const rules = [makeRule({ id: "rule-1", pattern: "netflix", priority: 1 })];

		const result = applyPostImportClassification(rows, rules);

		expect(result[0]).toMatchObject({
			bucket: null,
			envelopeId: null,
			classificationConfidence: null,
			classificationSource: "none",
			matchedRuleId: null,
		});
	});

	it("preserves manually reviewed classifications", () => {
		const rows = [
			makeRow({
				isUserReviewed: true,
				bucket: "savings",
				envelopeId: "env-manual",
				classificationConfidence: 0.8,
			}),
		];
		const rules = [makeRule({ id: "rule-coffee", pattern: "blue bottle", bucket: "needs", priority: 10 })];

		const result = applyPostImportClassification(rows, rules);

		expect(result[0]).toMatchObject({
			bucket: "savings",
			envelopeId: "env-manual",
			classificationConfidence: 0.8,
			classificationSource: "manual",
			matchedRuleId: null,
		});
	});
});
