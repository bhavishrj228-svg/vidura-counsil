// public/app.js
// Plain vanilla JS -- no build step needed, easy to read line by line
// for a viva/demo walkthrough.

const state = { user: null };

const $ = (sel) => document.querySelector(sel);

// ---------- LOGIN ----------

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("#username-input").value.trim();
  const res = await fetch("/api/users/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);

  state.user = data.user;
  localStorage.setItem("vidura_user_id", data.user.id);
  renderAuth();
  showApp();
  loadReports();
});

async function tryRestoreSession() {
  const savedId = localStorage.getItem("vidura_user_id");
  if (!savedId) return;
  const res = await fetch(`/api/users/${savedId}`);
  if (res.ok) {
    const data = await res.json();
    state.user = data.user;
    renderAuth();
    showApp();
    loadReports();
  }
}

function renderAuth() {
  const el = $("#auth-area");
  if (!state.user) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <span class="rep-badge">
      ${state.user.username} · reputation ${state.user.reputation.toFixed(2)}
    </span>
    <button class="secondary" onclick="logout()" style="margin-left:8px;">Switch user</button>
  `;
}

function logout() {
  localStorage.removeItem("vidura_user_id");
  state.user = null;
  $("#login-panel").classList.remove("hidden");
  $("#app-panel").classList.add("hidden");
  renderAuth();
}
window.logout = logout;

function showApp() {
  $("#login-panel").classList.add("hidden");
  $("#app-panel").classList.remove("hidden");
}

// ---------- MAHABHARATA QUOTES ON EVERY PAGE ----------

function renderStaticQuotes() {
  $("#intro-text").textContent = VIDURA_INTRO.text;
  $("#intro-citation").textContent = "— " + VIDURA_INTRO.citation;

  const headerQ = getRandomGeneralQuote();
  $("#header-quote").textContent = `"${headerQ.text}" — ${headerQ.citation}`;

  const submitQ = getRandomGeneralQuote();
  $("#submit-quote").textContent = `"${submitQ.text}" — ${submitQ.citation}`;

  const footerQ = getRandomGeneralQuote();
  $("#footer-quote-text").textContent = `"${footerQ.text}"`;
  $("#footer-quote-citation").textContent = footerQ.citation;
}

// ---------- SUBMIT REPORT ----------

$("#report-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const statusEl = $("#submit-status");
  statusEl.textContent = "Submitting and running evidence check (this can take a few seconds)...";

  const body = {
    userId: state.user.id,
    messageText: $("#message-text").value,
    category: $("#category").value,
    city: $("#city").value,
    language: $("#language").value,
  };

  const res = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();

  if (!res.ok) {
    statusEl.textContent = "Error: " + data.error;
    return;
  }

  statusEl.textContent = "Submitted. Evidence verdict: " + data.report.evidence_verdict;
  $("#report-form").reset();
  loadReports();
});

// ---------- DASHBOARD ----------

$("#refresh-btn").addEventListener("click", loadReports);

async function loadReports() {
  const params = new URLSearchParams();
  const city = $("#filter-city").value.trim();
  const language = $("#filter-language").value.trim();
  const status = $("#filter-status").value;
  if (city) params.set("city", city);
  if (language) params.set("language", language);
  if (status) params.set("status", status);

  const res = await fetch("/api/reports?" + params.toString());
  const data = await res.json();
  renderReports(data.reports);
}

function statusLabel(status) {
  return {
    unverified: "Unverified",
    disputed: "Disputed",
    confirmed: "Confirmed scam",
    verified_legit: "Verified legit",
  }[status] || status;
}

function renderReports(reports) {
  const list = $("#reports-list");
  if (!reports.length) {
    list.innerHTML = `<p class="muted">No reports yet for this filter.</p>`;
    return;
  }
  list.innerHTML = reports
    .map(
      (r) => `
    <div class="report-card" onclick="openDetail('${r.id}')">
      <div class="report-top">
        <span class="status-pill status-${r.status}">${statusLabel(r.status)}</span>
        <span class="muted">${r.category.replace("_"," ")}</span>
      </div>
      <p class="report-text">${escapeHtml(r.message_text)}</p>
      <div class="report-meta">${r.city} · ${r.language} · evidence: ${r.evidence_verdict}</div>
    </div>
  `
    )
    .join("");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.innerText = str;
  return d.innerHTML;
}

function formatScore(score) {
  // Avoids showing a confusing "-0.00" caused by JS negative-zero when
  // suspicious and trusting votes exactly cancel out.
  const normalized = score === 0 ? 0 : score;
  return normalized.toFixed(2);
}

// ---------- DETAIL MODAL ----------

async function openDetail(id) {
  const res = await fetch(`/api/reports/${id}`);
  const data = await res.json();
  const r = data.report;

  const evidenceHtml = renderEvidence(r.evidence_details);
  const votesHtml = data.votes
    .map((v) => `<div class="evidence-line">${escapeHtml(v.username)} (reputation ${v.reputation.toFixed(2)}) — <em>${voteLabel(v.vote_type)}</em></div>`)
    .join("") || `<p class="muted">No one has spoken on this yet.</p>`;
  const rebuttalsHtml = data.rebuttals
    .map((rb) => `<div class="evidence-line"><strong>${escapeHtml(rb.username)}:</strong> ${escapeHtml(rb.explanation)}</div>`)
    .join("");

  const quote = getViduraQuote(r.status);
  const aiHtml = renderAIVerdict(r.ai_verdict, data.distinctVoters);

  $("#detail-content").innerHTML = `
    <span class="status-pill status-${r.status}">${statusLabel(r.status)}</span>
    <p class="report-text" style="margin-top:12px;">${escapeHtml(r.message_text)}</p>
    <div class="report-meta">${escapeHtml(r.city)} · ${escapeHtml(r.language)} · ${r.category.replace("_"," ")}</div>

    <div class="verdict-box">
      <div class="verdict-label">🪔 Vidura's Verdict</div>
      <p class="verdict-quote">"${escapeHtml(quote.text)}"</p>
      <p class="verdict-citation">${escapeHtml(quote.citation)}</p>
    </div>

    <div class="evidence-box">
      <strong>Independent evidence check</strong>
      ${evidenceHtml}
    </div>

    <div class="votes-box">
      <strong>How many have spoken, and how much their word is worth</strong>
      <p class="muted" style="margin:4px 0 8px;">
        ${data.distinctVoters} voter(s) so far · reputation-weighted score: ${formatScore(data.communityScore)}
        (positive leans toward scam, negative leans toward legitimate)
      </p>
      ${votesHtml}
      <div class="vote-buttons">
        <button onclick="castVote('${r.id}','seen_too')">I bear witness</button>
        <button onclick="castVote('${r.id}','looks_fake')">This bears the marks of deceit</button>
        <button onclick="castVote('${r.id}','looks_legit')">This deserves trust</button>
      </div>
    </div>

    ${aiHtml}

    <div class="rebuttal-box">
      <strong>Rebuttal / appeal</strong>
      ${rebuttalsHtml || '<p class="muted">No rebuttals filed.</p>'}
      <form onsubmit="submitRebuttal(event, '${r.id}')" style="margin-top:8px;">
        <textarea id="rebuttal-text" rows="2" placeholder="Explain why this report is wrong..."></textarea>
        <button type="submit" class="secondary" style="margin-top:6px;">File rebuttal</button>
      </form>
    </div>

    <div class="rebuttal-box">
      <strong>Moderator resolution (demo only)</strong>
      <p class="muted">In a real deployment this is restricted to trained moderators/admins.</p>
      <div class="vote-buttons">
        <button onclick="resolveReport('${r.id}', true)">Confirm: this IS a scam</button>
        <button onclick="resolveReport('${r.id}', false)">Confirm: this is legitimate</button>
      </div>
    </div>
  `;

  $("#detail-modal").classList.remove("hidden");
}
window.openDetail = openDetail;

function voteLabel(voteType) {
  return {
    seen_too: "bore witness",
    looks_fake: "saw the marks of deceit",
    looks_legit: "found it deserving of trust",
  }[voteType] || voteType;
}

function renderAIVerdict(aiVerdict, distinctVoters) {
  const MIN_VOTERS_FOR_AI = 3; // keep in sync with lib/reputation.js MIN_DISTINCT_VOTERS
  if (!aiVerdict) {
    if (distinctVoters < MIN_VOTERS_FOR_AI) {
      return `
        <div class="ai-box">
          <div class="verdict-label">🪶 Vidura's Judgment (AI-verified)</div>
          <p class="muted">Vidura withholds final judgment until at least ${MIN_VOTERS_FOR_AI} people have spoken. ${distinctVoters} so far.</p>
        </div>`;
    }
    return `
      <div class="ai-box">
        <div class="verdict-label">🪶 Vidura's Judgment (AI-verified)</div>
        <p class="muted">Judgment has not yet been sought, or is being formed. Refresh in a moment.</p>
      </div>`;
  }
  if (!aiVerdict.ran) {
    return `
      <div class="ai-box">
        <div class="verdict-label">🪶 Vidura's Judgment (AI-verified)</div>
        <p class="muted">${escapeHtml(aiVerdict.note || "AI verification unavailable.")}</p>
      </div>`;
  }
  return `
    <div class="ai-box">
      <div class="verdict-label">🪶 Vidura's Judgment (AI-verified — confidence: ${aiVerdict.confidence})</div>
      <p class="verdict-quote">"${escapeHtml(aiVerdict.counsel)}"</p>
      <p class="verdict-citation">AI-agent assessment: <strong>${aiVerdict.verdict}</strong></p>
    </div>`;
}

function renderEvidence(details) {
  if (!details) return `<p class="muted">Evidence check still running or unavailable.</p>`;
  const lines = [];
  for (const key of ["domainAge", "safeBrowsing", "knownNumber"]) {
    const d = details[key];
    if (!d) continue;
    const cls = d.flagged || (d.ageDays !== null && d.ageDays < 60) ? "evidence-flag" : "evidence-clear";
    lines.push(`<div class="evidence-line ${d.checked ? cls : ''}">${d.note}</div>`);
  }
  return lines.join("") || `<p class="muted">No checkable signals (no URL/phone found).</p>`;
}

async function castVote(reportId, voteType) {
  const res = await fetch("/api/votes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportId, userId: state.user.id, voteType }),
  });
  const data = await res.json();
  if (!res.ok) return alert(data.error);
  openDetail(reportId);
  loadReports();
}
window.castVote = castVote;

async function submitRebuttal(e, reportId) {
  e.preventDefault();
  const explanation = $("#rebuttal-text").value.trim();
  if (!explanation) return;
  await fetch(`/api/reports/${reportId}/rebuttal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: state.user.id, explanation }),
  });
  openDetail(reportId);
  loadReports();
}
window.submitRebuttal = submitRebuttal;

async function resolveReport(reportId, finalWasScam) {
  await fetch(`/api/reports/${reportId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finalWasScam }),
  });
  openDetail(reportId);
  loadReports();
}
window.resolveReport = resolveReport;

$("#close-modal").addEventListener("click", () => {
  $("#detail-modal").classList.add("hidden");
});

// ---------- INIT ----------
renderStaticQuotes();
tryRestoreSession();
