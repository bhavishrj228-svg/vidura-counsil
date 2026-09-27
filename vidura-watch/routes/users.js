// routes/users.js
// MVP-level "login": just a username, no password. Good enough for a
// class demo where you want to show different reputation levels.
// For a real deployment, replace this with proper auth (e.g. email +
// OTP, or a library like Auth.js / Passport).

const express = require("express");
const { nanoid } = require("nanoid");
const db = require("../lib/db");

const router = express.Router();

// POST /api/users/login  { username }
// Creates the user the first time they're seen, otherwise returns them.
router.post("/login", (req, res) => {
  const { username } = req.body;
  if (!username || username.trim().length < 2) {
    return res.status(400).json({ error: "Username must be at least 2 characters." });
  }
  const clean = username.trim().toLowerCase();

  let user = db.prepare("SELECT * FROM users WHERE username = ?").get(clean);
  if (!user) {
    const id = nanoid();
    db.prepare(
      "INSERT INTO users (id, username, reputation) VALUES (?, ?, 1.0)"
    ).run(id, clean);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  }
  res.json({ user });
});

// GET /api/users/:id
router.get("/:id", (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user });
});

module.exports = router;
