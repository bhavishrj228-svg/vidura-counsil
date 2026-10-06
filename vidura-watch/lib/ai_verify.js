// lib/ai_verify.js
//
// The AI agent is an independent signal, started when a report is
// submitted. It reads the redacted message and objective evidence, never
// the community's vote count or reputation-weighted score.
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
- what an automated evidence check found (domain age, known-bad-URL lists, previously confirmed
  scam numbers)

Judge the message independently from the crowd. Treat inconclusive checks as unknown, not proof
of safety. Give your own assessment of whether the message is a scam.

Respond ONLY with a JSON object, no other text, in exactly this shape:
{
  "verdict": "scam" | "legitimate" | "uncertain",
  "confidence": "low" | "medium" | "high",
  "counsel": "A short (1-2 sentence) statement directly addressing the reader in Vidura's wise,
              measured voice. Explain the reason for your judgment. Do not mention that you are an AI."
}`;

async function runAIVerification({
  messageText,
  category,
  evidenceVerdict,
  evidenceDetails,
}) {
  if (!ANTHROPIC_API_KEY) {
    return {
      ran: false,
      note: "I cannot offer an independent judgment until the counsel service is configured.",
    };
  }

  const userContent = `Reported message (category: ${category}):
"""
${messageText}
"""

Automated evidence check verdict: ${evidenceVerdict}
Evidence details: ${JSON.stringify(evidenceDetails || {})}

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
      await resp.text();
      return {
        ran: false,
        note: `I could not complete my independent reading (service error ${resp.status}).`,
      };
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
    return { ran: false, note: "I could not complete my independent reading; please return shortly." };
  }
}

module.exports = { runAIVerification };
