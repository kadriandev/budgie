import {
	ImportNotFoundError,
	InvalidImportStatusTransitionError,
} from "./import-errors";
import type {
	CreateImportInput,
	FailedImportOutcomeMetadata,
	ImportOutcomeMetadata,
	ImportRecord,
	ImportRepository,
	TransitionStatusInput,
} from "./import-types";

type Deps = {
	onImportProcessed?: (record: ImportRecord) => Promise<void>;
};

export class ImportService {
	constructor(
		private readonly repository: ImportRepository,
		private readonly deps: Deps = {},
	) {}

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

	async markImportProcessed(
		importId: string,
		metadata: ImportOutcomeMetadata,
	): Promise<ImportRecord> {
		assertValidOutcomeMetadata(metadata);

		return this.transitionOrThrow({
			importId,
			from: "processing",
			to: "processed",
			metadata,
		}).then(async (record) => {
			try {
				await this.deps.onImportProcessed?.(record);
			} catch {
				// Side effects should never invalidate a successful status transition.
			}
			return record;
		});
	}

	async markImportFailed(
		importId: string,
		metadata: FailedImportOutcomeMetadata,
	): Promise<ImportRecord> {
		assertValidOutcomeMetadata(metadata);

		if (metadata.errorMessage.trim().length === 0) {
			throw new Error(
				"Failed import metadata requires a non-empty errorMessage",
			);
		}

		return this.transitionOrThrow({
			importId,
			from: "processing",
			to: "failed",
			metadata,
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

const assertValidOutcomeMetadata = (metadata: ImportOutcomeMetadata): void => {
	const counts = [
		metadata.rowCount,
		metadata.successCount,
		metadata.duplicateCount,
		metadata.failureCount,
	];

	for (const count of counts) {
		if (!Number.isInteger(count) || count < 0) {
			throw new Error("Import outcome counts must be non-negative integers");
		}
	}

	const total =
		metadata.successCount + metadata.duplicateCount + metadata.failureCount;

	if (metadata.rowCount !== total) {
		throw new Error(
			"Import outcome metadata is inconsistent: rowCount must equal successCount + duplicateCount + failureCount",
		);
	}
};
