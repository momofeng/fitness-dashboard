import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
export const vaults = sqliteTable("vaults", {
  id: text("id").primaryKey(), authHash: text("auth_hash").notNull(), revision: integer("revision").notNull(),
  objectKey: text("object_key").notNull(), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
});
export const revisions = sqliteTable("revisions", {
  vaultId: text("vault_id").notNull().references(() => vaults.id), revision: integer("revision").notNull(),
  objectKey: text("object_key").notNull(), createdAt: integer("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.vaultId, t.revision] })]);
export const pairings = sqliteTable("pairings", {
  id: text("id").primaryKey(), vaultId: text("vault_id").notNull().references(() => vaults.id),
  authHash: text("auth_hash").notNull(), packet: text("packet").notNull(), expiresAt: integer("expires_at").notNull(),
});
export const rateLimits = sqliteTable("rate_limits", {
  id: text("id").primaryKey(), hits: integer("hits").notNull(), expiresAt: integer("expires_at").notNull(),
});
