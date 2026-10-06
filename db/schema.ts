import { pgTable, text, real, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text().primaryKey(),
  username: text().notNull().unique(),
  reputation: real().notNull().default(1.0),
  reportsSubmitted: integer("reports_submitted").notNull().default(0),
  reportsAccurate: integer("reports_accurate").notNull().default(0),
  votesCast: integer("votes_cast").notNull().default(0),
  votesAccurate: integer("votes_accurate").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reports = pgTable(
  "reports",
  {
    id: text().primaryKey(),
    submittedBy: text("submitted_by").notNull().references(() => users.id),
    // Only the redacted text is ever stored.
    messageText: text("message_text").notNull(),
    category: text().notNull(),
    city: text().notNull(),
    language: text().notNull(),
    extractedDomain: text("extracted_domain"),
    // A one-way hash of the phone number, so repeat numbers can be matched
    // across reports without the number itself ever being stored.
    phoneHash: text("phone_hash"),
    // 'pending' | 'suspicious' | 'clean' | 'inconclusive'
    evidenceVerdict: text("evidence_verdict").notNull().default("pending"),
    evidenceDetails: jsonb("evidence_details"),
    // 'pending' | 'complete' | 'failed' -- Vidura's independent AI counsel
    aiStatus: text("ai_status").notNull().default("pending"),
    aiVerdict: jsonb("ai_verdict"),
    aiStartedAt: timestamp("ai_started_at", { withTimezone: true }),
    // 'unverified' | 'disputed' | 'confirmed' | 'verified_legit'
    status: text().notNull().default("unverified"),
    // Set when a moderator settles the report; cleared again if an appeal reopens it.
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedAsScam: boolean("resolved_as_scam"),
    // Reputations are adjusted only once per report, at its first settlement.
    reputationSettledAt: timestamp("reputation_settled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("reports_created_at_idx").on(t.createdAt),
    index("reports_phone_hash_idx").on(t.phoneHash),
  ]
);

export const votes = pgTable(
  "votes",
  {
    id: text().primaryKey(),
    reportId: text("report_id").notNull().references(() => reports.id),
    userId: text("user_id").notNull().references(() => users.id),
    // 'seen_too' | 'looks_fake' | 'looks_legit'
    voteType: text("vote_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("votes_report_user_idx").on(t.reportId, t.userId)]
);

export const rebuttals = pgTable("rebuttals", {
  id: text().primaryKey(),
  reportId: text("report_id").notNull().references(() => reports.id),
  submittedBy: text("submitted_by").notNull().references(() => users.id),
  explanation: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Report = typeof reports.$inferSelect;
export type User = typeof users.$inferSelect;
