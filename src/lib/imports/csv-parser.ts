export type ParsedCsvRow = {
	rowNumber: number;
	values: Record<string, string>;
};

export type ParseCsvResult = {
	headers: string[];
	rows: ParsedCsvRow[];
};

export const parseCsvText = (input: string): ParseCsvResult => {
	const rows = tokenizeCsv(input)
		.map((row) => row.map((value) => value.trim()))
		.filter((row) => row.some((value) => value.length > 0));

	if (rows.length === 0) {
		return { headers: [], rows: [] };
	}

	const [rawHeaders, ...dataRows] = rows;
	const headers = rawHeaders.map((header, index) => {
		const cleaned = header.trim().replace(/^\uFEFF/, "");
		return cleaned.length > 0 ? cleaned : `column_${index + 1}`;
	});

	const mappedRows: ParsedCsvRow[] = dataRows.map((rawRow, rowIndex) => {
		const values: Record<string, string> = {};

		for (let i = 0; i < headers.length; i += 1) {
			values[headers[i]] = rawRow[i] ?? "";
		}

		return {
			rowNumber: rowIndex + 2,
			values,
		};
	});

	return {
		headers,
		rows: mappedRows,
	};
};

const tokenizeCsv = (input: string): string[][] => {
	const rows: string[][] = [];
	let currentRow: string[] = [];
	let currentCell = "";
	let inQuotes = false;

	for (let index = 0; index < input.length; index += 1) {
		const char = input[index];

		if (char === '"') {
			if (inQuotes && input[index + 1] === '"') {
				currentCell += '"';
				index += 1;
				continue;
			}

			inQuotes = !inQuotes;
			continue;
		}

		if (!inQuotes && char === ",") {
			currentRow.push(currentCell);
			currentCell = "";
			continue;
		}

		if (!inQuotes && (char === "\n" || char === "\r")) {
			if (char === "\r" && input[index + 1] === "\n") {
				index += 1;
			}

			currentRow.push(currentCell);
			rows.push(currentRow);
			currentRow = [];
			currentCell = "";
			continue;
		}

		currentCell += char;
	}

	if (currentCell.length > 0 || currentRow.length > 0) {
		currentRow.push(currentCell);
		rows.push(currentRow);
	}

	return rows;
};
