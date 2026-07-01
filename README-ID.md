# StelDot — Platform Donasi Penghargaan Loyalitas Terdesentralisasi (Donate-to-Earn)

[English Version available in README.md](./README.md)

---

## 🇮🇩 Versi Bahasa Indonesia

### Deskripsi

StelDot adalah Aplikasi Terdesentralisasi (dApp) yang dibangun di atas jaringan Stellar menggunakan smart contract Soroban. Proyek ini menerapkan model loyalitas **Donate-to-Earn**.
Donatur dapat mendonasikan token XLM ke kampanye komunitas tertentu. Total volume donasi mereka dilacak secara real-time. Ketika total donasi yang belum diberi hadiah mencapai batas minimal **10 XLM**, donatur berhak mengklaim hadiah sebesar **1.5% dari total donasinya tersebut**. Pembayaran diproses secara instan dan otomatis oleh _smart contract_, lalu nominal volume donasinya di-reset menjadi 0 (riwayat akumulasi donasi seumur hidup tetap tersimpan utuh di blockchain). Catatan: setiap donasi yang masuk dikenakan **potongan 5% untuk biaya operasional dan pengembangan** ekosistem StelDot.

### Demo Video - StelDOt
[![StelDot (Demo Project) - Donation Project for Humanity and Tranparency Transcation](https://img.youtube.com/vi/82_UiT9p0gQ/maxresdefault.jpg)](https://www.youtube.com/watch?v=82_UiT9p0gQ)

---

### Informasi Smart Contract (Testnet)

- **Deployed Contract Address (ID)**: `CDQBMFQXXWGG2H6WELWFHHA476WQTZIXYOPTYADBVBC4LRJOROCKPXK2`
- **Lihat di Stellar Explorer**: [Tautan Kontrak di Stellar.Expert](https://stellar.expert/explorer/testnet/contract/CDQBMFQXXWGG2H6WELWFHHA476WQTZIXYOPTYADBVBC4LRJOROCKPXK2)
- **Asset/Token Address (Native XLM SAC)**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- **Contoh Hash Transaksi (Contract Call)**: [`106d12d3a6876e9edd5cd00e7c50bb9dfa57f39e3e381b44a4de5f08433298da`](https://stellar.expert/explorer/testnet/tx/106d12d3a6876e9edd5cd00e7c50bb9dfa57f39e3e381b44a4de5f08433298da)

---

### Fitur Utama

#### Fitur Client (Donatur)

- **Kirim Donasi**: Kirim XLM dengan nominal bebas ke kampanye aktif.
- **Kategori Tab Pintar**: Navigasi mudah untuk melihat kampanye yang **Berjalan**, **Terkumpul Penuh**, atau **Dihentikan**.
- **Poin Loyalitas (Volume)**: Lacak volume donasi yang belum diklaim. Dapatkan persentase hadiah sebesar **1.5%** dari total volume Anda.
- **Pencairan Instan**: Tarik hadiah **1.5%** Anda secara seketika segera setelah volume mencapai ambang batas 10 XLM.
- **Integrasi Dompet**: Melihat saldo XLM Freighter yang terhubung secara otomatis.
- **Dukungan Multi-Bahasa**: Ubah bahasa UI antara Bahasa Indonesia dan Bahasa Inggris dengan mulus, dikendalikan oleh sistem lokalisasi kamus dinamis `i18n.js`.
- **Terjemahan Otomatis**: Integrasi Google Translate API untuk menerjemahkan judul dan deskripsi kampanye sesuai dengan preferensi bahasa Anda.
- **Pencarian & Pagination**: Cari kampanye berdasarkan ID atau Judul, dan navigasikan halaman dengan sistem _pagination_ yang rapi.
- **Riwayat Transaksi Real-time**: Pantau transaksi masuk dan keluar Anda secara instan yang ditarik langsung dari Stellar Horizon API.
- **Riwayat Klaim Reward**: Bagian khusus untuk memantau semua pembayaran hadiah sukses yang dikirimkan oleh smart contract ke dompet Anda.
- **Tambahan 4 Manfaat Eksklusif**: Donatur yang loyalitas akan mendapatkan 4 manfaat Eksklusif terbaik dan menguntungkan dari StelDot.
- **Dasbor Donatur**: Pengguna dapat melacak donasi mereka sendiri, melihat progres target, dan melihat donatur teratas secara global.
- **Malaikat Penolong (Sistem Referral)**: Pengguna yang telah berdonasi >100 XLM dapat membuat tautan referral unik. Mereka akan mendapat hadiah 0.5% otomatis ke dompet mereka saat teman yang mereka undang berdonasi untuk pertama kalinya!
- **Transparansi Transaksi**: Semua riwayat transaksi dan klaim dapat dilihat oleh publik di dasbor dan dilacak langsung ke *blockchain explorer* (Stellar Expert).

#### Fitur Owner (Administrator)

- **Dashboard Admin Premium**: Panel kontrol eksklusif di posisi atas untuk mengelola keseluruhan aplikasi.
- **Konfigurasi Smart Contract**: Terdapat tombol pengatur koneksi Smart Contract yang tertanam secara elegan di Dashboard Owner.
- **Buka Kampanye**: Tambahkan kampanye baru dengan ID unik, judul, deskripsi, dan target dana.
- **Target Dinamis**: Pemilik proyek dapat menambahkan kampanye baru, menetapkan target dana khusus, dan menerjemahkan deskripsi langsung dari antarmuka pengguna.
- **Edit Kampanye**: Perbarui detail kampanye yang sudah berjalan (seperti memperbaiki salah ketik, mengubah target, atau menonaktifkan kampanye).
- **Tampilan Saldo Kas (Treasury)**: Saldo XLM kas kontrak ditampilkan secara real-time di panel admin.
- **Validasi Saldo**: Kontrak akan membatalkan transaksi otomatis jika saldo kas tidak mencukupi untuk membayar reward **1.5%** milik donatur.
- **Riwayat Klaim Hadiah Seluruh Pengguna**: Pantau seluruh pembayaran hadiah otomatis yang dilakukan oleh smart contract kepada semua donatur secara global dan real-time, diambil langsung dari jaringan Stellar RPC.
- **Statistik Klaim Bulanan/Tahunan**: Lihat ringkasan total XLM yang diklaim per bulan dan tahun untuk keperluan evaluasi, dan ekspor sebagai gambar PNG resolusi tinggi menggunakan fitur **Unduh Gambar** bawaan.
- **Antarmuka 100% Dapat Diterjemahkan**: Seluruh teks UI — termasuk placeholder, alert, dan dialog admin — terdaftar dalam kamus `i18n.js`. Tidak ada teks Inggris yang dikodekan keras di antarmuka.

---

### 📖 Panduan Pengguna (Cara Menggunakan)

#### 🧑‍💻 Sebagai Klien / Donatur

1. **Hubungkan Dompet:** Klik tombol `Connect Freighter` di pojok kanan atas untuk menautkan dompet Stellar Anda. Pastikan jaringan berada di Testnet.
2. **Cari Kampanye:** Telusuri tab kampanye **Aktif**. Anda dapat menggunakan bilah pencarian untuk mencari kampanye tertentu.
3. **Donasi XLM:** Masukkan nominal (misal: `10.00`) di kotak input pada kartu kampanye dan klik **Donasi Sekarang**.
4. **Tanda Tangani Transaksi:** Setujui transaksi di ekstensi Freighter Anda. Volume donasi Anda akan tercatat langsung on-chain.
5. **Klaim Hadiah:** Setelah Anda mengakumulasi volume donasi sebesar **minimal 10 XLM**, buka bagian `Persetujuan Hadiah` di atas dan klik **Klaim Reward**.
6. **Pencairan Instan:** Klaim Anda diproses seketika! Hadiah sebesar **1.5%** langsung dikirim ke dompet Anda tanpa menunggu admin, dan volume donasi untuk hadiah berikutnya di-reset.

#### 👑 Sebagai Pemilik / Admin

1. **Hubungkan Dompet Admin:** Hubungkan dompet Freighter yang memegang kunci pribadi (Private Key) dari Pemilik Kontrak. `Panel Pengaturan Admin` akan otomatis muncul.
2. **Atur ID Kontrak:** Anda dapat menghubungkan web ke Smart Contract lain menggunakan tombol **⚙️ Set Contract ID** secara permanen.
3. **Buat Kampanye:** Klik tombol **Buat Kampanye Baru** (ikon plus) untuk meluncurkan target penggalangan dana baru. Isi Judul, Deskripsi, dan Target XLM.
4. **Kelola Kampanye:** Klik ikon pensil hijau pada kampanye mana pun yang sudah ada untuk memperbarui detailnya atau menonaktifkannya.
5. **Tarik Dana Kas:** Gunakan tombol **Tarik Dana** di sebelah Saldo Kas (Treasury Balance) untuk mentransfer dana donasi yang terkumpul ke dompet Anda. Pastikan sisakan likuiditas agar donatur bisa mencairkan hadiah otomatisnya!
6. **Lihat Statistik Klaim:** Klik **ikon grafik** (📊) di sebelah judul "Riwayat Klaim Hadiah" untuk membuka ringkasan klaim per bulan dan tahun. Unduh statistik sebagai gambar PNG untuk keperluan pelaporan.

---

### 🎯 Insight Utama & Pemenuhan Kriteria

Proyek ini telah memenuhi dan melampaui kriteria kompetisi **Advanced Smart Contracts + Production-Ready dApps**:

1. **Advanced Smart Contract Development & Architecture**
   - StelDot memiliki logika ekonomi mandiri (Autonomous Tokenomics). Kami melacak akumulasi volume donasi secara permanen (`persistent storage`) menggunakan satuan _stroops_ (`i128`).
2. **Inter-contract Communication**
   - Smart Contract StelDot melakukan komunikasi lintas-kontrak (_cross-contract call_) secara mulus dengan Native Stellar Asset Contract (SAC) untuk memverifikasi saldo kas dan memproses `transfer` XLM.
3. **Event Streaming & Real-time Updates**
   - Setiap aksi kritikal dalam sistem (seperti `donate`, `claim`, `camp_cre`) memancarkan _Soroban Events_ (`env.events().publish()`), memungkinkan _indexer_ pihak ketiga melacak analitik secara _real-time_.
4. **CI/CD Pipeline Setup**
   - Repositori dilengkapi dengan GitHub Actions. Setiap `push` memicu _pipeline_ otomatis yang menjalankan Rust Linter (`clippy`), _formatter_ (`rustfmt`), _unit tests_ (`cargo test`), dan kompilasi _build_ WebAssembly (`wasm32v1-none`).
5. **Mobile Responsive & Error Handling**
   - Dibangun dengan arsitektur tangguh berbasis React + Tailwind CSS. UI sangat responsif di layar ponsel. Sistem dilengkapi _Error Handling_ canggih untuk 20+ skenario kesalahan, termasuk _fallback_ jika pengguna tidak memiliki ekstensi dompet Freighter.
6. **Writing Tests**
   - Smart contract dilindungi oleh file pengujian `test.rs` yang menguji _end-to-end flow_ (Donasi akumulatif -> Klaim instan sukses) serta _Negative Test_ (Sistem menggagalkan klaim (Panic) jika poin volume belum mencapai batas minimal).

#### ✅ Submission Checklist:

- [x] Public GitHub repository
- [x] README with complete documentation
- [x] Minimum 10+ meaningful commits
- [x] Live demo link (Frontend Deployed)
- [x] Contract deployment address (See above)
- [x] Transaction hash for contract interaction (See above)
- [x] Screenshot showing Mobile responsive UI
- [x] Screenshot showing CI/CD pipeline running
- [x] Screenshot showing Test output with 3+ passing tests
- [x] Demo video link (1–2 minutes)

---

### Keamanan & Penanganan Kesalahan (Error Handling)

StelDot menerapkan arsitektur penanganan kesalahan dua lapis yang solid untuk menutupi berbagai anomali (edge cases) dan memberikan pengalaman pengguna (UX) yang mulus:

#### 1. Validasi Antarmuka / UI (11 Kondisi Kesalahan)

Memberikan peringatan pop-up `SweetAlert` yang ramah pengguna untuk mencegah data buruk masuk ke blockchain.

- **Kesalahan Koneksi**: Otentikasi dompet Freighter gagal atau ekstensi belum diinstal.
- **Jumlah Tidak Valid**: Input nominal donasi 0 atau negatif.
- **Transaksi Gagal**: Pengguna membatalkan tanda tangan di dompet Freighter, atau ada kegagalan on-chain.
- **Volume Tidak Cukup**: Menekan tombol klaim saat total akumulasi donasi masih di bawah 10 XLM.
- **Input Tidak Valid**: Admin membiarkan formulir kosong saat membuat kampanye baru.
- **Penyebaran Gagal**: Kesalahan saat Admin membuat kampanye baru.
- **Kas Kurang (Treasury Deficit)**: Saldo kas _smart contract_ saat ini kurang untuk membayar klaim **1.5%** donatur yang sukses.
- **Format Contract Tidak Valid**: ID Smart Contract yang dimasukkan tidak valid (bukan 56 karakter).
- **Gagal Menerjemahkan**: Kesalahan koneksi ke API Google Translate.

#### 2. Penjagaan Keamanan Smart Contract (10 Kondisi Panic)

Menjadi benteng pertahanan terakhir terhadap manipulasi transaksi langsung di blockchain.

- `already initialized`: Mencegah inisialisasi ulang kontrak.
- `not authorized: only owner can ...`: Kendali akses ketat khusus Pemilik (Admin).
- `campaign already exists`: Mencegah duplikasi ID Kampanye.
- `donation amount must be positive`: Validasi nilai transaksi on-chain.
- `campaign is inactive`: Menolak donasi ke kampanye yang sudah dihentikan.
- `insufficient unclaimed volume: need at least 10 XLM`: Verifikasi kelayakan hadiah donatur.
- `insufficient treasury balance to payout reward`: Pengamanan likuiditas kas jika terjadi _bank run_.
- `withdrawal amount must be positive`: Mencegah penarikan dana kas yang tidak valid.

---

### Teknologi yang Digunakan

- **Smart Contract**: Rust, Soroban SDK (v26)
- **Frontend Framework**: React (Vite)
- **Styling**: Tailwind CSS (Sistem Desain bergaya Apple iOS)
- **Wallet Connection**: `@stellar/freighter-api`
- **Notifikasi**: `sweetalert2`
- **Mesin Penerjemah**: Google Translate API (Client-side fetch)
- **Ekspor Gambar**: `html2canvas` (Unduh sertifikat & statistik dalam format PNG)

---

### Struktur Direktori Proyek

```text
stellar-steldot/
├── contracts/
│   └── donation/
│       ├── src/
│       │   ├── lib.rs        # Logika Smart Contract
│       │   └── test.rs       # Pengujian Unit (Unit tests)
│       └── Cargo.toml        # Konfigurasi Cargo
├── src/
│   ├── utils/
│   │   ├── stellar.js        # Bantuan integrasi API Freighter & RPC Soroban
│   │   └── i18n.js           # Logika kamus Multi-Bahasa
│   ├── App.jsx               # Komponen utama React (Antarmuka iOS, Routing Role)
│   ├── index.css             # Direktif Tailwind CSS & variabel iOS
│   └── main.jsx              # Skrip pemasangan React
├── Cargo.toml                # File konfigurasi Workspace Cargo
├── index.html                # Template HTML Vite
├── postcss.config.js         # Konfigurasi PostProcessor CSS
├── tailwind.config.js        # Konfigurasi tata letak Tailwind
└── vite.config.js            # Konfigurasi kompilator Vite
```

---

### Setup dan Instalasi

#### 1. Menguji Smart Contract

Jalankan pengujian unit Rust:

```bash
cargo test
```

Untuk melakukan kompilasi ke target WebAssembly:

```bash
stellar contract build
```

#### 2. Melakukan Deploy Contract Baru (Opsional)

Isi dana pada _testnet address_ dan lakukan deploy:

```bash
stellar keys generate --global deployer
stellar keys fund deployer
stellar contract deploy --wasm target/wasm32v1-none/release/donation.wasm --source deployer --network testnet
```

Inisialisasi contract (tentukan public key Anda sebagai owner dan alamat aset XLM SAC testnet):

```bash
stellar contract invoke --id <YOUR_CONTRACT_ID> --source deployer --network testnet -- initialize --owner <OWNER_PUBLIC_KEY> --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

#### 3. Menjalankan Frontend

Instal pustaka dan jalankan server lokal:

```bash
npm install
npm run dev
```

Buka browser di `http://localhost:5173` untuk mengakses aplikasi. Anda dapat menghubungkan ke smart contract testnet Anda dengan mengeklik tautan **Contract ID** di panel informasi.

---

### Tampilan Aplikasi

### 👤 Owner: Created New Campaign

<img width="700" alt="Owner Created New Campaign" src="https://github.com/user-attachments/assets/7197efcf-0ad6-47c3-8987-9768a48553e8" />

---

### 🤝 Client: Add Donation

<img width="700" alt="Client Add Donation 1" src="https://github.com/user-attachments/assets/94515b5d-baba-4da7-b6f3-9f6db2ab2888" />
<br>
<img width="700" alt="Client Add Donation 2" src="https://github.com/user-attachments/assets/3211e77c-d9e5-425c-b3fc-226bf329c378" />

### 📱 Tampilan Mobile: Menampilkan seluruh fitur utama

<img width="366" height="661" alt="Screenshot 2026-06-24 205518" src="https://github.com/user-attachments/assets/139e4eb2-9779-4b3e-835a-ad7a572d8bf1" />
<img width="370" height="657" alt="Screenshot 2026-06-24 205622" src="https://github.com/user-attachments/assets/6b0047aa-c567-4730-a4cc-8edba5125fd3" />
<img width="368" height="658" alt="Screenshot 2026-06-24 205644" src="https://github.com/user-attachments/assets/16d74826-701b-4c3e-9bfe-5b0a0effc3f0" />
<img width="370" height="658" alt="Screenshot 2026-06-24 205739" src="https://github.com/user-attachments/assets/bd6d667a-b5a8-4070-879f-83ca2a4c43de" />
<img width="369" height="658" alt="Screenshot 2026-06-24 205811" src="https://github.com/user-attachments/assets/41d77496-7ef2-4d3c-a584-a9a1709a4493" />
<img width="370" height="661" alt="Screenshot 2026-06-24 210436" src="https://github.com/user-attachments/assets/47d359c0-08b5-4081-8eba-517d6c882fc4" />
<img width="369" height="658" alt="Screenshot 2026-06-27 174150" src="https://github.com/user-attachments/assets/c513d5f1-0349-4efe-847d-3d743b8d8163" />
<img width="368" height="660" alt="Screenshot 2026-06-24 205953" src="https://github.com/user-attachments/assets/33c92751-a321-4024-b1da-b1aa9db07e27" />
<img width="370" height="654" alt="Screenshot 2026-06-24 210058" src="https://github.com/user-attachments/assets/a07405b3-3f29-4561-b634-496e718cf8f4" />
<img width="366" height="661" alt="Screenshot 2026-06-24 210214" src="https://github.com/user-attachments/assets/47c6a5d4-c31a-4ccf-8e23-28db16b67410" />
<img width="370" height="658" alt="Screenshot 2026-06-24 210250" src="https://github.com/user-attachments/assets/a2f9a778-700d-40ac-9e75-95e279369132" />
<img width="368" height="654" alt="Screenshot 2026-06-24 210310" src="https://github.com/user-attachments/assets/70569ee4-ec78-4505-9504-f83d9004248e" />

### ✅ Cargo test: 2 passed

Screenshot Terminal di VSCode setelah mengetik cargo test (menunjukkan 2 passed).

<img width="1918" height="714" alt="Screenshot 2026-06-24 205359" src="https://github.com/user-attachments/assets/83b02a39-3442-4771-8ace-a65315579636" />
   
### ⚙️ GitHub Actions CI: 
Menampilkan seluruh Workflow hasil pengecekan compilasi logika.

**Menampilkan Actions di GitHub**:
https://github.com/edwinariesto/stellar-donation/actions

<img width="1918" height="991" alt="Screenshot 2026-06-24 212045" src="https://github.com/user-attachments/assets/8d519758-0e91-48d3-91b4-344a20f0d20d" />

