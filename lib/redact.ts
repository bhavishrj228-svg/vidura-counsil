// lib/redact.ts
// Lightweight PII redaction: strips things that look like phone numbers,
// emails, UPI handles, PAN/Aadhaar/card numbers and long account numbers
// from a submitted message before it is stored or shown to anyone else.
// Intentionally regex-based -- simple, explainable, and easy to audit.

import { createHmac } from "node:crypto";

const PHONE_RE = /(\+?\d{1,3}[-\s]?)?\d{5}[-\s]?\d{5}\b/g;

export function redactPII(text: string): string {
  if (!text) return "";
  let r = text;

  // Email addresses (before UPI, which is a looser shape)
  r = r.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email redacted]");
  // UPI handles, e.g. name@okaxis
  r = r.replace(/\b[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}\b/g, "[upi id redacted]");
  // Aadhaar-style spaced numbers (XXXX XXXX XXXX) and card-style groups
  r = r.replace(/\b\d{4}[\s-]\d{4}[\s-]\d{4}(?:[\s-]\d{4})?\b/g, "[id redacted]");
  // PAN (ABCDE1234F)
  r = r.replace(/\b[A-Z]{5}\d{4}[A-Z]\b/g, "[id redacted]");
  // Phone numbers (Indian 10-digit, optional +91 / spaces / dashes)
  r = r.replace(PHONE_RE, "[phone redacted]");
  r = r.replace(/\b\d{10}\b/g, "[phone redacted]");
  // Long numeric strings that look like account/card/OTP numbers (6+ digits)
  r = r.replace(/\b\d{6,}\b/g, "[number redacted]");

  return r;
}

// Pull out a URL/domain and a phone number from the raw text BEFORE
// redaction, so the evidence step still has something to verify. The raw
// phone number is never stored -- only a keyed one-way hash of it.
export function extractSignals(text: string): { url: string | null; domain: string | null; phone: string | null } {
  const urlMatch =
    text.match(/https?:\/\/[^\s<>"')]+/i) ||
    text.match(/\b(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\/[^\s<>"')]*/i) ||
    text.match(/\bwww\.[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/i);

  let url: string | null = null;
  let domain: string | null = null;
  if (urlMatch) {
    const raw = /^https?:\/\//i.test(urlMatch[0]) ? urlMatch[0] : `http://${urlMatch[0]}`;
    try {
      const u = new URL(raw.replace(/[.,;:!?]+$/, ""));
      url = u.toString();
      domain = u.hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      url = null;
    }
  }

  const phoneMatch = text.match(new RegExp(PHONE_RE.source));
  const digits = phoneMatch ? phoneMatch[0].replace(/\D/g, "") : "";
  const phone = digits.length >= 10 ? digits.slice(-10) : null;

  return { url, domain, phone };
}

export function hashPhone(phone: string | null): string | null {
  if (!phone) return null;
  const secret = Netlify.env.get("PHONE_HASH_SECRET") || "vidura-watch-phone-pepper";
  return createHmac("sha256", secret).update(phone).digest("hex");
}
