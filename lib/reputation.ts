// lib/reputation.ts
// "Trust is earned, not assumed": votes are weighted by each voter's track
// record, and a report only becomes "confirmed" when reputation-weighted
// community suspicion AND independent evidence agree. A sincere majority
// with no supporting evidence is never enough on its own -- it is labeled
// "disputed" instead. The AI counsel is shown beside these, but never
// decides status.

import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { users, votes } from "../db/schema.js";

export const MIN_DISTINCT_VOTERS = 3; // demo-friendly threshold (raise for real use)
export const SUSPICION_THRESHOLD = 1.5; // reputation-weighted score needed

export type ReportStatus = "unverified" | "disputed" | "confirmed" | "verified_legit";

export const SCAM_VOTES = new Set(["seen_too", "looks_fake"]);

// Weighted "suspicion score" = sum(reputation) of seen_too/looks_fake votes
//                              - sum(reputation) of looks_legit votes
export async function computeCommunityScore(reportId: string) {
  const rows = await db
    .select({ voteType: votes.voteType, reputation: users.reputation })
    .from(votes)
    .innerJoin(users, eq(votes.userId, users.id))
    .where(eq(votes.reportId, reportId));

  let score = 0;
  for (const v of rows) {
    if (SCAM_VOTES.has(v.voteType)) score += v.reputation;
    else if (v.voteType === "looks_legit") score -= v.reputation;
  }
  return { score: Math.round(score * 100) / 100 || 0, distinctVoters: rows.length };
}

// The "two-track" mechanism -- evidence over agreement. Sentiment and
// evidence are computed separately and must agree before anything is
// publicly confirmed or verified.
export function decideStatus({
  communityScore,
  distinctVoters,
  evidenceVerdict,
}: {
  communityScore: number;
  distinctVoters: number;
  evidenceVerdict: string;
}): ReportStatus {
  const enoughVoices = distinctVoters >= MIN_DISTINCT_VOTERS;
  const strongSuspicion = enoughVoices && communityScore >= SUSPICION_THRESHOLD;
  const strongTrust = enoughVoices && communityScore <= -SUSPICION_THRESHOLD;

  if (strongSuspicion && evidenceVerdict === "suspicious") return "confirmed";
  if (strongTrust && evidenceVerdict === "clean") return "verified_legit";
  if (strongSuspicion && evidenceVerdict === "clean") return "disputed"; // crowd says scam, evidence disagrees
  if (strongTrust && evidenceVerdict === "suspicious") return "disputed"; // crowd trusts it, evidence disagrees
  if (!enoughVoices) return "unverified";
  return "disputed"; // votes and/or evidence mixed or inconclusive
}

// Called once, when a moderator first settles a report: reward or penalize
// each voter based on whether their testimony matched the outcome.
export async function updateReputationAfterResolution(reportId: string, finalWasScam: boolean) {
  const rows = await db.select().from(votes).where(eq(votes.reportId, reportId));
  for (const vote of rows) {
    const wasAccurate = SCAM_VOTES.has(vote.voteType) === finalWasScam;
    // Small, bounded adjustment so no single vote swings anyone's weight too fast.
    const delta = wasAccurate ? 0.1 : -0.1;
    await db
      .update(users)
      .set({
        reputation: sql`LEAST(5.0, GREATEST(0.2, ${users.reputation} + ${delta}))`,
        votesCast: sql`${users.votesCast} + 1`,
        votesAccurate: sql`${users.votesAccurate} + ${wasAccurate ? 1 : 0}`,
      })
      .where(eq(users.id, vote.userId));
  }
}
