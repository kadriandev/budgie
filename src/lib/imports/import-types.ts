import type { imports } from "#/db/schema";

export type ImportStatus = (typeof imports.$inferSelect)["status"];
export type ImportRecord = typeof imports.$inferSelect;

export type CreateImportInput = {
	userId: string;
	accountId: string;
	fileName: string;
	fileHash: string;
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
};

export interface ImportRepository {
	insertPending(input: CreateImportInput): Promise<ImportRecord>;
	findById(importId: string): Promise<ImportRecord | null>;
	transitionStatus(input: TransitionStatusInput): Promise<ImportRecord | null>;
}
