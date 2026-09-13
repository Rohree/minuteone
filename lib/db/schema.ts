import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import type { BusinessConfig } from "../config/schema";

export const leadStatusValues = [
  "pending",
  "in_progress",
  "done",
  "failed",
] as const;

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  /** "scrypt:<saltHex>:<hashHex>" — see lib/auth/password.ts. */
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const sessions = sqliteTable("sessions", {
  /** Opaque random token — also the session cookie's value. */
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Public URL key for the embeddable form: /f/[slug]. */
  slug: text("slug").notNull().unique(),
  /**
   * The whole BusinessConfig (business identity, questions, hours, scoring) as one JSON blob,
   * validated by businessConfigSchema on every read/write — every consumer (loadBusinessConfig,
   * buildCallTask, scoreAnswers) already treats it as one atomic object, never partial fields.
   */
  config: text("config", { mode: "json" }).$type<BusinessConfig>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),

  // Intake
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  notes: text("notes"),
  source: text("source").notNull().default("hosted_form"),
  consent: integer("consent", { mode: "boolean" }).notNull(),
  /**
   * Nullable at the DB level on purpose (no real migration-file workflow exists in this project
   * — see lib/db/seed.ts) — every write path resolves and supplies one; dispatch/review fall back
   * to the seeded default business id defensively for any legacy row that predates this column.
   */
  businessId: text("business_id").references(() => businesses.id),

  // Dispatch state
  status: text("status", { enum: leadStatusValues }).notNull().default("pending"),
  retryCount: integer("retry_count").notNull().default(0),

  // LeadCard (populated once a call completes)
  outcome: text("outcome"),
  answers: text("answers", { mode: "json" }).$type<{ questionId: string; value: string }[]>(),
  score: integer("score"),
  summary: text("summary"),
  nextAction: text("next_action"),
  callId: text("call_id"),
  durationS: integer("duration_s"),
  transcriptRef: text("transcript_ref"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export type LeadRow = typeof leads.$inferSelect;
export type NewLeadRow = typeof leads.$inferInsert;
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type BusinessRow = typeof businesses.$inferSelect;
export type NewBusinessRow = typeof businesses.$inferInsert;
