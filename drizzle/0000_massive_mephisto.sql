CREATE TABLE `agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`payer_id` text NOT NULL,
	`earner_email` text NOT NULL,
	`verifier_email` text,
	`version` integer NOT NULL,
	`data` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agreements_payer` ON `agreements` (`payer_id`);--> statement-breakpoint
CREATE INDEX `agreements_earner_email` ON `agreements` (`earner_email`);--> statement-breakpoint
CREATE INDEX `agreements_verifier_email` ON `agreements` (`verifier_email`);--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `request_limits` (
	`owner` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`wallet_address` text NOT NULL,
	`name` text,
	`created_at` integer NOT NULL
);
