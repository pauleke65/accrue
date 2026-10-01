CREATE TABLE IF NOT EXISTS `agreement_parties` (
	`agreement_id` text NOT NULL,
	`owner` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`agreement_id`, `owner`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agreement_parties_owner` ON `agreement_parties` (`owner`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `live_agreements_payer` ON `live_agreements` (`payer_address`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `live_agreements_worker` ON `live_agreements` (`worker_address`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `live_agreements_verifier` ON `live_agreements` (`verifier_address`);
