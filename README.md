# Voting Agen Perubahan

Halaman voting statis (HTML/CSS/JS) yang datanya (foto, nama, NIP, link
proposal, dan hasil vote) tersimpan di Google Sheets — **tanpa Apps
Script, tanpa server sendiri**. Cukup di-hosting di GitHub Pages lalu
disematkan (embed) ke Google Sites.

**Arsitektur:**

```
Google Sites (embed iframe)
        │
        ▼
GitHub Pages: index.html + style.css + script.js
        │
        ├── GET  → endpoint publik Google Sheets (gviz)   → baca daftar agen & hasil vote
        └── POST → Google Form "formResponse"              → catat vote baru
                        │
                        ▼
                Google Spreadsheet (sheet Agents + sheet Votes)
```

> Trade-off yang perlu Anda sadari: karena tidak ada server, cek
> "NIP sudah pernah vote" dilakukan di sisi browser (baca ulang data
> sebelum kirim), bukan divalidasi di server. Untuk voting internal ini
> biasanya cukup, tapi bukan tahan terhadap orang yang sengaja mengirim
> request manual berulang. Sheet-nya juga harus bisa dibaca "siapa saja
> yang punya link". Kalau Anda butuh validasi lebih ketat di server,
> lihat folder `optional-apps-script-alternative/` di akhir dokumen ini.

---

## 1. Siapkan Google Spreadsheet

Buat 1 spreadsheet baru, isi 1 sheet manual (`Agents`) — sheet kedua
(`Votes`) akan dibuat otomatis oleh Google Form di langkah 3.

**Sheet `Agents`** (baris 1 = header, urutan kolom harus persis ini):

| ID | Nama         | NIP                 | FotoURL            | ProposalURL         |
|----|--------------|---------------------|---------------------|----------------------|
| 1  | Budi Santoso | 198501012010011001  | link foto Drive     | link proposal Drive |
| 2  | Siti Amalia  | 199002022012022002  | link foto Drive     | link proposal Drive |

- Untuk `FotoURL`/`ProposalURL`, paling praktis upload ke **Google
  Drive** → klik kanan file → *Share* → *Get link* → set akses
  "Anyone with the link" → tempel link itu.
- **Share spreadsheet ini juga**: klik *Share* → General access →
  **Anyone with the link → Viewer**. Tanpa ini halaman tidak bisa
  membaca data.

Catat **ID spreadsheet**-nya (bagian URL antara `/d/` dan `/edit`).

## 2. Buat Google Form untuk voting

1. Buka [forms.google.com](https://forms.google.com) → buat form baru,
   judul bebas mis. "Vote Agen Perubahan".
2. Tambahkan 2 pertanyaan (tipe **Short answer**, keduanya **Required**):
   - Pertanyaan 1: `NIP Pemilih`
   - Pertanyaan 2: `ID Agen`
   - *(opsional)* Pertanyaan 3: `Nama Agen` — supaya sheet hasil lebih
     mudah dibaca manusia.
3. Klik ikon **Responses** (tab di atas) → titik tiga → **Select
   response destination** → pilih **Select existing spreadsheet** →
   pilih spreadsheet dari langkah 1. Ini akan membuat tab baru di
   spreadsheet Anda (biasanya bernama "Form Responses 1").
4. **Ganti nama tab tersebut menjadi `Votes`** (klik kanan tab di
   bagian bawah spreadsheet → Rename). Kolomnya otomatis:
   `Timestamp | NIP Pemilih | ID Agen | (Nama Agen)`.

### Ambil `entry.xxxxx` dan URL formResponse

1. Di editor Form, klik titik tiga (⋮) di kanan atas → **Get
   pre-filled link**.
2. Isi jawaban contoh yang mudah dikenali, misalnya `NIP Pemilih` =
   `TESTNIP123`, `ID Agen` = `TESTAGENTID`, lalu klik **Get link** →
   **Copy link**.
3. Tempel link tadi ke address bar browser, akan terlihat seperti:
   ```
   https://docs.google.com/forms/d/e/1FAIpQLSxxxxxxx/viewform?usp=pp_url&entry.111111111=TESTNIP123&entry.222222222=TESTAGENTID
   ```
   - `entry.111111111` → ini `ENTRY_NIP` (yang nilainya `TESTNIP123`)
   - `entry.222222222` → ini `ENTRY_AGENT_ID` (yang nilainya `TESTAGENTID`)
   - Lakukan hal sama untuk pertanyaan "Nama Agen" jika Anda pakai.
4. URL untuk mengirim data (**bukan** untuk dibuka di browser) adalah
   URL yang sama tapi bagian `/viewform` diganti `/formResponse`:
   ```
   https://docs.google.com/forms/d/e/1FAIpQLSxxxxxxx/formResponse
   ```

## 3. Isi `script.js`

Buka `script.js`, lengkapi bagian `CONFIG` di paling atas:

```js
const CONFIG = {
  SHEET_ID: "...",              // ID spreadsheet dari langkah 1
  AGENTS_SHEET: "Agents",
  VOTES_SHEET: "Votes",
  FORM_ACTION_URL: "https://docs.google.com/forms/d/e/xxxxx/formResponse",
  ENTRY_NIP: "entry.111111111",
  ENTRY_AGENT_ID: "entry.222222222",
  ENTRY_AGENT_NAME: "entry.333333333", // kosongkan "" jika tidak pakai
};
```

## 4. Publikasikan lewat GitHub Pages

1. Buat repository baru di GitHub, mis. `voting-agen-perubahan`.
2. Push isi folder ini (`index.html`, `style.css`, `script.js`):
   ```bash
   git init
   git add .
   git commit -m "Voting Agen Perubahan"
   git branch -M main
   git remote add origin https://github.com/USERNAME/voting-agen-perubahan.git
   git push -u origin main
   ```
3. **Settings → Pages** → Source: `Deploy from a branch` → Branch:
   `main` / folder `/ (root)` → Save.
4. Setelah ±1 menit, GitHub memberi URL publik:
   `https://USERNAME.github.io/voting-agen-perubahan/`

## 5. Sematkan ke Google Sites

1. Buka Google Sites, edit halaman tujuan.
2. Panel kanan → **Embed** → **By URL** → tempel URL GitHub Pages dari
   langkah 4 → **Insert**.
3. Perbesar kotak embed (disarankan tinggi ≥ 900px).

---

## Uji coba sebelum dibagikan

- Buka URL GitHub Pages langsung di browser, isi NIP percobaan, coba
  vote satu agen, lalu cek apakah baris baru muncul di tab `Votes`
  pada spreadsheet.
- Coba vote dengan NIP yang sama sekali lagi — tombol harus terkunci
  dan muncul pesan bahwa NIP sudah pernah memilih.

## Kustomisasi cepat

- **Warna & tipografi**: `style.css`, variabel warna di bagian `:root`.
- **Teks halaman**: langsung di `index.html`.
- **Jumlah kolom kartu**: `grid-template-columns` pada `.agent-grid`
  di `style.css`.

---

## Alternatif: pakai Apps Script (validasi vote ganda di server)

Pendekatan di atas mengecek NIP ganda dari sisi browser. Kalau Anda
butuh validasi yang benar-benar di server (lebih sulit dimanipulasi),
folder [`optional-apps-script-alternative/Code.gs`](optional-apps-script-alternative/Code.gs)
berisi versi backend Apps Script yang bisa dipasang sebagai
pengganti langkah 2–3 di atas: Apps Script di-deploy sebagai Web App,
`script.js` memanggil URL Web App itu (GET untuk baca data, POST
untuk kirim vote), dan Apps Script yang memvalidasi + menulis ke
sheet. Ini murni opsional — silakan diabaikan jika versi tanpa Apps
Script sudah cukup.
