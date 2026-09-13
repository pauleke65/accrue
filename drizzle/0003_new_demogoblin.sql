CREATE TABLE `tags` (
	`tag` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`owner` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tags_address` ON `tags` (`address`);