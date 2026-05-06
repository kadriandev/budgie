import { db } from "#/db";
import { importErrors } from "#/db/schema";
import type { ImportErrorRecord } from "#/lib/imports/import-types";

export const insertImportErrors = async (
	importId: string,
	errors: ImportErrorRecord[],
): Promise<void> => {
	if (errors.length === 0) return;

	await db.insert(importErrors).values(
		errors.map((error) => ({
			id: crypto.randomUUID(),
			importId,
			rowNumber: error.rowNumber,
			errorCode: error.errorCode,
			errorMessage: error.errorMessage,
			rawRow: error.rawRow ? JSON.stringify(error.rawRow) : null,
		})),
	);
};
