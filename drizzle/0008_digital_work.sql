CREATE TABLE IF NOT EXISTS digital_jobs (
  id TEXT PRIMARY KEY,
  onchain_id TEXT NOT NULL,
  title TEXT NOT NULL,
  policy_json TEXT NOT NULL,
  policy_hash TEXT NOT NULL,
  payer_address TEXT NOT NULL,
  worker_address TEXT NOT NULL,
  verifier_a TEXT NOT NULL,
  verifier_b TEXT NOT NULL,
  verifier_c TEXT NOT NULL,
  created_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS digital_jobs_payer ON digital_jobs (payer_address);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS digital_jobs_worker ON digital_jobs (worker_address);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS digital_jobs_verifier_a ON digital_jobs (verifier_a);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS digital_jobs_verifier_b ON digital_jobs (verifier_b);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS digital_jobs_verifier_c ON digital_jobs (verifier_c);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS digital_submissions (
  job_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  evidence_hash TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, version)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS digital_verification_runs (
  job_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  state TEXT NOT NULL,
  report_json TEXT,
  report_hash TEXT,
  vote_tx TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (job_id, version)
);
