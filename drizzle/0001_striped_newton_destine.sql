CREATE TABLE `request_limits` (
	`owner` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL
);
