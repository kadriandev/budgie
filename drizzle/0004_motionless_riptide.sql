CREATE TABLE `envelope_budget_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`envelope_id` text NOT NULL,
	`month` text NOT NULL,
	`planned_amount` real NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`envelope_id`) REFERENCES `envelopes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `envelope_budget_allocations_envelope_month_idx` ON `envelope_budget_allocations` (`envelope_id`,`month`);