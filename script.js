/* =========================================================
   KONFIGURASI — semua tanpa Apps Script / server sendiri.
   Isi 6 nilai di bawah ini. Cara mendapatkannya ada di README.md.
   ========================================================= */
const CONFIG = {
  // ID Spreadsheet (lihat di URL, antara /d/ dan /edit)
  SHEET_ID: "1cGb-fmrLOKp_NJGis9bhULdE6xYMaxe6FxprpsrCf20",

  // Nama tab sheet berisi data master agen
  AGENTS_SHEET: "Agents",

  // Nama tab sheet tempat jawaban Google Form otomatis masuk
  // (defaultnya "Form Responses 1", boleh diganti nama tabnya jadi "Votes")
  VOTES_SHEET: "Votes",

  // URL "formResponse" dari Google Form voting (ganti /viewform -> /formResponse)
  FORM_ACTION_URL: "https://docs.google.com/forms/d/e/1FAIpQLSdZq_uLuOtcGWjd7U8Ebj3L0YQ-xWXbcLemCJWYIZgabtU8Bw/formResponse",

  // entry.xxxxxxxx untuk tiap pertanyaan di Form (lihat README cara ambilnya)
  ENTRY_NIP: "entry.1478650977",
  ENTRY_AGENT_ID: "entry.914290983",
  ENTRY_AGENT_NAME: "", // opsional, boleh dikosongkan ""
};

const LS_VOTER_KEY = "agenPerubahan_voterNip";
const LS_VOTED_KEY = "agenPerubahan_hasVoted";

const els = {
  loading: document.getElementById("loadingState"),
  grid: document.getElementById("agentGrid"),
  empty: document.getElementById("emptyState"),
  statusMsg: document.getElementById("statusMsg"),
  statAgents: document.getElementById("statAgents"),
  statVotes: document.getElementById("statVotes"),
  voterBar: document.getElementById("voterBar"),
  voterBarText: document.querySelector(".voter-bar-text"),
  voterBtn: document.getElementById("voterBtn"),
  voterModal: document.getElementById("voterModal"),
  voterNipInput: document.getElementById("voterNipInput"),
  voterSaveBtn: document.getElementById("voterSaveBtn"),
  voterCancelBtn: document.getElementById("voterCancelBtn"),
  confirmModal: document.getElementById("confirmModal"),
  confirmAgentName: document.getElementById("confirmAgentName"),
  confirmSendBtn: document.getElementById("confirmSendBtn"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
};

let agentsCache = [];
let votesCache = []; // [{nip, agentId}]
let pendingAgent = null;

init();

async function init() {
  bindVoterUI();
  bindConfirmUI();
  refreshVoterBar();
  await loadAll();
}

/* ---------------- reading data from Google Sheets (no key needed) ---------------- */

async function fetchSheetRows(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(
    sheetName
  )}&headers=1`;
  const res = await fetch(url);
  const text = await res.text();
  const jsonStr = text.substring(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const data = JSON.parse(jsonStr);
  const rows = (data.table.rows || []).map((r) =>
    (r.c || []).map((cell) => (cell && cell.v !== null && cell.v !== undefined ? cell.v : ""))
  );
  return rows;
}

async function fetchAgents() {
  const rows = await fetchSheetRows(CONFIG.AGENTS_SHEET);
  // urutan kolom: ID, Nama, NIP, FotoURL, ProposalURL
  return rows
    .filter((r) => r[0] !== "" && r[0] !== undefined)
    .map((r) => ({
      id: String(r[0]),
      nama: r[1] || "",
      nip: r[2] || "",
      foto: r[3] || "",
      proposal: r[4] || "",
    }));
}

async function fetchVotes() {
  const rows = await fetchSheetRows(CONFIG.VOTES_SHEET);
  // kolom otomatis dari Form: Timestamp, NIP, AgentID, (AgentNama - opsional)
  return rows
    .filter((r) => r[1] !== "" && r[1] !== undefined)
    .map((r) => ({ nip: String(r[1]).trim(), agentId: String(r[2]).trim() }));
}

async function loadAll() {
  toggleLoading(true);
  try {
    const [agents, votes] = await Promise.all([fetchAgents(), fetchVotes()]);
    agentsCache = agents;
    votesCache = votes;

    renderAgents(agentsCache, countVotes(votesCache));
    els.statAgents.textContent = agentsCache.length;
    els.statVotes.textContent = votesCache.length;

    if (agentsCache.length === 0) {
      els.empty.hidden = false;
    }

    syncVotedStateFromServer();
  } catch (err) {
    showStatus(
      "Gagal memuat data. Pastikan Sheet sudah di-share 'Anyone with the link' dan CONFIG di script.js sudah benar.",
      "error"
    );
    console.error(err);
  } finally {
    toggleLoading(false);
  }
}

function countVotes(votes) {
  const counts = {};
  votes.forEach((v) => {
    counts[v.agentId] = (counts[v.agentId] || 0) + 1;
  });
  return counts;
}

// Jika NIP tersimpan di browser ini ternyata sudah ada di sheet Votes,
// pastikan status "sudah voting" konsisten (mis. dibuka di device lain).
function syncVotedStateFromServer() {
  const nip = localStorage.getItem(LS_VOTER_KEY);
  if (!nip) return;
  const already = votesCache.some((v) => v.nip.toLowerCase() === nip.toLowerCase());
  if (already) {
    localStorage.setItem(LS_VOTED_KEY, "1");
    refreshVoterBar();
  }
}

function toggleLoading(isLoading) {
  els.loading.hidden = !isLoading;
  els.grid.hidden = isLoading;
}

/* ---------------- rendering ---------------- */

function renderAgents(agents, counts) {
  els.grid.innerHTML = "";
  const hasVoted = localStorage.getItem(LS_VOTED_KEY) === "1";

  agents.forEach((agent, idx) => {
    const card = document.createElement("article");
    card.className = "agent-card";
    card.style.animationDelay = `${idx * 40}ms`;

    const photoSrc = agent.foto || "";
    const proposalHref = agent.proposal || "#";
    const voteCount = counts[agent.id] || 0;

    card.innerHTML = `
      <div class="agent-photo-wrap">
        <span class="agent-num">#${String(idx + 1).padStart(2, "0")}</span>
        <img src="${escapeAttr(photoSrc)}" alt="Foto ${escapeAttr(agent.nama)}" loading="lazy"
             onerror="this.src='https://placehold.co/400x300?text=Foto+Tidak+Tersedia'">
      </div>
      <div class="perforation"></div>
      <div class="agent-body">
        <h3 class="agent-name">${escapeHtml(agent.nama)}</h3>
        <p class="agent-nip">NIP ${escapeHtml(agent.nip || "-")}</p>
        <a class="agent-proposal-link" href="${escapeAttr(proposalHref)}" target="_blank" rel="noopener">
          Lihat proposal ↗
        </a>
        <div class="agent-footer">
          <span class="vote-count">${voteCount} suara</span>
          <button class="btn btn-primary vote-btn" data-id="${escapeAttr(agent.id)}" ${hasVoted ? "disabled" : ""}>
            ${hasVoted ? "Terima kasih" : "Pilih Agen Ini"}
          </button>
        </div>
      </div>
    `;
    els.grid.appendChild(card);
  });

  els.grid.hidden = false;
  els.grid.querySelectorAll(".vote-btn").forEach((btn) => {
    btn.addEventListener("click", () => onVoteClick(btn.dataset.id));
  });
}

/* ---------------- voter identity ---------------- */

function bindVoterUI() {
  els.voterBtn.addEventListener("click", () => {
    els.voterNipInput.value = localStorage.getItem(LS_VOTER_KEY) || "";
    els.voterModal.hidden = false;
    els.voterNipInput.focus();
  });
  els.voterCancelBtn.addEventListener("click", () => (els.voterModal.hidden = true));
  els.voterModal.addEventListener("click", (e) => {
    if (e.target === els.voterModal) els.voterModal.hidden = true;
  });
  els.voterSaveBtn.addEventListener("click", () => {
    const nip = els.voterNipInput.value.trim();
    if (!nip) {
      els.voterNipInput.focus();
      return;
    }
    localStorage.setItem(LS_VOTER_KEY, nip);
    els.voterModal.hidden = true;
    refreshVoterBar();
    syncVotedStateFromServer();
  });
}

function refreshVoterBar() {
  const nip = localStorage.getItem(LS_VOTER_KEY);
  const hasVoted = localStorage.getItem(LS_VOTED_KEY) === "1";
  if (nip) {
    els.voterBar.classList.add("verified");
    els.voterBarText.textContent = hasVoted
      ? `Suara dari NIP ${nip} sudah tercatat. Terima kasih sudah memilih.`
      : `Anda masuk sebagai NIP ${nip}.`;
    els.voterBtn.textContent = "Ganti Identitas";
  } else {
    els.voterBar.classList.remove("verified");
    els.voterBarText.textContent = "Masukkan identitas Anda (NIP) untuk mulai memilih.";
    els.voterBtn.textContent = "Isi Identitas";
  }
}

/* ---------------- voting flow ---------------- */

function onVoteClick(agentId) {
  const nip = localStorage.getItem(LS_VOTER_KEY);
  if (!nip) {
    showStatus("Isi identitas (NIP) Anda terlebih dahulu sebelum memilih.", "error");
    els.voterBtn.click();
    return;
  }
  if (localStorage.getItem(LS_VOTED_KEY) === "1") {
    showStatus("Anda sudah memberikan suara sebelumnya.", "error");
    return;
  }
  pendingAgent = agentsCache.find((a) => String(a.id) === String(agentId));
  if (!pendingAgent) return;
  els.confirmAgentName.textContent = pendingAgent.nama;
  els.confirmModal.hidden = false;
}

function bindConfirmUI() {
  els.confirmCancelBtn.addEventListener("click", () => {
    els.confirmModal.hidden = true;
    pendingAgent = null;
  });
  els.confirmSendBtn.addEventListener("click", submitVote);

  // Klik di area gelap (backdrop) di luar kotak modal juga menutup modal
  els.confirmModal.addEventListener("click", (e) => {
    if (e.target === els.confirmModal && !els.confirmSendBtn.disabled) {
      els.confirmModal.hidden = true;
      pendingAgent = null;
    }
  });
}

// Tombol Escape menutup modal mana pun yang sedang terbuka
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!els.confirmModal.hidden && !els.confirmSendBtn.disabled) {
    els.confirmModal.hidden = true;
    pendingAgent = null;
  }
  if (!els.voterModal.hidden) {
    els.voterModal.hidden = true;
  }
});

async function submitVote() {
  if (!pendingAgent) return;
  const nip = localStorage.getItem(LS_VOTER_KEY);

  els.confirmSendBtn.disabled = true;
  els.confirmSendBtn.textContent = "Memeriksa…";

  try {
    // Cek ulang ke server tepat sebelum kirim, untuk mengurangi risiko vote ganda
    const freshVotes = await fetchVotes();
    if (freshVotes.some((v) => v.nip.toLowerCase() === nip.toLowerCase())) {
      localStorage.setItem(LS_VOTED_KEY, "1");
      els.confirmModal.hidden = true;
      showStatus("NIP ini sudah tercatat pernah memilih sebelumnya.", "error");
      refreshVoterBar();
      await loadAll();
      return;
    }

    els.confirmSendBtn.textContent = "Mengirim…";
    await postVoteToForm(nip, pendingAgent.id, pendingAgent.nama);

    // Google Form dikirim dengan mode "no-cors" sehingga respons tidak bisa dibaca.
    // Untuk memastikan, kita cek ulang beberapa kali sampai data muncul di sheet.
    const confirmed = await pollVoteRecorded(nip, 6, 1200);

    els.confirmModal.hidden = true;
    if (confirmed) {
      localStorage.setItem(LS_VOTED_KEY, "1");
      showStatus(`Suara untuk ${pendingAgent.nama} berhasil disimpan. Terima kasih!`, "ok");
    } else {
      showStatus(
        "Suara sudah dikirim, tapi belum bisa diverifikasi otomatis. Muat ulang halaman sesaat lagi untuk memastikan.",
        "error"
      );
    }
    refreshVoterBar();
    await loadAll();
  } catch (err) {
    els.confirmModal.hidden = true;
    showStatus("Terjadi kesalahan saat mengirim suara. Coba lagi.", "error");
    console.error(err);
  } finally {
    pendingAgent = null;
    els.confirmSendBtn.disabled = false;
    els.confirmSendBtn.textContent = "Kirim Suara";
  }
}

async function postVoteToForm(nip, agentId, agentName) {
  const params = new URLSearchParams();
  params.append(CONFIG.ENTRY_NIP, nip);
  params.append(CONFIG.ENTRY_AGENT_ID, agentId);
  if (CONFIG.ENTRY_AGENT_NAME) params.append(CONFIG.ENTRY_AGENT_NAME, agentName);

  await fetch(CONFIG.FORM_ACTION_URL, {
    method: "POST",
    mode: "no-cors", // Google Form tidak mengizinkan CORS; respons jadi "opaque"
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

async function pollVoteRecorded(nip, attempts, delayMs) {
  for (let i = 0; i < attempts; i++) {
    await sleep(delayMs);
    try {
      const votes = await fetchVotes();
      if (votes.some((v) => v.nip.toLowerCase() === nip.toLowerCase())) {
        votesCache = votes;
        return true;
      }
    } catch (e) {
      // abaikan, coba lagi
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ---------------- helpers ---------------- */

function showStatus(message, type) {
  els.statusMsg.textContent = message;
  els.statusMsg.className = `status-msg ${type}`;
  els.statusMsg.hidden = false;
  els.statusMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => (els.statusMsg.hidden = true), 7000);
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(str = "") {
  return escapeHtml(str);
}