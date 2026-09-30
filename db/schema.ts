import { integer, sqliteTable, text, index, primaryKey } from "drizzle-orm/sqlite-core";
export const requestLimits = sqliteTable("request_limits", {
  owner: text("owner").primaryKey(),
  window: integer("window").notNull(),
  count: integer("count").notNull(),
});
export const agreements = sqliteTable(
  "agreements",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    version: integer("version").notNull(),
    data: text("data").notNull(),
  },
  (table) => [index("agreements_owner").on(table.owner)],
);
export const evidenceFiles = sqliteTable(
  "evidence_files",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    agreementId: text("agreement_id").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    digest: text("digest").notNull(),
    size: integer("size").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("evidence_files_content").on(
      table.owner,
      table.agreementId,
      table.digest,
      table.name,
    ),
  ],
);

/**
 * Human-readable payment handles. A tag resolves to an on-chain address, so
 * nobody has to read hex to pay someone — but the transfer itself is still an
 * ordinary on-chain transfer to the resolved address.
 *
 * A tag is only written after the claimant proves control of the address by
 * signing the claim, so the directory cannot be used to point someone else's
 * name at your account.
 */
export const tags = sqliteTable(
  "tags",
  {
    tag: text("tag").primaryKey(),
    address: text("address").notNull(),
    owner: text("owner").notNull(),
    displayName: text("display_name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("tags_address").on(table.address)],
);

/**
 * Payments made through this app, kept so the history has something to show.
 *
 * The chain is the authority on whether a payment settled, but the node caps
 * log queries at a hundred blocks, so past transfers cannot be rediscovered
 * from it. This table records what the app itself sent; each row is confirmed
 * against the chain by hash rather than trusted, and it is not a claim to be a
 * complete view of the account's activity.
 */
export const payments = sqliteTable(
  "payments",
  {
    hash: text("hash").primaryKey(),
    owner: text("owner").notNull(),
    fromAddress: text("from_address").notNull(),
    toAddress: text("to_address").notNull(),
    toTag: text("to_tag"),
    amount: text("amount").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("payments_owner").on(table.owner, table.createdAt)],
);

/**
 * Metadata for agreements that live on chain.
 *
 * The contract holds the money and decides who may do what; it stores only
 * hashes of the scope and the acceptance criteria, because names, addresses
 * and descriptions of someone's home do not belong in public state. This table
 * holds the readable text those hashes cover, so the app can show people what
 * they agreed to and prove it matches what the contract recorded.
 *
 * No balance is stored here. Money is read from the chain, every time.
 */
export const liveAgreements = sqliteTable(
  "live_agreements",
  {
    id: text("id").primaryKey(),
    owner: text("owner").notNull(),
    chainId: integer("chain_id").notNull(),
    escrow: text("escrow").notNull(),
    onchainId: text("onchain_id").notNull(),
    title: text("title").notNull(),
    scope: text("scope").notNull(),
    payerAddress: text("payer_address").notNull(),
    workerAddress: text("worker_address").notNull(),
    verifierAddress: text("verifier_address").notNull(),
    workerTag: text("worker_tag"),
    verifierTag: text("verifier_tag"),
    milestones: text("milestones").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("live_agreements_owner").on(table.owner, table.createdAt),
    // Lets a genuine participant — the on-chain worker or verifier, proven by
    // a signature rather than by having created the row — be found without
    // scanning every agreement any account has ever recorded.
    index("live_agreements_payer").on(table.payerAddress),
    index("live_agreements_worker").on(table.workerAddress),
    index("live_agreements_verifier").on(table.verifierAddress),
  ],
);

/**
 * Authenticated shareable invitations.
 *
 * Lets a participant generate a secure share link for an agreement role.
 * Counterparties inspect full agreement terms before claiming their role with
 * a passkey signature.
 */
export const agreementInvitations = sqliteTable(
  "agreement_invitations",
  {
    token: text("token").primaryKey(),
    agreementId: text("agreement_id").notNull(),
    role: text("role").notNull(), // 'worker' | 'verifier' | 'mediator'
    targetTag: text("target_tag"),
    expiresAt: text("expires_at").notNull(),
    claimedBy: text("claimed_by"),
    status: text("status").notNull(), // 'pending' | 'accepted' | 'revoked'
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("agreement_invitations_agreement").on(table.agreementId),
    index("agreement_invitations_status").on(table.status),
  ],
);

/** Readable digital-work policy; the contract remains the payment authority. */
export const digitalJobs = sqliteTable(
  "digital_jobs",
  {
    id: text("id").primaryKey(),
    onchainId: text("onchain_id").notNull(),
    title: text("title").notNull(),
    policyJson: text("policy_json").notNull(),
    policyHash: text("policy_hash").notNull(),
    payerAddress: text("payer_address").notNull(),
    workerAddress: text("worker_address").notNull(),
    verifierA: text("verifier_a").notNull(),
    verifierB: text("verifier_b").notNull(),
    verifierC: text("verifier_c").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("digital_jobs_payer").on(table.payerAddress),
    index("digital_jobs_worker").on(table.workerAddress),
    index("digital_jobs_verifier_a").on(table.verifierA),
    index("digital_jobs_verifier_b").on(table.verifierB),
    index("digital_jobs_verifier_c").on(table.verifierC),
  ],
);

export const digitalSubmissions = sqliteTable("digital_submissions", {
  jobId: text("job_id").notNull(),
  version: integer("version").notNull(),
  evidenceHash: text("evidence_hash").notNull(),
  manifestJson: text("manifest_json").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.jobId, table.version] })]);

export const digitalVerificationRuns = sqliteTable("digital_verification_runs", {
  jobId: text("job_id").notNull(),
  version: integer("version").notNull(),
  state: text("state").notNull(),
  reportJson: text("report_json"),
  reportHash: text("report_hash"),
  voteTx: text("vote_tx"),
  updatedAt: text("updated_at").notNull(),
}, (table) => [primaryKey({ columns: [table.jobId, table.version] })]);

export const digitalManualVotes = sqliteTable("digital_manual_votes", {
  jobId: text("job_id").notNull(),
  version: integer("version").notNull(),
  verifierAddress: text("verifier_address").notNull(),
  pass: integer("pass").notNull(),
  notes: text("notes").notNull(),
  reportHash: text("report_hash").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [primaryKey({ columns: [table.jobId, table.version, table.verifierAddress] })]);

/**
 * Hiring links: a job the client has written but not yet put on chain,
 * because both escrow contracts fix the worker's address at creation. The
 * link lets someone take the job first; the client then creates it for them.
 */
export const jobOffers = sqliteTable("job_offers", {
  token: text("token").primaryKey(),
  kind: text("kind").notNull(),
  owner: text("owner").notNull(),
  clientAddress: text("client_address").notNull(),
  title: text("title").notNull(),
  draftJson: text("draft_json").notNull(),
  status: text("status").notNull(),
  takerAddress: text("taker_address"),
  jobId: text("job_id"),
  /** 1 when the client chose to show it on the public job board. */
  listed: integer("listed").notNull().default(0),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("job_offers_client").on(table.clientAddress),
  index("job_offers_taker").on(table.takerAddress),
]);

/** People who have offered to review work for a fee. */
export const reviewers = sqliteTable("reviewers", {
  address: text("address").primaryKey(),
  owner: text("owner").notNull(),
  skills: text("skills").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

/** Messages between the people on one job. Readable only by them. */
export const jobMessages = sqliteTable("job_messages", {
  id: text("id").primaryKey(),
  jobKind: text("job_kind").notNull(),
  jobId: text("job_id").notNull(),
  authorAddress: text("author_address").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("job_messages_job").on(table.jobKind, table.jobId, table.createdAt)]);
