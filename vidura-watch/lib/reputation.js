// lib/reputation.js
// This is the "Vidura Rank" logic: votes are weighted by each user's
// track record instead of counted equally, and a report only becomes
// "confirmed" when reputation-weighted community suspicion AND
// independent evidence (from evidence.js) agree. A sincere majority
// with no supporting evidence is never enough on its own -- it is
// labeled "disputed" instead of "confirmed".

const db = require("./db");

const MIN_DISTINCT_VOTERS = 3; // demo-friendly threshold (raise for real use)
const SUSPICION_THRESHOLD = 1.5; // reputation-weighted score needed

function getUser(userId) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

// Weighted "suspicion score" = sum(reputation) of seen_too/looks_fake votes
//                              - sum(reputation) of looks_legit votes
function computeCommunityScore(reportId) {
  const votes = db
    .prepare(
      `SELECT v.vote_type, u.reputation
       FROM votes v JOIN users u ON v.user_id = u.id
       WHERE v.report_id = ?`
    )
    .all(reportId);

  let score = 0;
  for (const v of votes) {
    if (v.vote_type === "seen_too" || v.vote_type === "looks_fake") {
      score += v.reputation;
    } else if (v.vote_type === "looks_legit") {
      score -= v.reputation;
    }
  }

  return { score, distinctVoters: votes.length };
}

// Decides the report's status by combining the weighted community score
// with the independent evidence verdict. This is the "two-track"
// mechanism: sentiment and evidence are computed separately and must
// agree before anything is publicly "confirmed".
function decideStatus({ communityScore, distinctVoters, evidenceVerdict }) {
  const strongSuspicion =
    distinctVoters >= MIN_DISTINCT_VOTERS && communityScore >= SUSPICION_THRESHOLD;
  const strongTrust =
    distinctVoters >= MIN_DISTINCT_VOTERS && communityScore <= -SUSPICION_THRESHOLD;

  if (strongSuspicion && evidenceVerdict === "suspicious") {
    return "confirmed"; // crowd + evidence agree it's a scam
  }
  if (strongTrust && evidenceVerdict === "clean") {
    return "verified_legit"; // crowd + evidence agree it's legitimate
  }
  if (strongSuspicion && evidenceVerdict === "clean") {
    return "disputed"; // crowd says scam, evidence disagrees -- do NOT confirm
  }
  if (strongTrust && evidenceVerdict === "suspicious") {
    return "disputed"; // crowd trusts it, evidence disagrees -- flag for review
  }
  if (distinctVoters < MIN_DISTINCT_VOTERS) {
    return "unverified"; // not enough independent input yet
  }
  return "disputed"; // votes and/or evidence are mixed/inconclusive
}

// After a report's true status is later confirmed by a human moderator
// (see routes/reports.js "resolve" endpoint), call this to reward/penalize
// each voter's reputation based on whether their vote matched reality.
function updateReputationAfterResolution(reportId, finalWasScam) {
  const votes = db
    .prepare("SELECT * FROM votes WHERE report_id = ?")
    .all(reportId);

  const update = db.prepare(
    `UPDATE users SET
       reputation = ?,
       votes_cast = votes_cast + 1,
       votes_accurate = votes_accurate + ?
     WHERE id = ?`
  );

  for (const vote of votes) {
    const user = getUser(vote.user_id);
    if (!user) continue;

    const votedScam = vote.vote_type === "seen_too" || vote.vote_type === "looks_fake";
    const wasAccurate = votedScam === finalWasScam;

    // Small, bounded reputation adjustment so no single vote swings
    // someone's weight too fast in either direction.
    const delta = wasAccurate ? 0.1 : -0.1;
    const newRep = Math.max(0.2, Math.min(5.0, user.reputation + delta));

    update.run(newRep, wasAccurate ? 1 : 0, user.id);
  }
}

module.exports = {
  computeCommunityScore,
  decideStatus,
  updateReputationAfterResolution,
  MIN_DISTINCT_VOTERS,
  SUSPICION_THRESHOLD,
};
