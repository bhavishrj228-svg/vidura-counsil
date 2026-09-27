// lib/evidence.js
// This is the "independent evidence" layer described in the project:
// checks that don't depend on what any user believes or votes.
//
// Three checks are attempted, each optional/best-effort so the whole
// system still works even without API keys configured (falls back to
// heuristics and says so honestly in the result):
//
// 1. Domain age (WHOIS) - very new domains are a strong scam signal.
// 2. Google Safe Browsing - is the URL already known-malicious?
// 3. Known-scam-number list - cross-check phone numbers already
//    confirmed as scams elsewhere in our own database.

const fetch = require("node-fetch");
const whois = require("whois-json");
const db = require("./db");

const SAFE_BROWSING_KEY = process.env.SAFE_BROWSING_API_KEY || "";

async function checkDomainAge(domain) {
  if (!domain) return { checked: false, note: "No domain found in message." };
  try {
    const data = await whois(domain, { follow: 2 });
    const created =
      data.creationDate || data.createdDate || data.registeredDate || null;
    if (!created) {
      return {
        checked: true,
        ageDays: null,
        note: "WHOIS lookup returned no creation date (inconclusive).",
      };
    }
    const createdDate = new Date(created);
    const ageDays = Math.floor(
      (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      checked: true,
      ageDays,
      note:
        ageDays < 60
          ? `Domain "${domain}" was registered only ${ageDays} day(s) ago — a strong scam indicator.`
          : `Domain "${domain}" is ${ageDays} day(s) old.`,
    };
  } catch (err) {
    return {
      checked: false,
      note: `WHOIS lookup failed for "${domain}" (domain may not exist or lookup is unsupported).`,
    };
  }
}

async function checkSafeBrowsing(url) {
  if (!SAFE_BROWSING_KEY) {
    return {
      checked: false,
      note: "Safe Browsing API key not configured — skipped (see README).",
    };
  }
  if (!url) return { checked: false, note: "No URL found in message." };

  try {
    const resp = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${SAFE_BROWSING_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "vidura-watch", clientVersion: "1.0.0" },
          threatInfo: {
            threatTypes: [
              "MALWARE",
              "SOCIAL_ENGINEERING",
              "UNWANTED_SOFTWARE",
            ],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      }
    );
    const data = await resp.json();
    const flagged = Boolean(data.matches && data.matches.length > 0);
    return {
      checked: true,
      flagged,
      note: flagged
        ? "URL is already listed as unsafe by Google Safe Browsing."
        : "URL is not on Google's known-unsafe list (this does not guarantee it's safe).",
    };
  } catch (err) {
    return { checked: false, note: "Safe Browsing check failed to run." };
  }
}

function checkKnownScamNumber(phone) {
  if (!phone) return { checked: false, note: "No phone number found in message." };
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM reports
       WHERE extracted_phone = ? AND status = 'confirmed'`
    )
    .get(phone);
  const flagged = row.n > 0;
  return {
    checked: true,
    flagged,
    matches: row.n,
    note: flagged
      ? `This number appears in ${row.n} other confirmed scam report(s) on this platform.`
      : "No prior confirmed reports for this number on this platform.",
  };
}

// Runs all applicable checks and returns one combined verdict:
// 'suspicious' | 'clean' | 'inconclusive'
async function runEvidenceCheck({ domain, phone, rawText }) {
  const results = {};

  results.domainAge = await checkDomainAge(domain);
  results.safeBrowsing = domain
    ? await checkSafeBrowsing(rawText.match(/https?:\/\/[^\s]+/i)?.[0])
    : { checked: false, note: "No URL to check." };
  results.knownNumber = checkKnownScamNumber(phone);

  const signalsFlagging = [
    results.domainAge.checked && results.domainAge.ageDays !== null && results.domainAge.ageDays < 60,
    results.safeBrowsing.checked && results.safeBrowsing.flagged,
    results.knownNumber.checked && results.knownNumber.flagged,
  ].filter(Boolean).length;

  const anyChecked =
    results.domainAge.checked ||
    results.safeBrowsing.checked ||
    results.knownNumber.checked;

  let verdict = "inconclusive";
  if (anyChecked) {
    verdict = signalsFlagging > 0 ? "suspicious" : "clean";
  }

  return { verdict, results };
}

module.exports = { runEvidenceCheck };
