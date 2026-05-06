export type UpsertEnvelopeAllocationInput = {
	userId: string;
	envelopeId: string;
	month: string;
	plannedAmount: number;
};

export type EnvelopeAllocationRecord = {
	id: string;
	envelopeId: string;
	month: string;
	plannedAmount: number;
};

type Deps = {
	findOwnedEnvelope: (
		envelopeId: string,
		userId: string,
	) => Promise<{ id: string } | null>;
	upsertAllocation: (
		input: UpsertEnvelopeAllocationInput,
	) => Promise<EnvelopeAllocationRecord>;
	listAllocations: (
		envelopeId: string,
	) => Promise<EnvelopeAllocationRecord[]>;
};

export class EnvelopeAllocationError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "EnvelopeAllocationError";
	}
}

export const upsertEnvelopeAllocation = async (
	input: UpsertEnvelopeAllocationInput,
	deps: Deps,
): Promise<EnvelopeAllocationRecord> => {
	assertValidMonth(input.month);

	if (!Number.isFinite(input.plannedAmount) || input.plannedAmount < 0) {
		throw new EnvelopeAllocationError(
			400,
			"plannedAmount must be a non-negative number",
		);
	}

	const envelope = await deps.findOwnedEnvelope(input.envelopeId, input.userId);
	if (!envelope) {
		throw new EnvelopeAllocationError(404, "envelope not found");
	}

	return deps.upsertAllocation(input);
};

export const getEnvelopeAllocations = async (
	userId: string,
	envelopeId: string,
	deps: Deps,
): Promise<EnvelopeAllocationRecord[]> => {
	const envelope = await deps.findOwnedEnvelope(envelopeId, userId);
	if (!envelope) {
		throw new EnvelopeAllocationError(404, "envelope not found");
	}

	return deps.listAllocations(envelopeId);
};

const assertValidMonth = (month: string): void => {
	if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
		throw new EnvelopeAllocationError(400, "month must be formatted as YYYY-MM");
	}
};
