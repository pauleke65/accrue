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
