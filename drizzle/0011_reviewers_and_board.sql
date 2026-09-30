CREATE TABLE IF NOT EXISTS reviewers (
  address TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  skills TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
ALTER TABLE job_offers ADD COLUMN listed INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS job_offers_listed ON job_offers (listed, status);
