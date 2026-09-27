// routes/votes.js
// Casting a vote never "confirms" anything by itself. It recomputes the
// reputation-weighted community score and re-runs decideStatus(), which
// only moves a report to 'confirmed' when votes AND evidence agree.
// Once enough votes are in for the first time, this also triggers the
// AI-agent verification pass (lib/ai_verify.js) -- a genuinely separate,
// third signal on top of the crowd and the rule-based evidence check.

const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../lib/db");
const { computeCommunityScore, decideStatus, MIN_DISTINCT_VOTERS } = require("../lib/reputation");
const { runAIVerification } = require("../lib/ai_verify");

const router = express.Router();

// POST /api/votes   body: { reportId, userId, voteType }
// voteType: 'seen_too' | 'looks_fake' | 'looks_legit'
router.post("/", async (req, res) => {
  const { reportId, userId, voteType } = req.body;
  const validTypes = ["seen_too", "looks_fake", "looks_legit"];

  if (!reportId || !userId || !validTypes.includes(voteType)) {
    return res.status(400).json({ error: "Invalid vote." });
  }

  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
  if (!report) return res.status(404).json({ error: "Report not found." });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found." });

  if (report.submitted_by === userId) {
    return res.status(400).json({ error: "You can't vote on your own submission." });
  }

  try {
    db.prepare(
      "INSERT INTO votes (id, report_id, user_id, vote_type) VALUES (?, ?, ?, ?)"
    ).run(nanoid(), reportId, userId, voteType);
  } catch (err) {
    return res.status(409).json({ error: "You already voted on this report." });
  }

  const { score, distinctVoters } = computeCommunityScore(reportId);
  const newStatus = decideStatus({
    communityScore: score,
    distinctVoters,
    evidenceVerdict: report.evidence_verdict,
  });

  db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(newStatus, reportId);

  // Trigger the AI-agent pass the first time this report reaches the
  // minimum number of distinct voters and hasn't been AI-checked yet.
  // This keeps it a one-time "final counsel" step rather than re-running
  // on every single vote.
  if (distinctVoters >= MIN_DISTINCT_VOTERS && !report.ai_verdict) {
    const evidenceDetails = report.evidence_details ? JSON.parse(report.evidence_details) : null;
    const aiResult = await runAIVerification({
      messageText: report.message_text,
      category: report.category,
      evidenceVerdict: report.evidence_verdict,
      evidenceDetails,
      communityScore: score,
      distinctVoters,
    });
    db.prepare("UPDATE reports SET ai_verdict = ? WHERE id = ?").run(
      JSON.stringify(aiResult),
      reportId
    );
  }

  const updated = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
  res.json({
    report: {
      ...updated,
      ai_verdict: updated.ai_verdict ? JSON.parse(updated.ai_verdict) : null,
    },
    communityScore: score,
    distinctVoters,
  });
});

module.exports = router;
