// routes/reports.js
// Core endpoints: submit a suspicious message, list/filter the dashboard,
// view a single report with full evidence + votes, submit a rebuttal,
// and a moderator "resolve" endpoint that closes the loop and updates
// everyone's reputation (see lib/reputation.js).

const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../lib/db");
const { redactPII, extractSignals } = require("../lib/redact");
const { runEvidenceCheck } = require("../lib/evidence");
const {
  computeCommunityScore,
  decideStatus,
  updateReputationAfterResolution,
} = require("../lib/reputation");

const router = express.Router();

// POST /api/reports
// body: { userId, messageText, category, city, language }
router.post("/", async (req, res) => {
  const { userId, messageText, category, city, language } = req.body;

  if (!userId || !messageText || !category || !city || !language) {
    return res.status(400).json({ error: "Missing required fields." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return res.status(404).json({ error: "User not found. Please log in again." });

  const { domain, phone } = extractSignals(messageText);
  const redactedText = redactPII(messageText);
  const id = nanoid();

  // Insert as 'pending' while evidence check runs, then update.
  db.prepare(
    `INSERT INTO reports
      (id, submitted_by, message_text, category, city, language,
       extracted_domain, extracted_phone, evidence_verdict, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unverified')`
  ).run(id, userId, redactedText, category, city, language, domain, phone);

  db.prepare(
    "UPDATE users SET reports_submitted = reports_submitted + 1 WHERE id = ?"
  ).run(userId);

  // Run independent evidence check (this can take a couple seconds --
  // that's expected and worth showing live in your demo).
  const { verdict, results } = await runEvidenceCheck({
    domain,
    phone,
    rawText: messageText,
  });

  db.prepare(
    "UPDATE reports SET evidence_verdict = ?, evidence_details = ? WHERE id = ?"
  ).run(verdict, JSON.stringify(results), id);

  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
  res.json({ report: withParsedEvidence(report) });
});

// GET /api/reports?city=&language=&status=&category=
router.get("/", (req, res) => {
  const { city, language, status, category } = req.query;
  let query = "SELECT * FROM reports WHERE 1=1";
  const params = [];

  if (city) {
    query += " AND city = ?";
    params.push(city);
  }
  if (language) {
    query += " AND language = ?";
    params.push(language);
  }
  if (status) {
    query += " AND status = ?";
    params.push(status);
  }
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }
  query += " ORDER BY created_at DESC";

  const reports = db.prepare(query).all(...params);
  res.json({ reports: reports.map(withParsedEvidence) });
});

// GET /api/reports/:id  (full detail incl. votes)
router.get("/:id", (req, res) => {
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found." });

  const votes = db
    .prepare(
      `SELECT v.vote_type, v.created_at, u.username, u.reputation
       FROM votes v JOIN users u ON v.user_id = u.id
       WHERE v.report_id = ?`
    )
    .all(req.params.id);

  const rebuttals = db
    .prepare(
      `SELECT r.explanation, r.created_at, u.username
       FROM rebuttals r JOIN users u ON r.submitted_by = u.id
       WHERE r.report_id = ?`
    )
    .all(req.params.id);

  const { score, distinctVoters } = computeCommunityScore(req.params.id);

  res.json({
    report: withParsedEvidence(report),
    votes,
    rebuttals,
    communityScore: score,
    distinctVoters,
  });
});

// POST /api/reports/:id/rebuttal   body: { userId, explanation }
router.post("/:id/rebuttal", (req, res) => {
  const { userId, explanation } = req.body;
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found." });
  if (!userId || !explanation) return res.status(400).json({ error: "Missing fields." });

  const id = nanoid();
  db.prepare(
    "INSERT INTO rebuttals (id, report_id, submitted_by, explanation) VALUES (?, ?, ?, ?)"
  ).run(id, req.params.id, userId, explanation);

  // A rebuttal always pauses a report back to "unverified" pending review,
  // even if it had reached "confirmed" -- this is the appeals/due-process
  // safeguard described in the project design.
  db.prepare("UPDATE reports SET status = 'unverified' WHERE id = ?").run(req.params.id);

  res.json({ ok: true });
});

// POST /api/reports/:id/resolve   body: { finalWasScam: true|false }
// Manual moderator action for the demo -- this is the "human review
// checkpoint" the project design calls for before anything is treated
// as permanently settled. Updates every voter's reputation accordingly.
router.post("/:id/resolve", (req, res) => {
  const { finalWasScam } = req.body;
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found." });

  db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(
    finalWasScam ? "confirmed" : "verified_legit",
    req.params.id
  );

  updateReputationAfterResolution(req.params.id, Boolean(finalWasScam));

  res.json({ ok: true });
});

function withParsedEvidence(report) {
  return {
    ...report,
    evidence_details: report.evidence_details ? JSON.parse(report.evidence_details) : null,
    ai_verdict: report.ai_verdict ? JSON.parse(report.ai_verdict) : null,
  };
}

module.exports = router;
