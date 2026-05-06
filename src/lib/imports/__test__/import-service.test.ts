import { describe, expect, it, vi } from "vitest";

import {
	ImportNotFoundError,
	InvalidImportStatusTransitionError,
} from "../import-errors";
import { ImportService } from "../import-service";
import type {
	ImportOutcomeMetadata,
	ImportRecord,
	ImportRepository,
} from "../import-types";

const successfulMetadata: ImportOutcomeMetadata = {
	rowCount: 10,
	successCount: 8,
	duplicateCount: 1,
	failureCount: 1,
	errorMessage: null,
};

const failedMetadata: ImportOutcomeMetadata = {
	rowCount: 10,
	successCount: 3,
	duplicateCount: 2,
	failureCount: 5,
	errorMessage: "CSV malformed at row 9",
};

const makeImportRecord = (status: ImportRecord["status"]): ImportRecord => ({
	id: "import-1",
	userId: "user-1",
	accountId: "account-1",
	fileName: "transactions.csv",
	fileHash: "hash-1",
	parserVersion: "v2",
	rowCount: 10,
	successCount: 8,
	duplicateCount: 1,
	failureCount: 1,
	errorMessage: null,
	status,
	importedAt: new Date(2000, 0, 1),
});

const makeRepositoryMock = (): ImportRepository => ({
	insertPending: vi.fn(),
	findById: vi.fn(),
	transitionStatus: vi.fn(),
});

describe("ImportService", () => {
	it("creates a new import in pending status", async () => {
		const repository = makeRepositoryMock();
		const service = new ImportService(repository);

		const createdImport = makeImportRecord("pending");
		vi.mocked(repository.insertPending).mockResolvedValue(createdImport);

		const result = await service.createImport({
			accountId: "account-1",
			fileHash: "hash-1",
			fileName: "transactions.csv",
			parserVersion: "v2",
			userId: "user-1",
		});

		expect(repository.insertPending).toHaveBeenCalledWith({
			accountId: "account-1",
			fileHash: "hash-1",
			fileName: "transactions.csv",
			parserVersion: "v2",
			userId: "user-1",
		});
		expect(result).toEqual(createdImport);
	});

	it("transitions pending -> processing", async () => {
		const repository = makeRepositoryMock();
		const service = new ImportService(repository);

		vi.mocked(repository.transitionStatus).mockResolvedValue(
			makeImportRecord("processing"),
		);

		const result = await service.markImportProcessing("import-1");

		expect(repository.transitionStatus).toHaveBeenCalledWith({
			importId: "import-1",
			from: "pending",
			to: "processing",
		});
		expect(result).toEqual(makeImportRecord("processing"));
	});

	it("transitions processing -> processed and persists outcome metadata", async () => {
		const repository = makeRepositoryMock();
		const onImportProcessed = vi.fn().mockResolvedValue(undefined);
		const service = new ImportService(repository, { onImportProcessed });

		vi.mocked(repository.transitionStatus).mockResolvedValue(
			makeImportRecord("processed"),
		);

		const result = await service.markImportProcessed(
			"import-1",
			successfulMetadata,
		);

		expect(repository.transitionStatus).toHaveBeenCalledWith({
			importId: "import-1",
			from: "processing",
			to: "processed",
			metadata: successfulMetadata,
		});
		expect(onImportProcessed).toHaveBeenCalledWith(makeImportRecord("processed"));
		expect(result).toEqual(makeImportRecord("processed"));
	});

	it("does not trigger processed callback on failed transition", async () => {
		const repository = makeRepositoryMock();
		const onImportProcessed = vi.fn().mockResolvedValue(undefined);
		const service = new ImportService(repository, { onImportProcessed });

		vi.mocked(repository.transitionStatus).mockResolvedValue(
			makeImportRecord("failed"),
		);

		await service.markImportFailed("import-1", failedMetadata);
		expect(onImportProcessed).not.toHaveBeenCalled();
	});

	it("returns processed import even if processed callback throws", async () => {
		const repository = makeRepositoryMock();
		const onImportProcessed = vi.fn().mockRejectedValue(new Error("boom"));
		const service = new ImportService(repository, { onImportProcessed });

		vi.mocked(repository.transitionStatus).mockResolvedValue(
			makeImportRecord("processed"),
		);

		const result = await service.markImportProcessed(
			"import-1",
			successfulMetadata,
		);

		expect(result.status).toBe("processed");
	});

	it("transitions processing -> failed and persists failure metadata", async () => {
		const repository = makeRepositoryMock();
		const service = new ImportService(repository);

		vi.mocked(repository.transitionStatus).mockResolvedValue(
			makeImportRecord("failed"),
		);

		const result = await service.markImportFailed("import-1", failedMetadata);

		expect(repository.transitionStatus).toHaveBeenCalledWith({
			importId: "import-1",
			from: "processing",
			to: "failed",
			metadata: failedMetadata,
		});
		expect(result).toEqual(makeImportRecord("failed"));
	});

	it("throws when transition is invalid", async () => {
		const repository = makeRepositoryMock();
		const service = new ImportService(repository);

		vi.mocked(repository.transitionStatus).mockResolvedValue(null);
		vi.mocked(repository.findById).mockResolvedValue(
			makeImportRecord("pending"),
		);

		await expect(
			service.markImportProcessed("import-1", successfulMetadata),
		).rejects.toBeInstanceOf(InvalidImportStatusTransitionError);
	});

	it("throws import-not-found when transition target import does not exist", async () => {
		const repository = makeRepositoryMock();
		const service = new ImportService(repository);

		vi.mocked(repository.transitionStatus).mockResolvedValue(null);
		vi.mocked(repository.findById).mockResolvedValue(null);

		await expect(
			service.markImportProcessing("missing-import"),
		).rejects.toBeInstanceOf(ImportNotFoundError);
	});

	it("throws when pending -> processing transition fails", async () => {
		const repository = makeRepositoryMock();
		const service = new ImportService(repository);

		vi.mocked(repository.transitionStatus).mockResolvedValue(null);
		vi.mocked(repository.findById).mockResolvedValue(
			makeImportRecord("processed"),
		);

		await expect(
			service.markImportProcessing("import-1"),
		).rejects.toBeInstanceOf(InvalidImportStatusTransitionError);
	});

	it("throws when processing -> failed transition fails", async () => {
		const repository = makeRepositoryMock();
		const service = new ImportService(repository);

		vi.mocked(repository.transitionStatus).mockResolvedValue(null);
		vi.mocked(repository.findById).mockResolvedValue(
			makeImportRecord("processed"),
		);

		await expect(
			service.markImportFailed("import-1", failedMetadata),
		).rejects.toBeInstanceOf(InvalidImportStatusTransitionError);
	});

	it("throws when outcome metadata totals do not match", async () => {
		const repository = makeRepositoryMock();
		const service = new ImportService(repository);

		await expect(
			service.markImportProcessed("import-1", {
				rowCount: 10,
				successCount: 8,
				duplicateCount: 1,
				failureCount: 0,
				errorMessage: null,
			}),
		).rejects.toThrow(
			"rowCount must equal successCount + duplicateCount + failureCount",
		);
	});

	it("throws when failed metadata has empty error message", async () => {
		const repository = makeRepositoryMock();
		const service = new ImportService(repository);

		await expect(
			service.markImportFailed("import-1", {
				rowCount: 10,
				successCount: 3,
				duplicateCount: 2,
				failureCount: 5,
				errorMessage: " ",
			}),
		).rejects.toThrow("requires a non-empty errorMessage");
	});
});
