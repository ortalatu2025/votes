/**
 * VOTING AGEN PERUBAHAN — Backend Google Apps Script
 * ---------------------------------------------------
 * Tempel file ini ke Extensions > Apps Script pada Google Spreadsheet Anda.
 * Spreadsheet harus punya 2 sheet:
 *
 * Sheet "Agents" (baris 1 = header):
 *   ID | Nama | NIP | FotoURL | ProposalURL
 *
 * Sheet "Votes" (baris 1 = header, akan terisi otomatis):
 *   Timestamp | VoterNIP | AgentID | AgentNama
 *
 * Setelah menempel kode ini:
 *  1. Ganti SHEET_ID di bawah dengan ID spreadsheet Anda.
 *  2. Deploy > New deployment > Web app.
 *     - Execute as: Me
 *     - Who has access: Anyone
 *  3. Salin URL Web App yang dihasilkan ke API_URL pada script.js.
 */

const SHEET_ID = "GANTI_DENGAN_ID_SPREADSHEET";
const AGENTS_SHEET = "Agents";
const VOTES_SHEET = "Votes";

function doGet(e) {
  const action = (e.parameter && e.parameter.action) || "agents";
  try {
    if (action === "agents") {
      return jsonResponse({ agents: getAgentsWithVotes() });
    }
    return jsonResponse({ error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const voterId = String(body.voterId || "").trim();
    const agentId = String(body.agentId || "").trim();

    if (!voterId || !agentId) {
      return jsonResponse({ success: false, message: "Data tidak lengkap." });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const votesSheet = ss.getSheetByName(VOTES_SHEET);

    if (hasAlreadyVoted(votesSheet, voterId)) {
      return jsonResponse({ success: false, message: "NIP ini sudah pernah memberikan suara." });
    }

    const agents = getAgents();
    const agent = agents.find((a) => String(a.id) === agentId);
    if (!agent) {
      return jsonResponse({ success: false, message: "Agen tidak ditemukan." });
    }

    votesSheet.appendRow([new Date(), voterId, agent.id, agent.nama]);
    return jsonResponse({ success: true, message: "Vote berhasil disimpan." });
  } catch (err) {
    return jsonResponse({ success: false, message: "Kesalahan server: " + err.message });
  }
}

/* ---------------- helpers ---------------- */

function getAgents() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(AGENTS_SHEET);
  const values = sheet.getDataRange().getValues();
  const agents = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[0]) continue;
    agents.push({
      id: String(row[0]),
      nama: row[1],
      nip: row[2],
      foto: row[3],
      proposal: row[4],
    });
  }
  return agents;
}

function getAgentsWithVotes() {
  const agents = getAgents();
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const votesSheet = ss.getSheetByName(VOTES_SHEET);
  const votesValues = votesSheet.getDataRange().getValues();

  const counts = {};
  agents.forEach((a) => (counts[a.id] = 0));
  for (let i = 1; i < votesValues.length; i++) {
    const agentId = String(votesValues[i][2]);
    if (counts[agentId] !== undefined) counts[agentId]++;
  }
  return agents.map((a) => Object.assign({}, a, { votes: counts[a.id] || 0 }));
}

function hasAlreadyVoted(votesSheet, voterId) {
  const values = votesSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][1]).trim().toLowerCase() === voterId.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
