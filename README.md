# Voting Agen Perubahan

Halaman web untuk voting Agen Perubahan. Data agen (foto, nama, NIP, link
proposal) dan hasil voting disimpan di Google Sheets. Halaman ini statis
(HTML/CSS/JS) sehingga bisa di-hosting gratis di GitHub Pages, lalu
disematkan (embed) ke Google Sites.

**Arsitektur singkat:**

```
Google Sites (embed iframe)
        │
        ▼
GitHub Pages: index.html + style.css + script.js   ← tampilan & logika
        │  fetch() GET / POST
        ▼
Google Apps Script Web App (Code.gs)                ← "API" perantara
        │
        ▼
Google Spreadsheet: sheet "Agents" + sheet "Votes"  ← database
```

Google Sites tidak bisa langsung membaca/menulis Google Sheets dari
JavaScript sisi klien (butuh otorisasi OAuth), jadi Apps Script yang
di-deploy sebagai **Web App** berperan sebagai API sederhana: `doGet`
untuk mengambil daftar agen, `doPost` untuk mencatat vote.

---

## 1. Siapkan Google Spreadsheet

Buat 1 spreadsheet baru dengan 2 sheet (tab):

**Sheet `Agents`** — data master, isi manual oleh admin:

| ID | Nama         | NIP                 | FotoURL                          | ProposalURL                      |
|----|--------------|---------------------|-----------------------------------|-----------------------------------|
| 1  | Budi Santoso | 198501012010011001  | https://drive.google.com/... foto | https://drive.google.com/... pdf |
| 2  | Siti Amalia  | 199002022012022002  | https://...                       | https://...                       |

- `FotoURL` dan `ProposalURL` paling praktis pakai **Google Drive**:
  upload file → klik kanan → *Get link* → set akses "Anyone with the
  link" → gunakan link tersebut.
- Baris 1 harus persis header di atas (urutan kolom penting, dibaca
  berdasarkan posisi kolom oleh skrip).

**Sheet `Votes`** — akan terisi otomatis oleh sistem, cukup buat sheet
kosong dengan header baris pertama:

| Timestamp | VoterNIP | AgentID | AgentNama |
|-----------|----------|---------|-----------|

## 2. Deploy Apps Script sebagai Web App

1. Di spreadsheet: **Extensions → Apps Script**.
2. Hapus kode default, tempel isi file [`apps-script/Code.gs`](apps-script/Code.gs).
3. Ganti baris `const SHEET_ID = "GANTI_DENGAN_ID_SPREADSHEET";` dengan
   ID spreadsheet Anda (bagian di URL antara `/d/` dan `/edit`).
4. **Deploy → New deployment** → pilih tipe **Web app**.
   - Description: bebas, mis. "Voting Agen Perubahan"
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Klik **Deploy**, izinkan akses saat diminta, lalu salin **Web app
   URL** yang muncul (formatnya `https://script.google.com/macros/s/xxx/exec`).

> Setiap kali Anda mengubah `Code.gs`, gunakan **Manage deployments →
> Edit → New version** agar perubahan ikut ter-deploy pada URL yang sama.

## 3. Hubungkan frontend ke Apps Script

Buka `script.js`, ganti baris pertama:

```js
const API_URL = "GANTI_DENGAN_URL_WEB_APP_APPS_SCRIPT";
```

dengan URL Web App dari langkah 2.

## 4. Publikasikan lewat GitHub Pages

1. Buat repository baru di GitHub, mis. `voting-agen-perubahan`.
2. Upload/push seluruh isi folder ini (`index.html`, `style.css`,
   `script.js`, folder `apps-script/` boleh ikut untuk dokumentasi).
   ```bash
   git init
   git add .
   git commit -m "Voting Agen Perubahan"
   git branch -M main
   git remote add origin https://github.com/USERNAME/voting-agen-perubahan.git
   git push -u origin main
   ```
3. Di repo: **Settings → Pages** → Source: `Deploy from a branch` →
   Branch: `main` / folder `/ (root)` → Save.
4. Tunggu ±1 menit, GitHub akan memberi URL publik, formatnya:
   `https://USERNAME.github.io/voting-agen-perubahan/`

## 5. Sematkan ke Google Sites

1. Buka Google Sites, edit halaman yang dituju.
2. Panel kanan → **Embed** → **By URL** → tempel URL GitHub Pages dari
   langkah 4 → **Insert**.
3. Perbesar ukuran kotak embed sesuai kebutuhan (disarankan tinggi
   minimal 900px agar seluruh grid agen terlihat tanpa scroll ganda).

---

## Cara kerja voting & mencegah suara ganda

- Pemilih memasukkan **NIP** mereka sendiri lewat tombol "Isi
  Identitas" (tersimpan di `localStorage` browser).
- Saat pengiriman vote, Apps Script mengecek sheet `Votes`: jika NIP
  tersebut sudah pernah tercatat, vote baru ditolak dengan pesan
  "NIP ini sudah pernah memberikan suara."
- Setelah vote berhasil, tombol vote di browser tersebut ikut
  terkunci (`localStorage`) sebagai lapisan tambahan di sisi klien.
- Catatan: pencegahan ini berbasis NIP yang diketik sendiri oleh
  pemilih, bukan login terautentikasi. Jika dibutuhkan verifikasi
  yang lebih ketat (mis. dicocokkan ke daftar pegawai resmi), tambahkan
  sheet ketiga berisi daftar NIP sah dan validasi tambahan di `doPost`
  pada `Code.gs`.

## Kustomisasi cepat

- **Warna & tipografi**: semua di `style.css`, variabel warna ada di
  bagian `:root` paling atas.
- **Teks halaman** (judul, deskripsi): langsung di `index.html`.
- **Jumlah kolom kartu agen**: atur `grid-template-columns` pada
  `.agent-grid` di `style.css`.
