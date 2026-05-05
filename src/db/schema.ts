import { relations, sql } from "drizzle-orm";
import {
	index,
	integer,
	check,
	real,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const budgetBucket = ["needs", "wants", "savings"] as const;
export const envelopeType = ["fixed", "flexible", "goal"] as const;
export const transactionType = ["debit", "credit", "transfer"] as const;
export const importStatus = [
	"pending",
	"processing",
	"processed",
	"failed",
] as const;

// Users are optional if this is single-user self-hosted,
// but useful if you ever support households/multiple profiles.
export const users = sqliteTable("users", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	currency: text("currency").notNull().default("USD"),

	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
});

export const accounts = sqliteTable("accounts", {
	id: text("id").primaryKey(),
	userId: text("user_id")
		.notNull()
		.references(() => users.id, { onDelete: "cascade" }),

	name: text("name").notNull(),
	institution: text("institution"),
	type: text("type").notNull(), // checking, savings, credit_card, cash, etc.

	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`CURRENT_TIMESTAMP`),
});

export const imports = sqliteTable(
	"imports",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		accountId: text("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),

		fileName: text("file_name").notNull(),
		fileHash: text("file_hash").notNull(),
		parserVersion: text("parser_version").notNull().default("v1"),

		rowCount: integer("row_count").notNull().default(0),
		successCount: integer("success_count").notNull().default(0),
		duplicateCount: integer("duplicate_count").notNull().default(0),
		failureCount: integer("failure_count").notNull().default(0),

		errorMessage: text("error_message"),

		status: text("status", { enum: importStatus }).notNull().default("pending"),

		importedAt: integer("imported_at", { mode: "timestamp" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("imports_file_hash_idx").on(table.fileHash),
		check("imports_row_count_non_negative", sql`${table.rowCount} >= 0`),
		check("imports_success_count_non_negative", sql`${table.successCount} >= 0`),
		check(
			"imports_duplicate_count_non_negative",
			sql`${table.duplicateCount} >= 0`,
		),
		check("imports_failure_count_non_negative", sql`${table.failureCount} >= 0`),
		check(
			"imports_count_totals_match",
			sql`${table.rowCount} = ${table.successCount} + ${table.duplicateCount} + ${table.failureCount}`,
		),
	],
);

export const envelopes = sqliteTable(
	"envelopes",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		name: text("name").notNull(),

		// fixed: rent, bills
		// flexible: groceries, dining, fun
		// goal: vacation, laptop, car, emergency fund
		type: text("type", { enum: envelopeType }).notNull(),

		// needs / wants / savings
		bucket: text("bucket", { enum: budgetBucket }).notNull(),

		// Soft monthly guideline, not a hard cap.
		monthlyLimit: real("monthly_limit"),

		// For ordering in UI.
		sortOrder: integer("sort_order").notNull().default(0),

		isArchived: integer("is_archived", { mode: "boolean" })
			.notNull()
			.default(false),

		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [index("envelopes_user_idx").on(table.userId)],
);

export const goals = sqliteTable("goals", {
	id: text("id").primaryKey(),

	envelopeId: text("envelope_id")
		.notNull()
		.references(() => envelopes.id, { onDelete: "cascade" }),

	targetAmount: real("target_amount").notNull(),
	currentAmount: real("current_amount").notNull().default(0),

	targetDate: integer("target_date", { mode: "timestamp" }),

	// Example: app suggests this based on target amount/date.
	suggestedMonthlyContribution: real("suggested_monthly_contribution"),

	isCompleted: integer("is_completed", { mode: "boolean" })
		.notNull()
		.default(false),
});

export const transactions = sqliteTable(
	"transactions",
	{
		id: text("id").primaryKey(),

		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		accountId: text("account_id")
			.notNull()
			.references(() => accounts.id, { onDelete: "cascade" }),

		importId: text("import_id").references(() => imports.id, {
			onDelete: "set null",
		}),

		envelopeId: text("envelope_id").references(() => envelopes.id, {
			onDelete: "set null",
		}),

		date: integer("date", { mode: "timestamp" }).notNull(),

		merchantName: text("merchant_name"),
		description: text("description").notNull(),

		amount: real("amount").notNull(),

		// debit = spending, credit = income/refund/payment, transfer = movement
		type: text("type", { enum: transactionType }).notNull(),

		// Top-level 50/30/20 classification.
		bucket: text("bucket", { enum: budgetBucket }),

		// Confidence from auto-categorizer, 0 to 1.
		classificationConfidence: real("classification_confidence"),

		// True when user manually fixed category/envelope.
		isUserReviewed: integer("is_user_reviewed", { mode: "boolean" })
			.notNull()
			.default(false),

		// Used to detect duplicate CSV rows.
		fingerprint: text("fingerprint").notNull(),

		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("transactions_user_date_idx").on(table.userId, table.date),
		index("transactions_account_date_idx").on(table.accountId, table.date),
		uniqueIndex("transactions_fingerprint_idx").on(table.fingerprint),
	],
);

export const merchantRules = sqliteTable(
	"merchant_rules",
	{
		id: text("id").primaryKey(),

		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		// Example: "NETFLIX", "STARBUCKS", "AIR CANADA"
		pattern: text("pattern").notNull(),

		bucket: text("bucket", { enum: budgetBucket }).notNull(),

		envelopeId: text("envelope_id").references(() => envelopes.id, {
			onDelete: "set null",
		}),

		priority: integer("priority").notNull().default(0),

		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		index("merchant_rules_user_pattern_idx").on(table.userId, table.pattern),
	],
);

// Optional but useful for caching monthly dashboard data.
export const monthlySummaries = sqliteTable(
	"monthly_summaries",
	{
		id: text("id").primaryKey(),

		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		// Store as "2026-05"
		month: text("month").notNull(),

		income: real("income").notNull().default(0),

		needsTotal: real("needs_total").notNull().default(0),
		wantsTotal: real("wants_total").notNull().default(0),
		savingsTotal: real("savings_total").notNull().default(0),

		needsPercent: real("needs_percent").notNull().default(0),
		wantsPercent: real("wants_percent").notNull().default(0),
		savingsPercent: real("savings_percent").notNull().default(0),

		// 0 to 100, calculated by your app.
		alignmentScore: real("alignment_score"),

		calculatedAt: integer("calculated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("monthly_summaries_user_month_idx").on(
			table.userId,
			table.month,
		),
	],
);

export const envelopeMonthlySummaries = sqliteTable(
	"envelope_monthly_summaries",
	{
		id: text("id").primaryKey(),

		envelopeId: text("envelope_id")
			.notNull()
			.references(() => envelopes.id, { onDelete: "cascade" }),

		month: text("month").notNull(),

		plannedAmount: real("planned_amount"),
		actualAmount: real("actual_amount").notNull().default(0),

		// actual - planned
		variance: real("variance"),

		calculatedAt: integer("calculated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		uniqueIndex("envelope_monthly_summaries_envelope_month_idx").on(
			table.envelopeId,
			table.month,
		),
	],
);

export const usersRelations = relations(users, ({ many }) => ({
	accounts: many(accounts),
	envelopes: many(envelopes),
	transactions: many(transactions),
	imports: many(imports),
	merchantRules: many(merchantRules),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id],
	}),
	transactions: many(transactions),
	imports: many(imports),
}));

export const envelopesRelations = relations(envelopes, ({ one, many }) => ({
	user: one(users, {
		fields: [envelopes.userId],
		references: [users.id],
	}),
	goal: one(goals),
	transactions: many(transactions),
}));

export const goalsRelations = relations(goals, ({ one }) => ({
	envelope: one(envelopes, {
		fields: [goals.envelopeId],
		references: [envelopes.id],
	}),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
	user: one(users, {
		fields: [transactions.userId],
		references: [users.id],
	}),
	account: one(accounts, {
		fields: [transactions.accountId],
		references: [accounts.id],
	}),
	envelope: one(envelopes, {
		fields: [transactions.envelopeId],
		references: [envelopes.id],
	}),
	import: one(imports, {
		fields: [transactions.importId],
		references: [imports.id],
	}),
}));
