import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gte, lt, ne, sql } from "drizzle-orm";

import { db } from "#/db";
import {
	envelopeBudgetAllocations,
	envelopeMonthlySummaries,
	envelopes,
	goals,
	transactions,
} from "#/db/schema";
import {
	EnvelopeMonthlyVarianceError,
	getEnvelopeMonthlyVariance,
	recomputeEnvelopeMonthlyVariance,
} from "#/lib/envelope-monthly-variance";
import { recomputeGoalProgressFromEnvelopeActivity } from "#/lib/goal-progress";

export const Route = createFileRoute("/api/envelopes/$envelopeId/monthly-summary")(
	{
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

						const url = new URL(request.url);
						const month = url.searchParams.get("month")?.trim() ?? "";

						const row = await getEnvelopeMonthlyVariance(
							{ userId, envelopeId: params.envelopeId, month },
							{
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
								getPlannedAmountForMonth: async () => null,
								listEnvelopeTransactionsForMonth: async () => [],
								upsertEnvelopeMonthlySummary: async () => {
									throw new EnvelopeMonthlyVarianceError(500, "not used in GET");
								},
								getEnvelopeMonthlySummary: async (input) =>
									db
										.select({
											id: envelopeMonthlySummaries.id,
											envelopeId: envelopeMonthlySummaries.envelopeId,
											month: envelopeMonthlySummaries.month,
											plannedAmount: envelopeMonthlySummaries.plannedAmount,
											actualAmount: envelopeMonthlySummaries.actualAmount,
											variance: envelopeMonthlySummaries.variance,
											calculatedAt: envelopeMonthlySummaries.calculatedAt,
										})
										.from(envelopeMonthlySummaries)
										.where(
											and(
												eq(envelopeMonthlySummaries.envelopeId, input.envelopeId),
												eq(envelopeMonthlySummaries.month, input.month),
											),
										)
										.get(),
							},
						);

						return Response.json({ row }, { status: 200 });
					} catch (error) {
						if (error instanceof EnvelopeMonthlyVarianceError) {
							return Response.json({ error: error.message }, { status: error.status });
						}

						return Response.json(
							{ error: "failed to fetch envelope monthly summary" },
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

						const row = await db.transaction(async (tx) => {
							const summary = await recomputeEnvelopeMonthlyVariance(
								{ userId, envelopeId: params.envelopeId, month },
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
									getPlannedAmountForMonth: async (input) => {
										const allocation = await tx
										.select({ plannedAmount: envelopeBudgetAllocations.plannedAmount })
										.from(envelopeBudgetAllocations)
										.where(
											and(
												eq(envelopeBudgetAllocations.envelopeId, input.envelopeId),
												eq(envelopeBudgetAllocations.month, input.month),
											),
										)
										.get();

									return allocation?.plannedAmount ?? null;
								},
									listEnvelopeTransactionsForMonth: async (input) =>
										tx
										.select({
											id: transactions.id,
											date: transactions.date,
											amount: transactions.amount,
											type: transactions.type,
											envelopeId: transactions.envelopeId,
											userId: transactions.userId,
										})
										.from(transactions)
										.where(
											and(
												eq(transactions.userId, input.userId),
												eq(transactions.envelopeId, input.envelopeId),
												gte(transactions.date, input.monthStart),
												lt(transactions.date, input.nextMonthStart),
												ne(transactions.type, "transfer"),
											),
										),
									upsertEnvelopeMonthlySummary: async (input) =>
										tx
										.insert(envelopeMonthlySummaries)
										.values({
											id: crypto.randomUUID(),
											envelopeId: input.envelopeId,
											month: input.month,
											plannedAmount: input.plannedAmount,
											actualAmount: input.actualAmount,
											variance: input.variance,
											calculatedAt: new Date(),
										})
										.onConflictDoUpdate({
											target: [
												envelopeMonthlySummaries.envelopeId,
												envelopeMonthlySummaries.month,
											],
											set: {
												plannedAmount: input.plannedAmount,
												actualAmount: input.actualAmount,
												variance: input.variance,
												calculatedAt: new Date(),
											},
										})
										.returning({
											id: envelopeMonthlySummaries.id,
											envelopeId: envelopeMonthlySummaries.envelopeId,
											month: envelopeMonthlySummaries.month,
											plannedAmount: envelopeMonthlySummaries.plannedAmount,
											actualAmount: envelopeMonthlySummaries.actualAmount,
											variance: envelopeMonthlySummaries.variance,
											calculatedAt: envelopeMonthlySummaries.calculatedAt,
										})
										.get(),
									getEnvelopeMonthlySummary: async () => null,
								},
							);

							await recomputeGoalProgressFromEnvelopeActivity(
								{ userId, envelopeId: params.envelopeId },
								{
									findOwnedGoalByEnvelope: async (currentUserId, envelopeId) =>
										tx
										.select({
											id: goals.id,
											envelopeId: goals.envelopeId,
											targetAmount: goals.targetAmount,
											currentAmount: goals.currentAmount,
											targetDate: goals.targetDate,
											suggestedMonthlyContribution: goals.suggestedMonthlyContribution,
											isCompleted: goals.isCompleted,
										})
										.from(goals)
										.innerJoin(envelopes, eq(goals.envelopeId, envelopes.id))
										.where(
											and(
												eq(envelopes.userId, currentUserId),
												eq(envelopes.id, envelopeId),
											),
										)
										.get(),
									listEnvelopeMonthlySummaries: async (envelopeId) =>
										tx
										.select({
											month: envelopeMonthlySummaries.month,
											plannedAmount:
												sql<number>`coalesce(${envelopeMonthlySummaries.plannedAmount}, 0)`,
											actualAmount: envelopeMonthlySummaries.actualAmount,
											variance:
												sql<number>`coalesce(${envelopeMonthlySummaries.variance}, 0)`,
										})
										.from(envelopeMonthlySummaries)
										.where(eq(envelopeMonthlySummaries.envelopeId, envelopeId)),
									updateGoalProgress: async (input) =>
										tx
										.update(goals)
										.set({
											currentAmount: input.currentAmount,
											suggestedMonthlyContribution: input.suggestedMonthlyContribution,
											isCompleted: input.isCompleted,
										})
										.where(eq(goals.id, input.goalId))
										.returning({
											id: goals.id,
											envelopeId: goals.envelopeId,
											targetAmount: goals.targetAmount,
											currentAmount: goals.currentAmount,
											targetDate: goals.targetDate,
											suggestedMonthlyContribution: goals.suggestedMonthlyContribution,
											isCompleted: goals.isCompleted,
										})
										.get(),
								},
							);

							return summary;
						});

						return Response.json({ row }, { status: 200 });
					} catch (error) {
						if (error instanceof EnvelopeMonthlyVarianceError) {
							return Response.json({ error: error.message }, { status: error.status });
						}

						return Response.json(
							{ error: "failed to recompute envelope monthly summary" },
							{ status: 500 },
						);
					}
				},
			},
		},
	},
);
