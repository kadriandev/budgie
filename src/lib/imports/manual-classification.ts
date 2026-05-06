import type { budgetBucket } from "#/db/schema";

type BudgetBucket = (typeof budgetBucket)[number];

export type ManualClassificationInput = {
	transactionId: string;
	userId: string;
	bucket: BudgetBucket | null;
	envelopeId: string | null;
};

export type ManualClassificationResult = {
	transactionId: string;
	bucket: BudgetBucket | null;
	envelopeId: string | null;
	isUserReviewed: boolean;
};

type Deps = {
	findOwnedTransaction: (
		transactionId: string,
		userId: string,
	) => Promise<{ id: string } | null>;
	findOwnedEnvelope: (
		envelopeId: string,
		userId: string,
	) => Promise<{ id: string } | null>;
	updateTransactionClassification: (
		input: ManualClassificationInput,
	) => Promise<ManualClassificationResult>;
};

export class ManualClassificationError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "ManualClassificationError";
	}
}

export const applyManualTransactionClassification = async (
	input: ManualClassificationInput,
	deps: Deps,
): Promise<ManualClassificationResult> => {
	const ownedTransaction = await deps.findOwnedTransaction(
		input.transactionId,
		input.userId,
	);

	if (!ownedTransaction) {
		throw new ManualClassificationError(404, "transaction not found");
	}

	if (input.envelopeId) {
		const ownedEnvelope = await deps.findOwnedEnvelope(
			input.envelopeId,
			input.userId,
		);

		if (!ownedEnvelope) {
			throw new ManualClassificationError(404, "envelope not found");
		}
	}

	return deps.updateTransactionClassification(input);
};
