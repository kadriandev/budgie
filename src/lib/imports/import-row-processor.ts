import type { ParsedCsvRow } from "./csv-parser";
import type { ImportErrorRecord } from "./import-types";
import {
	type NormalizedTransactionRow,
	normalizeTransactionRow,
} from "./transaction-normalizer";

export type ImportRowProcessingResult = {
	validRows: NormalizedTransactionRow[];
	errors: ImportErrorRecord[];
};

export const processImportRows = (
	rows: ParsedCsvRow[],
): ImportRowProcessingResult => {
	const validRows: NormalizedTransactionRow[] = [];
	const errors: ImportErrorRecord[] = [];

	for (const row of rows) {
		const normalizedOrError = normalizeTransactionRow(row);

		if ("message" in normalizedOrError) {
			errors.push({
				rowNumber: normalizedOrError.rowNumber,
				errorCode: "normalization_error",
				errorMessage: normalizedOrError.message,
				rawRow: row.values,
			});
			continue;
		}

		const validationError = validateNormalizedRow(normalizedOrError);
		if (validationError) {
			errors.push({
				rowNumber: normalizedOrError.rowNumber,
				errorCode: "validation_error",
				errorMessage: validationError,
				rawRow: row.values,
			});
			continue;
		}

		validRows.push(normalizedOrError);
	}

	return { validRows, errors };
};

const validateNormalizedRow = (
	row: NormalizedTransactionRow,
): string | null => {
	if (row.description.trim().length === 0) {
		return "Description is empty";
	}

	if (!Number.isFinite(row.amount)) {
		return "Amount is not a finite number";
	}

	if (row.amount === 0) {
		return "Amount cannot be zero";
	}

	const now = new Date();
	if (row.date.getTime() > now.getTime()) {
		return "Date cannot be in the future";
	}

	return null;
};
