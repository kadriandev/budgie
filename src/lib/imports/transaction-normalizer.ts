import type { transactionType } from "#/db/schema";

import type { ParsedCsvRow } from "./csv-parser";

type TransactionType = (typeof transactionType)[number];

export type NormalizedTransactionRow = {
	rowNumber: number;
	date: Date;
	merchantName: string | null;
	description: string;
	amount: number;
	type: TransactionType;
	raw: Record<string, string>;
};

export type RowNormalizationError = {
	rowNumber: number;
	message: string;
};

const DATE_KEYS = ["date", "transaction date", "posted date"];
const DESCRIPTION_KEYS = ["description", "memo", "details"];
const MERCHANT_KEYS = ["merchant", "merchant name", "payee"];
const AMOUNT_KEYS = ["amount", "transaction amount"];
const DEBIT_KEYS = ["debit", "withdrawal"];
const CREDIT_KEYS = ["credit", "deposit"];

export const normalizeTransactionRow = (
	row: ParsedCsvRow,
): NormalizedTransactionRow | RowNormalizationError => {
	const getValue = (keys: string[]): string | null => {
		for (const key of keys) {
			const found = findByHeader(row.values, key);
			if (found !== null) return found;
		}
		return null;
	};

	const dateValue = getValue(DATE_KEYS);
	const descriptionValue = getValue(DESCRIPTION_KEYS);
	const merchantValue = getValue(MERCHANT_KEYS);

	if (!dateValue) {
		return { rowNumber: row.rowNumber, message: "Missing date column value" };
	}

	if (!descriptionValue) {
		return {
			rowNumber: row.rowNumber,
			message: "Missing description column value",
		};
	}

	const parsedDate = new Date(dateValue);
	if (Number.isNaN(parsedDate.getTime())) {
		return { rowNumber: row.rowNumber, message: `Invalid date: ${dateValue}` };
	}

	const directAmount = getValue(AMOUNT_KEYS);
	const debitAmount = getValue(DEBIT_KEYS);
	const creditAmount = getValue(CREDIT_KEYS);

	const amount =
		directAmount !== null
			? parseMoneyValue(directAmount)
			: parseDebitCreditAmount(debitAmount, creditAmount);

	if (amount === null) {
		return {
			rowNumber: row.rowNumber,
			message: "Missing or invalid amount value",
		};
	}

	const normalizedType = inferTransactionType(amount, descriptionValue);

	return {
		rowNumber: row.rowNumber,
		date: parsedDate,
		merchantName:
			merchantValue && merchantValue.length > 0 ? merchantValue : null,
		description: descriptionValue,
		amount,
		type: normalizedType,
		raw: row.values,
	};
};

const findByHeader = (
	values: Record<string, string>,
	key: string,
): string | null => {
	const match = Object.entries(values).find(
		([header]) => header.trim().toLowerCase() === key,
	);
	if (!match) return null;
	const value = match[1].trim();
	return value.length > 0 ? value : null;
};

const parseDebitCreditAmount = (
	debitAmount: string | null,
	creditAmount: string | null,
): number | null => {
	const debit = debitAmount ? parseMoneyValue(debitAmount) : null;
	const credit = creditAmount ? parseMoneyValue(creditAmount) : null;

	if (debit !== null && credit !== null) {
		if (debit > 0 && credit > 0) return null;
		if (debit > 0) return -Math.abs(debit);
		if (credit > 0) return Math.abs(credit);
	}

	if (debit !== null) return -Math.abs(debit);
	if (credit !== null) return Math.abs(credit);
	return null;
};

const parseMoneyValue = (value: string): number | null => {
	const normalized = value
		.replace(/[$,]/g, "")
		.replace(/^\((.*)\)$/, "-$1")
		.trim();

	if (normalized.length === 0) return null;

	const parsed = Number(normalized);
	return Number.isFinite(parsed) ? parsed : null;
};

const inferTransactionType = (
	amount: number,
	description: string,
): TransactionType => {
	const lowerDescription = description.toLowerCase();
	if (lowerDescription.includes("transfer")) return "transfer";
	return amount < 0 ? "debit" : "credit";
};
