import type { ParsedCsvRow } from "./csv-parser";
import type { FingerprintContext } from "./fingerprint";
import { createTransactionFingerprint } from "./fingerprint";
import type { ImportErrorRecord } from "./import-types";
import {
	type NormalizedTransactionRow,
	normalizeTransactionRow,
} from "./transaction-normalizer";

export type ImportRowProcessingResult = {
	validRows: (NormalizedTransactionRow & { fingerprint: string })[];
	errors: ImportErrorRecord[];
	duplicateFingerprints: string[];
};

export type ProcessImportRowsOptions = {
	context: FingerprintContext;
	existingFingerprints?: Set<string>;
};

export const processImportRows = (
	rows: ParsedCsvRow[],
	options: ProcessImportRowsOptions,
): ImportRowProcessingResult => {
	const validRows: (NormalizedTransactionRow & { fingerprint: string })[] = [];
	const errors: ImportErrorRecord[] = [];
	const duplicateFingerprints: string[] = [];
	const seenFingerprints = new Set(options.existingFingerprints ?? []);

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

		const fingerprint = createTransactionFingerprint(
			normalizedOrError,
			options.context,
		);

		if (seenFingerprints.has(fingerprint)) {
			errors.push({
				rowNumber: normalizedOrError.rowNumber,
				errorCode: "duplicate_row",
				errorMessage: "Duplicate transaction row detected",
				rawRow: row.values,
			});
			duplicateFingerprints.push(fingerprint);
			continue;
		}

		seenFingerprints.add(fingerprint);

		validRows.push({
			...normalizedOrError,
			fingerprint,
		});
	}

	return { validRows, errors, duplicateFingerprints };
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
