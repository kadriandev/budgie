import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gte, lt, ne } from "drizzle-orm";

import { db } from "#/db";
import { envelopes, transactions } from "#/db/schema";
import {
	EnvelopeSpendAggregationError,
	getEnvelopeActualSpend,
} from "#/lib/envelope-spend-aggregation";

export const Route = createFileRoute("/api/envelopes/$envelopeId/actual-spend")({
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

					const result = await getEnvelopeActualSpend(
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
							listEnvelopeTransactionsForMonth: async (input) =>
								db
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
						},
					);

					return Response.json(result, { status: 200 });
				} catch (error) {
					if (error instanceof EnvelopeSpendAggregationError) {
						return Response.json({ error: error.message }, { status: error.status });
					}

					return Response.json(
						{ error: "failed to compute envelope actual spend" },
						{ status: 500 },
					);
				}
			},
		},
	},
});
