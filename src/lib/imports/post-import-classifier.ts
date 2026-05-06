import type { merchantRules } from "#/db/schema";

import {
	classifyTransactionWithMerchantRules,
	type ClassificationResult,
} from "./merchant-classifier";
import type { NormalizedTransactionRow } from "./transaction-normalizer";

type MerchantRule = typeof merchantRules.$inferSelect;

export type ImportClassificationRow = NormalizedTransactionRow & {
	fingerprint: string;
	isUserReviewed?: boolean;
	bucket?: ClassificationResult["bucket"];
	envelopeId?: string | null;
	classificationConfidence?: number | null;
};

export type ClassifiedImportRow = ImportClassificationRow & {
	bucket: ClassificationResult["bucket"];
	envelopeId: string | null;
	classificationConfidence: number | null;
	classificationSource: "rule" | "manual" | "none";
	matchedRuleId: string | null;
};

export const applyPostImportClassification = (
	rows: ImportClassificationRow[],
	rules: MerchantRule[],
): ClassifiedImportRow[] => {
	return rows.map((row) => {
		if (row.isUserReviewed) {
			return {
				...row,
				bucket: row.bucket ?? null,
				envelopeId: row.envelopeId ?? null,
				classificationConfidence: row.classificationConfidence ?? null,
				classificationSource: "manual",
				matchedRuleId: null,
			};
		}

		const classification = classifyTransactionWithMerchantRules(row, rules);
		return {
			...row,
			bucket: classification.bucket,
			envelopeId: classification.envelopeId,
			classificationConfidence:
				classification.classificationConfidence > 0
					? classification.classificationConfidence
					: null,
			classificationSource:
				classification.matchedRuleId !== null ? "rule" : "none",
			matchedRuleId: classification.matchedRuleId,
		};
	});
};
