CREATE TABLE `import_errors` (
	`id` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`error_code` text NOT NULL,
	`error_message` text NOT NULL,
	`raw_row` text,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `import_errors_import_row_idx` ON `import_errors` (`import_id`,`row_number`);