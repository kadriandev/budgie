import { createHash } from "node:crypto";

import type { NormalizedTransactionRow } from "./transaction-normalizer";

export type FingerprintContext = {
	userId: string;
	accountId: string;
};

export const createTransactionFingerprint = (
	row: NormalizedTransactionRow,
	context: FingerprintContext,
): string => {
	const canonical = JSON.stringify([
		context.userId.trim(),
		context.accountId.trim(),
		row.date.toISOString(),
		row.description.trim().toLowerCase(),
		(row.merchantName ?? "").trim().toLowerCase(),
		row.amount.toFixed(2),
		row.type,
	]);

	return createHash("sha256").update(canonical).digest("hex");
};
