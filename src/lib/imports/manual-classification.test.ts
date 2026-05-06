import { describe, expect, it, vi } from "vitest";

import {
	applyManualTransactionClassification,
	ManualClassificationError,
} from "./manual-classification";

const buildDeps = () => ({
	findOwnedTransaction: vi.fn(),
	findOwnedEnvelope: vi.fn(),
	updateTransactionClassification: vi.fn(),
});

describe("applyManualTransactionClassification", () => {
	it("updates classification for owned transaction and envelope", async () => {
		const deps = buildDeps();
		vi.mocked(deps.findOwnedTransaction).mockResolvedValue({ id: "txn-1" });
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue({ id: "env-1" });
		vi.mocked(deps.updateTransactionClassification).mockResolvedValue({
			transactionId: "txn-1",
			bucket: "needs",
			envelopeId: "env-1",
			isUserReviewed: true,
		});

		const result = await applyManualTransactionClassification(
			{
				transactionId: "txn-1",
				userId: "user-1",
				bucket: "needs",
				envelopeId: "env-1",
			},
			deps,
		);

		expect(result).toMatchObject({
			transactionId: "txn-1",
			bucket: "needs",
			envelopeId: "env-1",
			isUserReviewed: true,
		});
	});

	it("rejects unauthorized transaction access", async () => {
		const deps = buildDeps();
		vi.mocked(deps.findOwnedTransaction).mockResolvedValue(null);

		const result = applyManualTransactionClassification(
			{
				transactionId: "txn-1",
				userId: "user-1",
				bucket: "wants",
				envelopeId: null,
			},
			deps,
		);

		await expect(result).rejects.toMatchObject({
			status: 404,
			message: "transaction not found",
		});
		expect(deps.updateTransactionClassification).not.toHaveBeenCalled();
		expect(deps.findOwnedEnvelope).not.toHaveBeenCalled();
	});

	it("rejects envelope ownership mismatch", async () => {
		const deps = buildDeps();
		vi.mocked(deps.findOwnedTransaction).mockResolvedValue({ id: "txn-1" });
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue(null);

		const result = applyManualTransactionClassification(
			{
				transactionId: "txn-1",
				userId: "user-1",
				bucket: "savings",
				envelopeId: "env-2",
			},
			deps,
		);

		await expect(result).rejects.toMatchObject({
			status: 404,
			message: "envelope not found",
		});
		expect(deps.updateTransactionClassification).not.toHaveBeenCalled();
	});
});
