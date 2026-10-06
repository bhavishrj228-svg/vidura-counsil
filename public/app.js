// public/app.js
// Plain vanilla JS -- no build step needed, easy to read line by line
// for a viva/demo walkthrough.

const state = { user: null, detailReportId: null };

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
  if (!res.ok) return alert("Vidura counsels: " + data.error);

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
  statusEl.textContent = "I am weighing the evidence and seeking independent counsel...";

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
    statusEl.textContent = "Vidura counsels: " + data.error;
    return;
  }

  statusEl.textContent = "Your warning is recorded. The evidence and independent counsel will be shown beside the community's testimony.";
  $("#report-form").reset();
  await loadReports();
  await openDetail(data.report.id);
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
        <span class="muted">${escapeHtml(r.category.replace("_"," "))}</span>
      </div>
      <p class="report-text">${escapeHtml(r.message_text)}</p>
      <div class="report-meta">${escapeHtml(r.city)} · ${escapeHtml(r.language)} · evidence: ${escapeHtml(r.evidence_verdict)}</div>
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
  state.detailReportId = id;
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
  const aiHtml = renderAIVerdict(r.ai_verdict);

  $("#detail-content").innerHTML = `
    <span class="status-pill status-${r.status}">${statusLabel(r.status)}</span>
    <p class="report-text" style="margin-top:12px;">${escapeHtml(r.message_text)}</p>
    <div class="report-meta">${escapeHtml(r.city)} · ${escapeHtml(r.language)} · ${escapeHtml(r.category.replace("_"," "))}</div>

    <div class="verdict-box">
      <div class="verdict-label">Vidura's Verdict</div>
      <p class="verdict-quote">"${escapeHtml(quote.text)}"</p>
      <p class="verdict-citation">${escapeHtml(quote.citation)}</p>
    </div>

    <div class="evidence-box">
      <strong>Independent evidence</strong>
      ${evidenceHtml}
    </div>

    <div class="votes-box">
      <strong>Community testimony</strong>
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
      <strong>A challenge to this counsel</strong>
      ${rebuttalsHtml || '<p class="muted">No rebuttals filed.</p>'}
      <form onsubmit="submitRebuttal(event, '${r.id}')" style="margin-top:8px;">
        <textarea id="rebuttal-text" rows="2" placeholder="Set forth the evidence that should cause this judgment to be reconsidered..."></textarea>
        <button type="submit" class="secondary" style="margin-top:6px;">Offer a rebuttal</button>
      </form>
    </div>

    <div class="rebuttal-box">
      <strong>Moderator's final review</strong>
      <p class="muted">A human moderator must settle the matter before reputations are adjusted.</p>
      <div class="vote-buttons">
        <button onclick="resolveReport('${r.id}', true)">The warning is upheld</button>
        <button onclick="resolveReport('${r.id}', false)">The warning is unfounded</button>
      </div>
    </div>
  `;

  $("#detail-modal").classList.remove("hidden");
  if (!r.ai_verdict) {
    window.setTimeout(() => {
      if (state.detailReportId === id && !$("#detail-modal").classList.contains("hidden")) {
        openDetail(id);
      }
    }, 1800);
  }
}
window.openDetail = openDetail;

function voteLabel(voteType) {
  return {
    seen_too: "bore witness",
    looks_fake: "saw the marks of deceit",
    looks_legit: "found it deserving of trust",
  }[voteType] || voteType;
}

function renderAIVerdict(aiVerdict) {
  const label = "Vidura's Counsel · Independent AI assessment";
  if (!aiVerdict) {
    return `
      <div class="ai-box">
        <div class="verdict-label">${label}</div>
        <p class="muted">I am examining the redacted message and available evidence independently; the community need not speak first.</p>
      </div>`;
  }
  if (!aiVerdict.ran) {
    return `
      <div class="ai-box">
        <div class="verdict-label">${label}</div>
        <p class="muted">${escapeHtml(aiVerdict.note || "AI verification unavailable.")}</p>
      </div>`;
  }
  return `
    <div class="ai-box">
      <div class="verdict-label">${label} · confidence: ${escapeHtml(aiVerdict.confidence)}</div>
      <p class="verdict-quote">"${escapeHtml(aiVerdict.counsel)}"</p>
      <p class="verdict-citation">My independent judgment: <strong>${escapeHtml(aiVerdict.verdict)}</strong></p>
    </div>`;
}

function renderEvidence(details) {
  if (!details) return `<p class="muted">Evidence check still running or unavailable.</p>`;
  const lines = [];
  for (const key of ["domainAge", "safeBrowsing", "knownNumber"]) {
    const d = details[key];
    if (!d) continue;
    const cls = d.flagged || (d.ageDays !== null && d.ageDays < 60) ? "evidence-flag" : "evidence-clear";
    lines.push(`<div class="evidence-line ${d.checked ? cls : ''}">${escapeHtml(d.note)}</div>`);
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
  if (!res.ok) return alert("Vidura counsels: " + data.error);
  await openDetail(reportId);
  const feedback = document.createElement("p");
  feedback.className = "muted";
  feedback.textContent = "I have heard your testimony; no single voice settles this matter.";
  $("#detail-content").prepend(feedback);
  loadReports();
}
window.castVote = castVote;

async function submitRebuttal(e, reportId) {
  e.preventDefault();
  const explanation = $("#rebuttal-text").value.trim();
  if (!explanation) return;
  const res = await fetch(`/api/reports/${reportId}/rebuttal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: state.user.id, explanation }),
  });
  if (!res.ok) return alert("Vidura counsels: your appeal could not be entered.");
  await openDetail(reportId);
  const feedback = document.createElement("p");
  feedback.className = "muted";
  feedback.textContent = "I have heard your appeal; this warning returns to examination.";
  $("#detail-content").prepend(feedback);
  loadReports();
}
window.submitRebuttal = submitRebuttal;

async function resolveReport(reportId, finalWasScam) {
  const res = await fetch(`/api/reports/${reportId}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finalWasScam }),
  });
  if (!res.ok) return alert("Vidura counsels: the final review could not be recorded.");
  await openDetail(reportId);
  const feedback = document.createElement("p");
  feedback.className = "muted";
  feedback.textContent = "The moderator's finding has been recorded; let the evidence guide what you do next.";
  $("#detail-content").prepend(feedback);
  loadReports();
}
window.resolveReport = resolveReport;

$("#close-modal").addEventListener("click", () => {
  $("#detail-modal").classList.add("hidden");
  state.detailReportId = null;
});

// ---------- INIT ----------
renderStaticQuotes();
tryRestoreSession();
