// lib/ai_verify.js
//
// This is the "AI agent" layer: once a report has enough votes AND an
// evidence-check result, this module sends the message plus that context
// to an external AI model (Claude, via the Anthropic API) and asks it to
// give an independent second opinion -- phrased as a short piece of
// counsel "in Vidura's voice" -- on top of the rule-based evidence check
// in lib/evidence.js. This is a genuinely separate, third signal: not the
// crowd, not the WHOIS/URL checks, but a language model actually reading
// the message's content and reasoning about it.
//
// Requires an ANTHROPIC_API_KEY in your .env file. Get one at
// https://console.anthropic.com -- without a key, this module returns a
// clearly-labeled "not run" result instead of pretending to have an
// opinion (same honest-fallback philosophy as lib/evidence.js).

const fetch = require("node-fetch");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

const SYSTEM_PROMPT = `You are Vidura, the counselor from the Mahābhārata famed for reading
danger correctly before it struck, and for giving guidance that was truthful whether or not it
was welcome. You are being consulted to evaluate a message that a member of the public has
reported as a possible scam.

You will be given:
- the reported message (with personal details already redacted)
- what the community of users voted (suspicious vs. trustworthy, weighted by their track record)
- what an automated evidence check found (domain age, known-bad-URL lists, previously confirmed
  scam numbers)

Weigh all of this the way Vidura would: do not simply agree with the majority, and do not ignore
evidence that contradicts popular belief. Give your own independent judgment of whether the
message is a scam.

Respond ONLY with a JSON object, no other text, in exactly this shape:
{
  "verdict": "scam" | "legitimate" | "uncertain",
  "confidence": "low" | "medium" | "high",
  "counsel": "A short (1-2 sentence) statement of your judgment, written in the wise, measured,
              second-person-plural voice of a counselor addressing a court -- the way Vidura
              addresses Dhritarashtra in the Mahābhārata. Do not mention that you are an AI."
}`;

async function runAIVerification({
  messageText,
  category,
  evidenceVerdict,
  evidenceDetails,
  communityScore,
  distinctVoters,
}) {
  if (!ANTHROPIC_API_KEY) {
    return {
      ran: false,
      note: "AI verification not configured (no ANTHROPIC_API_KEY set) — see README.",
    };
  }

  const userContent = `Reported message (category: ${category}):
"""
${messageText}
"""

Community voting: ${distinctVoters} distinct voter(s), reputation-weighted suspicion score = ${communityScore.toFixed(2)}
(positive = crowd believes it's a scam, negative = crowd believes it's legitimate)

Automated evidence check verdict: ${evidenceVerdict}
Evidence details: ${JSON.stringify(evidenceDetails)}

Give your independent judgment as specified.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { ran: false, note: `AI API error (${resp.status}): ${errText.slice(0, 200)}` };
    }

    const data = await resp.json();
    const rawText = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      ran: true,
      verdict: parsed.verdict,
      confidence: parsed.confidence,
      counsel: parsed.counsel,
    };
  } catch (err) {
    return { ran: false, note: "AI verification call failed: " + err.message };
  }
}

module.exports = { runAIVerification };
