CREATE TABLE IF NOT EXISTS job_offers (
  token TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  owner TEXT NOT NULL,
  client_address TEXT NOT NULL,
  title TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  status TEXT NOT NULL,
  taker_address TEXT,
  job_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS job_offers_client ON job_offers (client_address);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS job_offers_taker ON job_offers (taker_address);
