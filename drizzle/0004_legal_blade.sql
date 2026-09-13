CREATE TABLE `payments` (
	`hash` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`from_address` text NOT NULL,
	`to_address` text NOT NULL,
	`to_tag` text,
	`amount` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `payments_owner` ON `payments` (`owner`,`created_at`);