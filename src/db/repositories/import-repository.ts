import { and, eq } from "drizzle-orm";

import { db } from "#/db";
import { imports } from "#/db/schema";
import type {
	CreateImportInput,
	ImportRecord,
	ImportRepository,
	TransitionStatusInput,
} from "#/lib/imports/import-types";

export const importRepository: ImportRepository = {
	async insertPending(input: CreateImportInput): Promise<ImportRecord> {
		return db
			.insert(imports)
			.values({
				id: crypto.randomUUID(),
				userId: input.userId,
				accountId: input.accountId,
				fileName: input.fileName,
				fileHash: input.fileHash,
				status: "pending",
			})
			.returning()
			.get();
	},

	async findById(importId: string): Promise<ImportRecord | null> {
		return (
			db.select().from(imports).where(eq(imports.id, importId)).get() ?? null
		);
	},

	async transitionStatus(
		input: TransitionStatusInput,
	): Promise<ImportRecord | null> {
		return (
			db
				.update(imports)
				.set({ status: input.to })
				.where(
					and(eq(imports.id, input.importId), eq(imports.status, input.from)),
				)
				.returning()
				.get() ?? null
		);
	},
};
