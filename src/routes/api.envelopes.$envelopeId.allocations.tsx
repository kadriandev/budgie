import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, gte, lt, ne } from "drizzle-orm";

import { db } from "#/db";
import { envelopeBudgetAllocations, envelopes, monthlySummaries, transactions } from "#/db/schema";
import {
	EnvelopeAllocationError,
	getEnvelopeAllocations,
	upsertEnvelopeAllocation,
} from "#/lib/envelope-allocations";
import { recomputeMonthlySummary } from "#/lib/monthly-summary-recompute";

export const Route = createFileRoute("/api/envelopes/$envelopeId/allocations")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				try {
					const userId = request.headers.get("x-user-id")?.trim();
					if (!userId) {
						return Response.json(
							{ error: "missing authentication header x-user-id" },
							{ status: 401 },
						);
					}

					const rows = await getEnvelopeAllocations(userId, params.envelopeId, {
						findOwnedEnvelope: async (envelopeId, currentUserId) =>
							db
								.select({ id: envelopes.id })
								.from(envelopes)
								.where(
									and(
										eq(envelopes.id, envelopeId),
										eq(envelopes.userId, currentUserId),
									),
								)
								.get(),
						upsertAllocation: async () => {
							throw new EnvelopeAllocationError(500, "not used in GET");
						},
						listAllocations: async (envelopeId) =>
							db
								.select({
									id: envelopeBudgetAllocations.id,
									envelopeId: envelopeBudgetAllocations.envelopeId,
									month: envelopeBudgetAllocations.month,
									plannedAmount: envelopeBudgetAllocations.plannedAmount,
								})
								.from(envelopeBudgetAllocations)
								.where(eq(envelopeBudgetAllocations.envelopeId, envelopeId))
								.orderBy(desc(envelopeBudgetAllocations.month)),
					});

					return Response.json({ rows }, { status: 200 });
				} catch (error) {
					if (error instanceof EnvelopeAllocationError) {
						return Response.json({ error: error.message }, { status: error.status });
					}

					return Response.json(
						{ error: "failed to fetch envelope allocations" },
						{ status: 500 },
					);
				}
			},
			PUT: async ({ request, params }) => {
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

					const month =
						typeof (body as { month?: unknown }).month === "string"
							? (body as { month: string }).month.trim()
							: "";
					const plannedAmount = Number(
						(body as { plannedAmount?: unknown }).plannedAmount,
					);

					const allocation = await db.transaction(async (tx) => {
						const row = await upsertEnvelopeAllocation(
							{
								userId,
								envelopeId: params.envelopeId,
								month,
								plannedAmount,
							},
							{
								findOwnedEnvelope: async (envelopeId, currentUserId) =>
									tx
										.select({ id: envelopes.id })
										.from(envelopes)
										.where(
											and(
												eq(envelopes.id, envelopeId),
												eq(envelopes.userId, currentUserId),
											),
										)
										.get(),
								upsertAllocation: async (input) =>
									tx
										.insert(envelopeBudgetAllocations)
										.values({
											id: crypto.randomUUID(),
											envelopeId: input.envelopeId,
											month: input.month,
											plannedAmount: input.plannedAmount,
											updatedAt: new Date(),
										})
										.onConflictDoUpdate({
											target: [
												envelopeBudgetAllocations.envelopeId,
												envelopeBudgetAllocations.month,
											],
											set: {
												plannedAmount: input.plannedAmount,
												updatedAt: new Date(),
											},
										})
										.returning({
											id: envelopeBudgetAllocations.id,
											envelopeId: envelopeBudgetAllocations.envelopeId,
											month: envelopeBudgetAllocations.month,
											plannedAmount: envelopeBudgetAllocations.plannedAmount,
										})
										.get(),
								listAllocations: async () => [],
							},
						);

						await recomputeMonthlySummary(
							{ userId, month },
							{
								listTransactionsForMonth: async (input) =>
									tx
										.select({
											amount: transactions.amount,
											type: transactions.type,
											bucket: transactions.bucket,
										})
										.from(transactions)
										.where(
											and(
												eq(transactions.userId, input.userId),
												gte(transactions.date, input.monthStart),
												lt(transactions.date, input.nextMonthStart),
												ne(transactions.type, "transfer"),
											),
										),
								upsertMonthlySummary: async (input) =>
									tx
										.insert(monthlySummaries)
										.values({
											id: crypto.randomUUID(),
											userId: input.userId,
											month: input.month,
											income: input.income,
											needsTotal: input.needsTotal,
											wantsTotal: input.wantsTotal,
											savingsTotal: input.savingsTotal,
											needsPercent: input.needsPercent,
											wantsPercent: input.wantsPercent,
											savingsPercent: input.savingsPercent,
											alignmentScore: input.alignmentScore,
											calculatedAt: new Date(),
										})
										.onConflictDoUpdate({
											target: [monthlySummaries.userId, monthlySummaries.month],
											set: {
												income: input.income,
												needsTotal: input.needsTotal,
												wantsTotal: input.wantsTotal,
												savingsTotal: input.savingsTotal,
												needsPercent: input.needsPercent,
												wantsPercent: input.wantsPercent,
												savingsPercent: input.savingsPercent,
												alignmentScore: input.alignmentScore,
												calculatedAt: new Date(),
											},
										})
										.returning()
										.get(),
							},
						);

						return row;
					});

					return Response.json(allocation, { status: 200 });
				} catch (error) {
					if (error instanceof EnvelopeAllocationError) {
						return Response.json({ error: error.message }, { status: error.status });
					}

					return Response.json(
						{ error: "failed to upsert envelope allocation" },
						{ status: 500 },
					);
				}
			},
		},
	},
});
