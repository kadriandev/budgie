import { createHash } from "node:crypto";

const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
	"text/csv",
	"application/csv",
	"application/vnd.ms-excel",
]);

export class UploadValidationError extends Error {
	constructor(
		public readonly status: number,
		message: string,
	) {
		super(message);
		this.name = "UploadValidationError";
	}
}

export type ValidatedImportUpload = {
	userId: string;
	accountId: string;
	fileName: string;
	fileHash: string;
	parserVersion: string;
};

export const parseImportUploadRequest = async (
	request: Request,
): Promise<ValidatedImportUpload> => {
	const userId = request.headers.get("x-user-id")?.trim();

	if (!userId) {
		throw new UploadValidationError(
			401,
			"Missing authentication header x-user-id",
		);
	}

	const formData = await request.formData();
	const accountId = formData.get("accountId");
	const parserVersion = formData.get("parserVersion");
	const file = formData.get("file");

	if (typeof accountId !== "string" || accountId.trim().length === 0) {
		throw new UploadValidationError(400, "accountId is required");
	}

	if (!(file instanceof File)) {
		throw new UploadValidationError(400, "file is required");
	}

	if (file.size <= 0) {
		throw new UploadValidationError(400, "file is empty");
	}

	if (file.size > MAX_UPLOAD_SIZE_BYTES) {
		throw new UploadValidationError(413, "file exceeds 5MB upload limit");
	}

	const contentType = file.type.toLowerCase();
	if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
		throw new UploadValidationError(415, "unsupported file type; expected CSV");
	}

	const fileBuffer = Buffer.from(await file.arrayBuffer());
	const fileHash = createHash("sha256").update(fileBuffer).digest("hex");

	return {
		userId,
		accountId: accountId.trim(),
		fileName: file.name,
		fileHash,
		parserVersion:
			typeof parserVersion === "string" && parserVersion.trim().length > 0
				? parserVersion.trim()
				: "v1",
	};
};
