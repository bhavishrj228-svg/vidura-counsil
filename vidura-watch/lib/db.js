// lib/db.js
// Sets up a local SQLite database file (vidura_watch.db) and creates tables
// the first time the server runs. SQLite is used because it needs no
// separate database server -- perfect for a student project / demo.
// For production with many simultaneous users, you would swap this file
// for a hosted Postgres database (see README.md "Going to production").

const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "vidura_watch.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  reputation REAL NOT NULL DEFAULT 1.0,
  reports_submitted INTEGER NOT NULL DEFAULT 0,
  reports_accurate INTEGER NOT NULL DEFAULT 0,
  votes_cast INTEGER NOT NULL DEFAULT 0,
  votes_accurate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  submitted_by TEXT NOT NULL,
  message_text TEXT NOT NULL,
  category TEXT NOT NULL,
  city TEXT NOT NULL,
  language TEXT NOT NULL,
  extracted_domain TEXT,
  extracted_phone TEXT,
  evidence_verdict TEXT NOT NULL DEFAULT 'pending',
  evidence_details TEXT,
  ai_verdict TEXT,
  status TEXT NOT NULL DEFAULT 'unverified',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (submitted_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  vote_type TEXT NOT NULL, -- 'seen_too' | 'looks_fake' | 'looks_legit'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(report_id, user_id),
  FOREIGN KEY (report_id) REFERENCES reports(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rebuttals (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  submitted_by TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (report_id) REFERENCES reports(id)
);
`);

// Safe migration: if you're upgrading an existing vidura_watch.db created
// before the AI-verification feature was added, this adds the missing
// column without wiping your existing reports/votes/users.
try {
  db.exec("ALTER TABLE reports ADD COLUMN ai_verdict TEXT");
} catch (e) {
  // Column already exists -- fine, ignore.
}

module.exports = db;
