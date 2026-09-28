CREATE TABLE IF NOT EXISTS digital_manual_votes (
  job_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  verifier_address TEXT NOT NULL,
  pass INTEGER NOT NULL,
  notes TEXT NOT NULL,
  report_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, version, verifier_address)
);
