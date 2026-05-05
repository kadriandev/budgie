import type { TransitionStatusInput } from "./import-types";

export class InvalidImportStatusTransitionError extends Error {
	constructor({
		importId,
		from,
		to,
	}: TransitionStatusInput) {
		super(`Invalid import status transition for ${importId}: ${from} -> ${to}`);
		this.name = "InvalidImportStatusTransitionError";
	}
}

export class ImportNotFoundError extends Error {
	constructor(importId: string) {
		super(`Import not found: ${importId}`);
		this.name = "ImportNotFoundError";
	}
}
