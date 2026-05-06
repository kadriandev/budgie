import { createFileRoute } from "@tanstack/react-router";
import { UploadIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";

import {
	type ColumnMapping,
	type ExpectedImportField,
	expectedImportFields,
	suggestColumnMapping,
	validateColumnMapping,
} from "#/lib/imports/column-mapping";
import { parseCsvText } from "#/lib/imports/csv-parser";

type TransactionRow = {
	date: string;
	description: string;
	merchantName: string;
	amount: string;
};

const demoTransactions: TransactionRow[] = [
	{
		date: "2026-05-01",
		description: "Coffee",
		merchantName: "Blue Bottle",
		amount: "-4.25",
	},
	{
		date: "2026-05-02",
		description: "Paycheck",
		merchantName: "Acme Inc",
		amount: "+2000.00",
	},
];

export const Route = createFileRoute("/transactions")({
	component: TransactionsPage,
});

function TransactionsPage() {
	const [fileName, setFileName] = useState<string | null>(null);
	const [headers, setHeaders] = useState<string[]>([]);
	const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([]);
	const [mapping, setMapping] = useState<ColumnMapping>({});
	const [parseError, setParseError] = useState<string | null>(null);
	const [isMapperOpen, setIsMapperOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const mappingValidation = useMemo(
		() => validateColumnMapping(mapping),
		[mapping],
	);
	const secondRowValues = previewRows[0] ?? {};

	const mappedPreviewRows = useMemo(
		() =>
			previewRows.map((row) => ({
				date: mapping.date ? (row[mapping.date] ?? "") : "",
				description: mapping.description
					? (row[mapping.description] ?? "")
					: "",
				amount: mapping.amount ? (row[mapping.amount] ?? "") : "",
				merchantName: mapping.merchantName
					? (row[mapping.merchantName] ?? "")
					: "",
			})),
		[previewRows, mapping],
	);

	const onFileSelected = async (file: File | undefined) => {
		if (!file) return;

		setParseError(null);
		setFileName(file.name);
		setIsMapperOpen(true);

		const text = await file.text();
		const parsed = parseCsvText(text);

		if (parsed.headers.length === 0) {
			setHeaders([]);
			setPreviewRows([]);
			setMapping({});
			setParseError("No CSV headers found in selected file.");
			return;
		}

		setHeaders(parsed.headers);
		const rows = parsed.rows.slice(0, 5).map((row) => row.values);
		setPreviewRows(rows);
		setMapping(suggestColumnMapping(parsed.headers, rows[0]));
	};

	const updateMappedField = (field: ExpectedImportField, value: string) => {
		if (value === "__none__") {
			setMapping((current) => ({
				...current,
				[field]: undefined,
			}));
			return;
		}

		setMapping((current) => ({
			...current,
			[field]: value.length > 0 ? value : undefined,
		}));
	};

	return (
		<div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Transactions</h1>
					<p className="mt-1 text-sm text-gray-600">
						Upload CSV files and map columns before import.
					</p>
				</div>
				<Button type="button" onClick={() => fileInputRef.current?.click()}>
					<UploadIcon data-icon="inline-start" />
					Import CSV
				</Button>
				<input
					ref={fileInputRef}
					type="file"
					accept=".csv,text/csv"
					className="hidden"
					onChange={(event) => {
						const file = event.target.files?.[0];
						onFileSelected(file);
					}}
				/>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Recent Transactions</CardTitle>
					<CardDescription>
						Current transactions in your account.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Date</TableHead>
								<TableHead>Description</TableHead>
								<TableHead>Merchant</TableHead>
								<TableHead>Amount</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{demoTransactions.map((row) => (
								<TableRow key={`${row.date}-${row.description}`}>
									<TableCell>{row.date}</TableCell>
									<TableCell>{row.description}</TableCell>
									<TableCell>{row.merchantName}</TableCell>
									<TableCell>{row.amount}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>

			<Dialog
				open={fileName ? isMapperOpen : false}
				onOpenChange={setIsMapperOpen}
			>
				<DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
					<DialogHeader>
						<DialogTitle>Column Mapper</DialogTitle>
						<DialogDescription>Selected file: {fileName}</DialogDescription>
					</DialogHeader>

					{parseError ? (
						<p className="text-sm text-destructive">{parseError}</p>
					) : (
						<>
							<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
								{expectedImportFields.map((field) => (
									<div key={field} className="flex flex-col gap-1 text-sm">
										<span className="font-medium">{field}</span>
										<Select
											value={mapping[field] ?? ""}
											onValueChange={(value) => updateMappedField(field, value)}
										>
											<SelectTrigger className="w-full" id={`map-${field}`}>
												<SelectValue placeholder="Select CSV column" />
											</SelectTrigger>
											<SelectContent>
												<SelectGroup>
													<SelectItem value="__none__">
														Select CSV column
													</SelectItem>
													{headers.map((header) => (
														<SelectItem
															key={`${field}-${header}`}
															value={header}
														>
															{header}
															{secondRowValues[header]
																? ` (${secondRowValues[header]})`
																: ""}
														</SelectItem>
													))}
												</SelectGroup>
											</SelectContent>
										</Select>
									</div>
								))}
							</div>

							{mappingValidation.errors.length > 0 ? (
								<ul className="list-disc pl-5 text-sm text-destructive">
									{mappingValidation.errors.map((error) => (
										<li key={error}>{error}</li>
									))}
								</ul>
							) : (
								<p className="text-sm text-green-700">
									Mapping looks good. Ready for import.
								</p>
							)}

							{mappedPreviewRows.length > 0 ? (
								<div className="flex flex-col gap-2">
									<h3 className="text-sm font-semibold">
										Mapped Preview (what will be inserted)
									</h3>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>date</TableHead>
												<TableHead>description</TableHead>
												<TableHead>amount</TableHead>
												<TableHead>merchantName</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{mappedPreviewRows.map((row) => (
												<TableRow
													key={`${row.date}-${row.description}-${row.amount}-${row.merchantName}`}
												>
													<TableCell>{row.date}</TableCell>
													<TableCell>{row.description}</TableCell>
													<TableCell>{row.amount}</TableCell>
													<TableCell>{row.merchantName}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							) : null}
						</>
					)}

					<DialogFooter showCloseButton />
				</DialogContent>
			</Dialog>
		</div>
	);
}
