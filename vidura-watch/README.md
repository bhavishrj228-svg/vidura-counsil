# Vidura's Watch

A crowdsourced, evidence-verified fraud-alert website. Anyone can report a
suspicious message; other users vote on it, but votes alone never confirm
anything — an independent evidence check (domain age, known-bad URLs,
known scam numbers already confirmed on the platform) has to agree with
the reputation-weighted community vote before a report is publicly
labeled "confirmed."

Built around Vidura's counsel in the Mahābhārata: trust is earned through
a track record of accuracy, and even sincere community agreement is not
proof on its own without independent evidence.

## What's inside

```
vidura-watch/
  server.js              -> starts the web server
  lib/
    db.js                -> SQLite database + table setup (auto-creates on first run)
    redact.js             -> strips phone numbers/emails/IDs before storing a message
    evidence.js            -> domain-age / Safe-Browsing / known-number checks
    reputation.js          -> reputation-weighted voting + status decision logic
  routes/
    users.js               -> simple username-based login
    reports.js              -> submit / list / view / rebuttal / moderator-resolve
    votes.js                 -> cast a vote, recompute status live
  public/
    index.html, styles.css, app.js  -> the whole frontend, plain JS (no build step)
```

## 1. Run it on your own laptop (do this first)

You need [Node.js](https://nodejs.org) installed (version 18 or newer).

```bash
cd vidura-watch
npm install
cp .env.example .env
npm start
```

Open **http://localhost:3000** in your browser. That's it — a file called
`vidura_watch.db` will appear in the folder; that's your whole database,
no separate database server needed.

### Try the full flow yourself before your demo

1. Log in as `alice`.
2. Submit a report with a fake link, e.g.:
   `Congratulations! Pay ₹499 to confirm your job: http://bit.ly/free-job-2026`
3. Open the report — you'll see the evidence check result (domain
   age/Safe Browsing/known-number).
4. Log out, log back in as `bob`, open the same report, and vote
   "I've seen this too."
5. Repeat with `carol` and `dinesh` (need 3 distinct voters by default —
   change `MIN_DISTINCT_VOTERS` in `lib/reputation.js` if you want fewer
   for a quick demo).
6. Watch the status move from "unverified" to "confirmed" once votes and
   evidence agree.
7. Try filing a rebuttal on a confirmed report and watch it drop back to
   "unverified" pending review.
8. Try the "Moderator resolution" buttons to close the loop and see
   reputations update (check the badge in the top-right after switching
   users).

## 2. Turning on the optional evidence and AI-agent APIs

The app works with **zero setup** — every optional check falls back to an
honest "not configured" message instead of pretending to check something
it can't.

### Domain/URL evidence checks
To add Google's malicious-URL check:
1. Get a free key: https://console.cloud.google.com/apis/library/safebrowsing.googleapis.com
2. Put it in `.env` as `SAFE_BROWSING_API_KEY=your_key_here`
3. Restart the server.

### "Vidura's Judgment" — the AI agent
Once a report has at least 3 distinct voters, the app automatically sends
the (already-redacted) message, the community's vote, and the evidence
result to an AI model (Claude) and asks for an independent judgment,
phrased as counsel in Vidura's voice. This is a genuinely separate third
signal — not the crowd, not the rule-based checks, but a language model
actually reading and reasoning about the message.

1. Get a key at https://console.anthropic.com
2. Put it in `.env` as `ANTHROPIC_API_KEY=your_key_here`
3. (Optional) set `ANTHROPIC_MODEL=` to a different model string if you
   want to use a different Claude model than the default.
4. Restart the server. Vote on a report from 3 different accounts and
   open it — the "🪶 Vidura's Judgment (AI-verified)" panel will now show
   a real AI-generated verdict instead of the "not configured" message.

Without a key, this section is still visible on every report — it just
honestly says AI verification hasn't run, rather than faking a result.

## 3. Deploying it so anyone can visit a real link

The easiest free option for a student project is **Render.com**, because
it supports a normal Node.js server with a persistent disk (needed since
we're using a SQLite file, not a separate hosted database).

### Deploy to Render (recommended, free tier)

1. Push this folder to a GitHub repository (create one if you don't have
   it yet):
   ```bash
   git init
   git add .
   git commit -m "Vidura's Watch initial version"
   git branch -M main
   git remote add origin https://github.com/<your-username>/vidura-watch.git
   git push -u origin main
   ```
2. Go to https://render.com and sign up (free), then **New +** →
   **Web Service** → connect your GitHub repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Instance type:** Free
4. Under **Disks**, add a persistent disk (e.g. 1 GB) mounted at
   `/opt/render/project/src` so your SQLite file survives restarts/redeploys.
   (Without this, your data resets each time Render redeploys — fine for
   a first test, but add the disk before your real demo.)
5. Add the environment variable `SAFE_BROWSING_API_KEY` under
   **Environment** if you have one.
6. Click **Create Web Service**. Render gives you a live URL like
   `https://vidura-watch.onrender.com` — that's what you share with your
   faculty.

### Alternative: Railway.app

Same idea — connect the GitHub repo, Railway auto-detects Node.js,
add a **Volume** (their term for persistent disk) mounted at the project
folder so the SQLite file persists, set `SAFE_BROWSING_API_KEY` if you
have one, deploy.

### If you outgrow SQLite later (going to production)

For a real multi-city rollout with lots of simultaneous users, swap
`better-sqlite3` for a hosted Postgres database (free tiers at
[Neon](https://neon.tech) or [Supabase](https://supabase.com)) and add
a small `pg` wrapper in `lib/db.js` with the same table structure. The
rest of the app (routes, reputation logic, frontend) doesn't need to
change — the SQL is intentionally simple/portable.

## Design notes worth mentioning in your demo/report

- **Data persists on the server, not the browser**: every report, vote,
  and user lives in `vidura_watch.db` on whatever machine is running
  `server.js`. Closing your browser, or the reporter leaving the site
  entirely, does not delete anything — the next visitor sees the same
  data. The one thing to watch is *deployment*: Render's free tier can
  reset an unattached disk on redeploy (see the "Deploy to Render"
  section above for how to add a persistent disk so this never happens).
- **PII redaction** (`lib/redact.js`) strips phone numbers, emails, and
  long ID numbers before a message is stored or shown to any other user.
- **Two-track verification**: community sentiment (`reputation.js`
  `computeCommunityScore`) and independent evidence (`evidence.js`) are
  computed completely separately and only combined in `decideStatus()`
  — a report is never "confirmed" from votes alone.
- **A third, independent signal — the AI agent** (`lib/ai_verify.js`):
  once enough people vote, an AI model reads the actual message content
  and gives its own judgment, phrased as counsel "in Vidura's voice."
  This sits alongside, not instead of, the rule-based evidence check.
- **Reputation is earned, not assumed**: every user starts at the same
  reputation (1.0) and it only moves after a moderator resolves a report.
- **Appeals path**: filing a rebuttal always pauses a report back to
  "unverified," so nothing stays permanently and unfairly flagged.
- **The Mahabharata connection is now visible throughout the site, not
  just in the name**: an introductory passage on the login screen, a
  rotating quote in the header/footer/submission form, vote buttons
  phrased in Vidura's idiom ("I bear witness," "This deserves trust"),
  and a "Vidura's Verdict" quote panel plus an AI-generated "Vidura's
  Judgment" panel on every report (see `public/quotes.js` for the full
  quote library and citations).
