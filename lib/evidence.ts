// lib/evidence.ts
// The "independent evidence" pillar: checks that do not depend on what any
// user believes or votes. Each check is best-effort and says honestly when
// it could not run, rather than pretending to have looked.
//
// 1. Domain age (RDAP) - very new domains are a strong scam signal.
// 2. Google Safe Browsing - is the URL already known-malicious?
// 3. Known scam numbers - has this number appeared in reports already
//    confirmed as scams on this platform?
// 4. Obscured links - URL shorteners hide where a link really goes.

import { and, eq, ne, count } from "drizzle-orm";
import { db } from "../db/index.js";
import { reports } from "../db/schema.js";

export type EvidenceCheck = {
  checked: boolean;
  flagged?: boolean;
  ageDays?: number | null;
  matches?: number;
  note: string;
};

export type EvidenceResults = {
  domainAge: EvidenceCheck;
  safeBrowsing: EvidenceCheck;
  knownNumber: EvidenceCheck;
  linkObscured: EvidenceCheck;
};

export type EvidenceVerdict = "suspicious" | "clean" | "inconclusive";

const NEW_DOMAIN_DAYS = 60;
const TIMEOUT_MS = 5000;

const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly",
  "rb.gy", "shorturl.at", "tiny.cc", "rebrand.ly", "t.ly", "s.id", "v.gd", "shorturl.gg",
]);

const MULTI_PART_SUFFIXES = new Set([
  "co.in", "net.in", "org.in", "gov.in", "ac.in", "edu.in", "firm.in", "gen.in", "ind.in",
  "co.uk", "org.uk", "ac.uk", "com.au", "net.au", "co.nz", "com.sg", "com.my", "co.za", "com.br",
]);

function registrableDomain(host: string): string {
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  return MULTI_PART_SUFFIXES.has(lastTwo) ? parts.slice(-3).join(".") : lastTwo;
}

async function checkDomainAge(domain: string | null): Promise<EvidenceCheck> {
  if (!domain) return { checked: false, note: "No link was found in the message, so no domain could be examined." };
  const base = registrableDomain(domain);
  try {
    const resp = await fetch(`https://rdap.org/domain/${encodeURIComponent(base)}`, {
      headers: { Accept: "application/rdap+json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) {
      return { checked: false, note: `The registry gave no record for "${base}" (it may not exist, or its registry is not searchable).` };
    }
    const data = (await resp.json()) as { events?: { eventAction?: string; eventDate?: string }[] };
    const reg = (data.events || []).find((e) => e.eventAction === "registration");
    if (!reg?.eventDate) {
      return { checked: true, ageDays: null, note: `The registry holds a record for "${base}" but no creation date (inconclusive).` };
    }
    const ageDays = Math.floor((Date.now() - new Date(reg.eventDate).getTime()) / 86_400_000);
    return {
      checked: true,
      ageDays,
      flagged: ageDays < NEW_DOMAIN_DAYS,
      note:
        ageDays < NEW_DOMAIN_DAYS
          ? `The domain "${base}" was registered only ${ageDays} day(s) ago — a strong mark of a scam.`
          : `The domain "${base}" has existed for ${ageDays} day(s).`,
    };
  } catch {
    return { checked: false, note: `The registry lookup for "${base}" did not answer in time.` };
  }
}

async function checkSafeBrowsing(url: string | null): Promise<EvidenceCheck> {
  if (!url) return { checked: false, note: "No link to test against Google Safe Browsing." };
  const key = Netlify.env.get("SAFE_BROWSING_API_KEY");
  if (!key) return { checked: false, note: "Google Safe Browsing is not configured for this site, so that test was not made." };

  try {
    const resp = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        client: { clientId: "vidura-watch", clientVersion: "2.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
    });
    if (!resp.ok) return { checked: false, note: "The Google Safe Browsing test could not be completed." };
    const data = (await resp.json()) as { matches?: unknown[] };
    const flagged = Boolean(data.matches && data.matches.length > 0);
    return {
      checked: true,
      flagged,
      note: flagged
        ? "Google Safe Browsing already lists this link as unsafe."
        : "The link is not on Google's list of known-unsafe sites (this alone does not prove it safe).",
    };
  } catch {
    return { checked: false, note: "The Google Safe Browsing test did not answer in time." };
  }
}

async function checkKnownScamNumber(phoneHash: string | null, reportId: string): Promise<EvidenceCheck> {
  if (!phoneHash) return { checked: false, note: "No phone number was found in the message." };
  const [row] = await db
    .select({ n: count() })
    .from(reports)
    .where(and(eq(reports.phoneHash, phoneHash), eq(reports.status, "confirmed"), ne(reports.id, reportId)));
  const n = Number(row?.n || 0);
  return {
    checked: true,
    flagged: n > 0,
    matches: n,
    note:
      n > 0
        ? `This phone number appears in ${n} other report(s) already confirmed as scams here.`
        : "This phone number has not appeared in any confirmed scam report here before.",
  };
}

function checkLinkObscured(domain: string | null): EvidenceCheck {
  if (!domain) return { checked: false, note: "No link to inspect for disguise." };
  const obscured = SHORTENERS.has(domain);
  return {
    checked: true,
    flagged: obscured,
    note: obscured
      ? `The link uses the shortener "${domain}", which hides where it truly leads — genuine banks and employers rarely do this.`
      : "The link shows its destination openly rather than hiding behind a shortener.",
  };
}

export async function runEvidenceCheck(input: {
  reportId: string;
  url: string | null;
  domain: string | null;
  phoneHash: string | null;
}): Promise<{ verdict: EvidenceVerdict; results: EvidenceResults }> {
  const [domainAge, safeBrowsing, knownNumber] = await Promise.all([
    checkDomainAge(input.domain),
    checkSafeBrowsing(input.url),
    checkKnownScamNumber(input.phoneHash, input.reportId),
  ]);
  const results: EvidenceResults = {
    domainAge,
    safeBrowsing,
    knownNumber,
    linkObscured: checkLinkObscured(input.domain),
  };

  const all = Object.values(results);
  const flagged = all.some((c) => c.checked && c.flagged);
  const anyChecked = all.some((c) => c.checked);

  const verdict: EvidenceVerdict = !anyChecked ? "inconclusive" : flagged ? "suspicious" : "clean";
  return { verdict, results };
}
