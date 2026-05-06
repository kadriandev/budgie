import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";

import { db } from "#/db";
import { transactions } from "#/db/schema";
import { DEFAULT_REVIEW_CONFIDENCE_THRESHOLD } from "#/lib/imports/needs-review-query";

export const Route = createFileRoute("/api/transactions/review")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const userId = request.headers.get("x-user-id")?.trim();
				if (!userId) {
					return Response.json(
						{ error: "missing authentication header x-user-id" },
						{ status: 401 },
					);
				}

				const url = new URL(request.url);
				const limit = clampLimit(Number(url.searchParams.get("limit") ?? "50"));
				const beforeDateParam = url.searchParams.get("beforeDate");
				const beforeIdParam = url.searchParams.get("beforeId");

				if ((beforeDateParam && !beforeIdParam) || (!beforeDateParam && beforeIdParam)) {
					return Response.json(
						{ error: "beforeDate and beforeId must be provided together" },
						{ status: 400 },
					);
				}

				const beforeDate = beforeDateParam ? new Date(beforeDateParam) : null;
				if (beforeDate && Number.isNaN(beforeDate.getTime())) {
					return Response.json({ error: "invalid beforeDate" }, { status: 400 });
				}

				const reviewFilter = or(
					isNull(transactions.bucket),
					isNull(transactions.envelopeId),
					isNull(transactions.classificationConfidence),
					lt(
						transactions.classificationConfidence,
						DEFAULT_REVIEW_CONFIDENCE_THRESHOLD,
					),
				);

				const cursorFilter =
					beforeDate && beforeIdParam
						? or(
							lt(transactions.date, beforeDate),
							and(
								eq(transactions.date, beforeDate),
								lt(transactions.id, beforeIdParam),
							),
						)
						: undefined;

				const whereClause = and(
					eq(transactions.userId, userId),
					eq(transactions.isUserReviewed, false),
					reviewFilter,
					cursorFilter,
				);

				const rows = await db
					.select({
						id: transactions.id,
						date: transactions.date,
						description: transactions.description,
						merchantName: transactions.merchantName,
						amount: transactions.amount,
						type: transactions.type,
						bucket: transactions.bucket,
						envelopeId: transactions.envelopeId,
						classificationConfidence: transactions.classificationConfidence,
						isUserReviewed: transactions.isUserReviewed,
					})
					.from(transactions)
					.where(whereClause)
					.orderBy(desc(transactions.date), desc(transactions.id))
					.limit(limit + 1);

				const hasMore = rows.length > limit;
				const visibleRows = hasMore ? rows.slice(0, limit) : rows;
				const lastRow = visibleRows[visibleRows.length - 1] ?? null;

				return Response.json(
					{
						rows: visibleRows,
						nextCursor:
							hasMore && lastRow
								? {
									beforeDate: lastRow.date.toISOString(),
									beforeId: lastRow.id,
								}
								: null,
					},
					{ status: 200 },
				);
			},
		},
	},
});

const clampLimit = (value: number): number => {
	if (!Number.isFinite(value)) return 50;
	const normalized = Math.floor(value);
	if (normalized < 1) return 1;
	if (normalized > 200) return 200;
	return normalized;
};
