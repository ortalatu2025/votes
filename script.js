/* =========================================================
   KONFIGURASI
   Ganti URL di bawah ini dengan URL Web App Google Apps Script
   Anda (lihat README.md bagian "Deploy Apps Script").
   ========================================================= */
const API_URL = "GANTI_DENGAN_URL_WEB_APP_APPS_SCRIPT";

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
let pendingAgent = null;

init();

async function init() {
  bindVoterUI();
  bindConfirmUI();
  refreshVoterBar();
  await loadAgents();
}

/* ---------------- data loading ---------------- */

async function loadAgents() {
  toggleLoading(true);
  try {
    const res = await fetch(`${API_URL}?action=agents`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    agentsCache = data.agents || [];
    renderAgents(agentsCache);
    els.statAgents.textContent = agentsCache.length;
    els.statVotes.textContent = agentsCache.reduce((sum, a) => sum + (a.votes || 0), 0);

    if (agentsCache.length === 0) {
      els.empty.hidden = false;
    }
  } catch (err) {
    showStatus("Gagal memuat data agen. Periksa koneksi atau konfigurasi API_URL di script.js.", "error");
    console.error(err);
  } finally {
    toggleLoading(false);
  }
}

function toggleLoading(isLoading) {
  els.loading.hidden = !isLoading;
  els.grid.hidden = isLoading;
}

/* ---------------- rendering ---------------- */

function renderAgents(agents) {
  els.grid.innerHTML = "";
  const hasVoted = localStorage.getItem(LS_VOTED_KEY) === "1";

  agents.forEach((agent, idx) => {
    const card = document.createElement("article");
    card.className = "agent-card";
    card.style.animationDelay = `${idx * 40}ms`;

    const photoSrc = agent.foto || "";
    const proposalHref = agent.proposal || "#";

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
          <span class="vote-count">${agent.votes ?? 0} suara</span>
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
  els.voterSaveBtn.addEventListener("click", () => {
    const nip = els.voterNipInput.value.trim();
    if (!nip) {
      els.voterNipInput.focus();
      return;
    }
    localStorage.setItem(LS_VOTER_KEY, nip);
    els.voterModal.hidden = true;
    refreshVoterBar();
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
}

async function submitVote() {
  if (!pendingAgent) return;
  const nip = localStorage.getItem(LS_VOTER_KEY);

  els.confirmSendBtn.disabled = true;
  els.confirmSendBtn.textContent = "Mengirim…";

  try {
    // Content-Type text/plain menghindari CORS preflight pada Apps Script Web App
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ voterId: nip, agentId: pendingAgent.id }),
    });
    const data = await res.json();

    if (data.success) {
      localStorage.setItem(LS_VOTED_KEY, "1");
      els.confirmModal.hidden = true;
      showStatus(`Suara untuk ${pendingAgent.nama} berhasil disimpan. Terima kasih!`, "ok");
      refreshVoterBar();
      await loadAgents();
    } else {
      showStatus(data.message || "Voting gagal disimpan. Coba lagi.", "error");
      els.confirmModal.hidden = true;
    }
  } catch (err) {
    showStatus("Terjadi kesalahan jaringan saat mengirim suara. Coba lagi.", "error");
    console.error(err);
  } finally {
    pendingAgent = null;
    els.confirmSendBtn.disabled = false;
    els.confirmSendBtn.textContent = "Kirim Suara";
  }
}

/* ---------------- helpers ---------------- */

function showStatus(message, type) {
  els.statusMsg.textContent = message;
  els.statusMsg.className = `status-msg ${type}`;
  els.statusMsg.hidden = false;
  els.statusMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
  clearTimeout(showStatus._t);
  showStatus._t = setTimeout(() => (els.statusMsg.hidden = true), 6000);
}

function escapeHtml(str = "") {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(str = "") {
  return escapeHtml(str);
}
