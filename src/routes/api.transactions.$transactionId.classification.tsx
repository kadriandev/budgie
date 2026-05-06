import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { db } from "#/db";
import { envelopes, transactions } from "#/db/schema";
import {
	applyManualTransactionClassification,
	ManualClassificationError,
} from "#/lib/imports/manual-classification";

const validBuckets = new Set(["needs", "wants", "savings"] as const);

export const Route = createFileRoute("/api/transactions/$transactionId/classification")({
	server: {
		handlers: {
			PATCH: async ({ request, params }) => {
				try {
					const userId = request.headers.get("x-user-id")?.trim();
					if (!userId) {
						return Response.json(
							{ error: "missing authentication header x-user-id" },
							{ status: 401 },
						);
					}

					let body: unknown;
					try {
						body = await request.json();
					} catch {
						return Response.json({ error: "invalid JSON body" }, { status: 400 });
					}

					if (!body || typeof body !== "object" || Array.isArray(body)) {
						return Response.json({ error: "invalid request body" }, { status: 400 });
					}

					const payload = body as { bucket?: unknown; envelopeId?: unknown };

					if (payload.bucket === undefined && payload.envelopeId === undefined) {
						return Response.json(
							{ error: "at least one field (bucket or envelopeId) is required" },
							{ status: 400 },
						);
					}

					const bucket =
						typeof payload.bucket === "string"
							? payload.bucket.trim().toLowerCase()
							: payload.bucket;
					const envelopeId =
						typeof payload.envelopeId === "string"
							? payload.envelopeId.trim()
							: payload.envelopeId;

					if (
						bucket !== null &&
						bucket !== undefined &&
						typeof bucket !== "string"
					) {
						return Response.json(
							{ error: "invalid bucket value" },
							{ status: 400 },
						);
					}

					if (bucket !== null && bucket !== undefined && !validBuckets.has(bucket)) {
						return Response.json(
							{ error: "invalid bucket value" },
							{ status: 400 },
						);
					}

					if (
						envelopeId !== null &&
						envelopeId !== undefined &&
						typeof envelopeId !== "string"
					) {
						return Response.json(
							{ error: "invalid envelopeId value" },
							{ status: 400 },
						);
					}

					const updated = await applyManualTransactionClassification(
						{
							transactionId: params.transactionId,
							userId,
							bucket: typeof bucket === "string" ? bucket : null,
							envelopeId:
								typeof envelopeId === "string" && envelopeId.length > 0
									? envelopeId
									: null,
						},
						{
							findOwnedTransaction: async (transactionId, currentUserId) =>
								db
									.select({ id: transactions.id })
									.from(transactions)
									.where(
										and(
											eq(transactions.id, transactionId),
											eq(transactions.userId, currentUserId),
										),
									)
									.get(),
							findOwnedEnvelope: async (candidateEnvelopeId, currentUserId) =>
								db
									.select({ id: envelopes.id })
									.from(envelopes)
									.where(
										and(
											eq(envelopes.id, candidateEnvelopeId),
											eq(envelopes.userId, currentUserId),
										),
									)
									.get(),
							updateTransactionClassification: async (input) => {
								const row = await db
									.update(transactions)
									.set({
										bucket: input.bucket,
										envelopeId: input.envelopeId,
										isUserReviewed: true,
									})
									.where(
										and(
											eq(transactions.id, input.transactionId),
											eq(transactions.userId, input.userId),
										),
									)
									.returning({
										transactionId: transactions.id,
										bucket: transactions.bucket,
										envelopeId: transactions.envelopeId,
										isUserReviewed: transactions.isUserReviewed,
									})
									.get();

								if (!row) {
									throw new ManualClassificationError(
										404,
										"transaction not found",
									);
								}

								return row;
							},
						},
					);

					return Response.json(updated, { status: 200 });
				} catch (error) {
					if (error instanceof ManualClassificationError) {
						return Response.json({ error: error.message }, { status: error.status });
					}

					return Response.json(
						{ error: "failed to update transaction classification" },
						{ status: 500 },
					);
				}
			},
		},
	},
});
