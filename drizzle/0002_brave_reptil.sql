PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_hash` text NOT NULL,
	`parser_version` text DEFAULT 'v1' NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`success_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`failure_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`imported_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "imports_row_count_non_negative" CHECK("__new_imports"."row_count" >= 0),
	CONSTRAINT "imports_success_count_non_negative" CHECK("__new_imports"."success_count" >= 0),
	CONSTRAINT "imports_duplicate_count_non_negative" CHECK("__new_imports"."duplicate_count" >= 0),
	CONSTRAINT "imports_failure_count_non_negative" CHECK("__new_imports"."failure_count" >= 0),
	CONSTRAINT "imports_count_totals_match" CHECK("__new_imports"."row_count" = "__new_imports"."success_count" + "__new_imports"."duplicate_count" + "__new_imports"."failure_count")
);
--> statement-breakpoint
INSERT INTO `__new_imports`("id", "user_id", "account_id", "file_name", "file_hash", "parser_version", "row_count", "success_count", "duplicate_count", "failure_count", "error_message", "status", "imported_at") SELECT "id", "user_id", "account_id", "file_name", "file_hash", "parser_version", "row_count", "success_count", "duplicate_count", "failure_count", "error_message", "status", "imported_at" FROM `imports`;--> statement-breakpoint
DROP TABLE `imports`;--> statement-breakpoint
ALTER TABLE `__new_imports` RENAME TO `imports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `imports_file_hash_idx` ON `imports` (`file_hash`);