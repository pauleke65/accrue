CREATE TABLE `agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`version` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agreements_owner` ON `agreements` (`owner`);--> statement-breakpoint
CREATE TABLE `evidence_files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`agreement_id` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`digest` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
