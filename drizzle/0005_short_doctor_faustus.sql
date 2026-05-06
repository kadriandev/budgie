PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_envelope_budget_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`envelope_id` text NOT NULL,
	`month` text NOT NULL,
	`planned_amount` real NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`envelope_id`) REFERENCES `envelopes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "envelope_budget_allocations_month_format" CHECK("__new_envelope_budget_allocations"."month" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]' AND CAST(substr("__new_envelope_budget_allocations"."month", 6, 2) AS INTEGER) BETWEEN 1 AND 12),
	CONSTRAINT "envelope_budget_allocations_planned_amount_non_negative" CHECK("__new_envelope_budget_allocations"."planned_amount" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_envelope_budget_allocations`("id", "envelope_id", "month", "planned_amount", "created_at", "updated_at") SELECT "id", "envelope_id", "month", "planned_amount", "created_at", "updated_at" FROM `envelope_budget_allocations`;--> statement-breakpoint
DROP TABLE `envelope_budget_allocations`;--> statement-breakpoint
ALTER TABLE `__new_envelope_budget_allocations` RENAME TO `envelope_budget_allocations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `envelope_budget_allocations_envelope_month_idx` ON `envelope_budget_allocations` (`envelope_id`,`month`);