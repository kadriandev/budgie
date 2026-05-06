import type { merchantRules } from "#/db/schema";
import type { budgetBucket } from "#/db/schema";

import type { NormalizedTransactionRow } from "./transaction-normalizer";

type BudgetBucket = (typeof budgetBucket)[number];
type MerchantRule = typeof merchantRules.$inferSelect;

export type ClassificationResult = {
	bucket: BudgetBucket | null;
	envelopeId: string | null;
	classificationConfidence: number;
	matchedRuleId: string | null;
};

export const classifyTransactionWithMerchantRules = (
	transaction: NormalizedTransactionRow,
	rules: MerchantRule[],
): ClassificationResult => {
	const normalizedHaystack = normalizeForMatch(
		`${transaction.merchantName ?? ""} ${transaction.description}`,
	);

	const sortedRules = [...rules].sort((a, b) => {
		if (b.priority !== a.priority) {
			return b.priority - a.priority;
		}

		if (a.id < b.id) return -1;
		if (a.id > b.id) return 1;
		return 0;
	});

	for (const rule of sortedRules) {
		const normalizedPattern = normalizeForMatch(rule.pattern);
		if (normalizedPattern.length === 0) continue;

		if (normalizedHaystack.includes(normalizedPattern)) {
			return {
				bucket: rule.bucket,
				envelopeId: rule.envelopeId ?? null,
				classificationConfidence: 1,
				matchedRuleId: rule.id,
			};
		}
	}

	return {
		bucket: null,
		envelopeId: null,
		classificationConfidence: 0,
		matchedRuleId: null,
	};
};

const normalizeForMatch = (value: string): string =>
	value.trim().toLowerCase().replace(/\s+/g, " ");
