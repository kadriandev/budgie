import { createFileRoute } from "@tanstack/react-router";
import { and, eq } from "drizzle-orm";

import { db } from "#/db";
import { accounts } from "#/db/schema";
import { importRepository } from "#/db/repositories/import-repository";
import { ImportService } from "#/lib/imports";
import {
	UploadValidationError,
	parseImportUploadRequest,
} from "#/lib/imports/upload-validation";

const importService = new ImportService(importRepository);

export const Route = createFileRoute("/api/imports")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					const payload = await parseImportUploadRequest(request);

					const account = await db
						.select({ id: accounts.id })
						.from(accounts)
						.where(
							and(
								eq(accounts.id, payload.accountId),
								eq(accounts.userId, payload.userId),
							),
						)
						.get();

					if (!account) {
						return Response.json({ error: "account not found" }, { status: 403 });
					}

					const createdImport = await importService.createImport(payload);

					return Response.json(
						{
							id: createdImport.id,
							status: createdImport.status,
							fileName: createdImport.fileName,
							importedAt: createdImport.importedAt,
						},
						{ status: 201 },
					);
				} catch (error) {
					if (error instanceof UploadValidationError) {
						return Response.json({ error: error.message }, { status: error.status });
					}

					return Response.json({ error: "failed to create import" }, { status: 500 });
				}
			},
		},
	},
});
