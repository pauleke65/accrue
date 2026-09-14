import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
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
    index("live_agreements_worker").on(table.workerAddress),
    index("live_agreements_verifier").on(table.verifierAddress),
  ],
);
