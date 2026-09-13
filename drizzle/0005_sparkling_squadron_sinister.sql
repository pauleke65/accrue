CREATE TABLE `live_agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`chain_id` integer NOT NULL,
	`escrow` text NOT NULL,
	`onchain_id` text NOT NULL,
	`title` text NOT NULL,
	`scope` text NOT NULL,
	`payer_address` text NOT NULL,
	`worker_address` text NOT NULL,
	`verifier_address` text NOT NULL,
	`worker_tag` text,
	`verifier_tag` text,
	`milestones` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `live_agreements_owner` ON `live_agreements` (`owner`,`created_at`);