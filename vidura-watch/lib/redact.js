// lib/redact.js
// Lightweight PII redaction: strips things that look like phone numbers,
// emails, and long ID/account numbers from a submitted message before it
// is stored or shown to anyone else. This is intentionally simple
// (regex-based) -- good enough for a student prototype, and a real,
// explainable piece of the project you can point to in your write-up.

function redactPII(text) {
  if (!text) return "";

  let redacted = text;

  // Phone numbers (Indian 10-digit, with optional +91 / spaces / dashes)
  redacted = redacted.replace(
    /(\+?\d{1,3}[-\s]?)?\d{5}[-\s]?\d{5}\b/g,
    "[phone redacted]"
  );
  redacted = redacted.replace(/\b\d{10}\b/g, "[phone redacted]");

  // Email addresses
  redacted = redacted.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[email redacted]"
  );

  // Long numeric strings that look like account/card/OTP numbers (6+ digits)
  redacted = redacted.replace(/\b\d{6,}\b/g, "[number redacted]");

  // Aadhaar-style spaced numbers (XXXX XXXX XXXX)
  redacted = redacted.replace(/\b\d{4}\s\d{4}\s\d{4}\b/g, "[id redacted]");

  return redacted;
}

// Pull out a URL/domain and a phone number from the raw text BEFORE
// redaction, so the evidence-check step still has something to verify
// even though the stored/displayed message is redacted.
function extractSignals(text) {
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  let domain = null;
  if (urlMatch) {
    try {
      domain = new URL(urlMatch[0]).hostname.replace(/^www\./, "");
    } catch (e) {
      domain = null;
    }
  }

  const phoneMatch = text.match(/(\+?\d{1,3}[-\s]?)?\d{5}[-\s]?\d{5}\b/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s|-/g, "") : null;

  return { domain, phone };
}

module.exports = { redactPII, extractSignals };
