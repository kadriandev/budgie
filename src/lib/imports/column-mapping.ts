export const expectedImportFields = [
	"date",
	"description",
	"amount",
	"merchantName",
] as const;

export type ExpectedImportField = (typeof expectedImportFields)[number];

export type ColumnMapping = Partial<Record<ExpectedImportField, string>>;

export const suggestColumnMapping = (
	headers: string[],
	secondRowValues?: Record<string, string>,
): ColumnMapping => {
	const mapping: ColumnMapping = {};
	if (!secondRowValues) return mapping;

	const columns = headers.map((header) => ({
		header,
		value: (secondRowValues[header] ?? "").trim(),
	}));

	const used = new Set<string>();

	const pick = (predicate: (value: string) => boolean): string | undefined => {
		const found = columns.find(
			(column) => !used.has(column.header) && predicate(column.value),
		);

		if (!found) return undefined;
		used.add(found.header);
		return found.header;
	};

	mapping.date = pick((value) => isDateLike(value));
	mapping.amount = pick((value) => isAmountLike(value));
	mapping.description = pick((value) => isDescriptionLike(value));
	mapping.merchantName = pick((value) => isMerchantLike(value));

	for (const field of expectedImportFields) {
		if (mapping[field]) continue;
		const fallback = columns.find((column) => !used.has(column.header));
		if (fallback) {
			mapping[field] = fallback.header;
			used.add(fallback.header);
		}
	}

	return mapping;
};

const isDateLike = (value: string): boolean => {
	if (!value) return false;
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) ||
		/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(value)
	);
};

const isAmountLike = (value: string): boolean => {
	if (!value) return false;
	const normalized = value
		.replace(/[$,]/g, "")
		.replace(/^\((.*)\)$/, "-$1")
		.trim();
	return /^[-+]?\d+(\.\d+)?$/.test(normalized);
};

const isDescriptionLike = (value: string): boolean => {
	if (!value) return false;
	if (isDateLike(value) || isAmountLike(value)) return false;
	return value.length >= 3;
};

const isMerchantLike = (value: string): boolean => {
	if (!value) return false;
	if (isDateLike(value) || isAmountLike(value)) return false;
	return value.length >= 2;
};

export const validateColumnMapping = (
	mapping: ColumnMapping,
): { isValid: boolean; errors: string[] } => {
	const errors: string[] = [];

	if (!mapping.date) errors.push("Date column is required.");
	if (!mapping.description) errors.push("Description column is required.");
	if (!mapping.amount) errors.push("Amount column is required.");

	const selectedHeaders = Object.values(mapping).filter(
		(header): header is string => Boolean(header),
	);
	const uniqueHeaders = new Set(selectedHeaders);

	if (selectedHeaders.length !== uniqueHeaders.size) {
		errors.push("Each mapped field must use a unique CSV column.");
	}

	return {
		isValid: errors.length === 0,
		errors,
	};
};
