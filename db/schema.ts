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
    payerId: text("payer_id").notNull(),
    earnerEmail: text("earner_email").notNull(),
    verifierEmail: text("verifier_email"),
    version: integer("version").notNull(),
    data: text("data").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("agreements_payer").on(table.payerId),
    index("agreements_earner_email").on(table.earnerEmail),
    index("agreements_verifier_email").on(table.verifierEmail),
  ],
);
export const evidenceFiles = sqliteTable("evidence_files", {
  id: text("id").primaryKey(),
  owner: text("owner").notNull(),
  agreementId: text("agreement_id").notNull(),
  name: text("name").notNull(),
  mime: text("mime").notNull(),
  digest: text("digest").notNull(),
  size: integer("size").notNull(),
  createdAt: text("created_at").notNull(),
});
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  walletAddress: text("wallet_address").notNull(),
  name: text("name"),
  createdAt: integer("created_at").notNull(),
});
