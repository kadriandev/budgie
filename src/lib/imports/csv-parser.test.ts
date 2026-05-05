import { describe, expect, it } from "vitest";

import { parseCsvText } from "./csv-parser";

describe("parseCsvText", () => {
	it("parses headers and data rows", () => {
		const csv = "date,description,amount\n2026-05-01,Coffee,-4.25\n";
		const result = parseCsvText(csv);

		expect(result.headers).toEqual(["date", "description", "amount"]);
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.rowNumber).toBe(2);
		expect(result.rows[0]?.values.description).toBe("Coffee");
	});

	it("handles quoted commas and escaped quotes", () => {
		const csv =
			'date,description,amount\n2026-05-01,"Coffee, Bakery ""Downtown""",-12.70\n';
		const result = parseCsvText(csv);

		expect(result.rows[0]?.values.description).toBe(
			'Coffee, Bakery "Downtown"',
		);
	});

	it("handles blank lines and CRLF", () => {
		const csv = "date,description,amount\r\n\r\n2026-05-01,Coffee,-4.25\r\n";
		const result = parseCsvText(csv);
		expect(result.rows).toHaveLength(1);
	});

	it("strips UTF-8 BOM from first header", () => {
		const csv = "\uFEFFdate,description,amount\n2026-05-01,Coffee,-4.25\n";
		const result = parseCsvText(csv);
		expect(result.headers[0]).toBe("date");
		expect(result.rows[0]?.values.date).toBe("2026-05-01");
	});

	it("assigns fallback headers for empty header cells", () => {
		const csv = "date,,amount,\n2026-05-01,Coffee,-4.25,test\n";
		const result = parseCsvText(csv);
		expect(result.headers).toEqual(["date", "column_2", "amount", "column_4"]);
		expect(result.rows[0]?.values.column_2).toBe("Coffee");
		expect(result.rows[0]?.values.column_4).toBe("test");
	});
});
