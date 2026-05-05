import { describe, expect, it } from "vitest";

import {
	UploadValidationError,
	parseImportUploadRequest,
} from "./upload-validation";

const makeRequest = ({
	userId,
	accountId = "account-1",
	file,
	parserVersion,
}: {
	userId?: string;
	accountId?: string;
	file?: File;
	parserVersion?: string;
}) => {
	const formData = new FormData();
	if (accountId !== undefined) formData.set("accountId", accountId);
	if (file) formData.set("file", file);
	if (parserVersion) formData.set("parserVersion", parserVersion);

	const headers = new Headers();
	if (userId) headers.set("x-user-id", userId);

	return new Request("http://localhost/api/imports", {
		method: "POST",
		headers,
		body: formData,
	});
};

describe("parseImportUploadRequest", () => {
	it("parses valid request and computes file hash", async () => {
		const request = makeRequest({
			userId: "user-1",
			parserVersion: "v2",
			file: new File(["a,b\n1,2\n"], "transactions.csv", { type: "text/csv" }),
		});

		const result = await parseImportUploadRequest(request);

		expect(result.userId).toBe("user-1");
		expect(result.accountId).toBe("account-1");
		expect(result.parserVersion).toBe("v2");
		expect(result.fileName).toBe("transactions.csv");
		expect(result.fileHash).toHaveLength(64);
	});

	it("rejects missing auth header", async () => {
		const request = makeRequest({
			file: new File(["x"], "transactions.csv", { type: "text/csv" }),
		});

		await expect(parseImportUploadRequest(request)).rejects.toBeInstanceOf(
			UploadValidationError,
		);
	});

	it("rejects unsupported file type", async () => {
		const request = makeRequest({
			userId: "user-1",
			file: new File(["{}"], "transactions.json", {
				type: "application/json",
			}),
		});

		await expect(parseImportUploadRequest(request)).rejects.toThrow(
			"unsupported file type",
		);
	});
});
