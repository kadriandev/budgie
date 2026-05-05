import {
	ImportNotFoundError,
	InvalidImportStatusTransitionError,
} from "./import-errors";
import type {
	CreateImportInput,
	ImportRecord,
	ImportRepository,
	TransitionStatusInput,
} from "./import-types";

export class ImportService {
	constructor(private readonly repository: ImportRepository) {}

	createImport(input: CreateImportInput): Promise<ImportRecord> {
		return this.repository.insertPending(input);
	}

	markImportProcessing(importId: string): Promise<ImportRecord> {
		return this.transitionOrThrow({
			importId,
			from: "pending",
			to: "processing",
		});
	}

	markImportProcessed(importId: string): Promise<ImportRecord> {
		return this.transitionOrThrow({
			importId,
			from: "processing",
			to: "processed",
		});
	}

	markImportFailed(importId: string): Promise<ImportRecord> {
		return this.transitionOrThrow({
			importId,
			from: "processing",
			to: "failed",
		});
	}

	private async transitionOrThrow(
		input: TransitionStatusInput,
	): Promise<ImportRecord> {
		const updatedImport = await this.repository.transitionStatus(input);

		if (!updatedImport) {
			const existingImport = await this.repository.findById(input.importId);

			if (!existingImport) {
				throw new ImportNotFoundError(input.importId);
			}

			throw new InvalidImportStatusTransitionError(input);
		}

		return updatedImport;
	}
}
