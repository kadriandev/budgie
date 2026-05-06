import { describe, expect, it, vi } from "vitest";

import {
	EnvelopeAllocationError,
	getEnvelopeAllocations,
	upsertEnvelopeAllocation,
} from "./envelope-allocations";

const buildDeps = () => ({
	findOwnedEnvelope: vi.fn(),
	upsertAllocation: vi.fn(),
	listAllocations: vi.fn(),
});

describe("upsertEnvelopeAllocation", () => {
	it("upserts allocation for owned envelope", async () => {
		const deps = buildDeps();
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue({ id: "env-1" });
		vi.mocked(deps.upsertAllocation).mockResolvedValue({
			id: "alloc-1",
			envelopeId: "env-1",
			month: "2026-06",
			plannedAmount: 250,
		});

		const result = await upsertEnvelopeAllocation(
			{
				userId: "user-1",
				envelopeId: "env-1",
				month: "2026-06",
				plannedAmount: 250,
			},
			deps,
		);

		expect(result.id).toBe("alloc-1");
	});

	it("rejects invalid month format", async () => {
		const deps = buildDeps();

		await expect(
			upsertEnvelopeAllocation(
				{
					userId: "user-1",
					envelopeId: "env-1",
					month: "06-2026",
					plannedAmount: 250,
				},
				deps,
			),
		).rejects.toBeInstanceOf(EnvelopeAllocationError);
	});

	it("rejects envelope not owned by user", async () => {
		const deps = buildDeps();
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue(null);

		await expect(
			upsertEnvelopeAllocation(
				{
					userId: "user-1",
					envelopeId: "env-1",
					month: "2026-06",
					plannedAmount: 250,
				},
				deps,
			),
		).rejects.toMatchObject({ status: 404 });
	});
});

describe("getEnvelopeAllocations", () => {
	it("returns allocations for owned envelope", async () => {
		const deps = buildDeps();
		vi.mocked(deps.findOwnedEnvelope).mockResolvedValue({ id: "env-1" });
		vi.mocked(deps.listAllocations).mockResolvedValue([
			{ id: "alloc-1", envelopeId: "env-1", month: "2026-06", plannedAmount: 250 },
		]);

		const result = await getEnvelopeAllocations("user-1", "env-1", deps);
		expect(result).toHaveLength(1);
		expect(result[0]?.month).toBe("2026-06");
	});
});
