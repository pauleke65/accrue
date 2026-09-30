CREATE TABLE IF NOT EXISTS job_messages (
  id TEXT PRIMARY KEY,
  job_kind TEXT NOT NULL,
  job_id TEXT NOT NULL,
  author_address TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS job_messages_job ON job_messages (job_kind, job_id, created_at);
