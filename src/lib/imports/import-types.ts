import type { importErrorCode, imports } from "#/db/schema";

export type ImportStatus = (typeof imports.$inferSelect)["status"];
export type ImportRecord = typeof imports.$inferSelect;

export type CreateImportInput = {
	userId: string;
	accountId: string;
	fileName: string;
	fileHash: string;
	parserVersion?: string;
};

type BaseImportOutcomeMetadata = {
	rowCount: number;
	successCount: number;
	duplicateCount: number;
	failureCount: number;
};

export type ImportOutcomeMetadata = BaseImportOutcomeMetadata & {
	errorMessage?: string | null;
};

export type FailedImportOutcomeMetadata = BaseImportOutcomeMetadata & {
	errorMessage: string;
};

export type AllowedImportTransition =
	| {
			from: "pending";
			to: "processing";
	  }
	| {
			from: "processing";
			to: "processed" | "failed";
	  };

export type TransitionStatusInput = AllowedImportTransition & {
	importId: string;
	metadata?: ImportOutcomeMetadata;
};

export interface ImportRepository {
	insertPending(input: CreateImportInput): Promise<ImportRecord>;
	findById(importId: string): Promise<ImportRecord | null>;
	transitionStatus(input: TransitionStatusInput): Promise<ImportRecord | null>;
}

export type ImportErrorCode = (typeof importErrorCode)[number];

export type ImportErrorRecord = {
	rowNumber: number;
	errorCode: ImportErrorCode;
	errorMessage: string;
	rawRow?: Record<string, string>;
};
