# StelDot — Platform Donasi Penghargaan Loyalitas Terdesentralisasi (Donate-to-Earn)

[English Version available in README.md](./README.md)

---

## 🇮🇩 Versi Bahasa Indonesia

### Deskripsi

StelDot adalah Aplikasi Terdesentralisasi (dApp) yang dibangun di atas jaringan Stellar menggunakan smart contract Soroban. Proyek ini menerapkan model loyalitas **Donate-to-Earn**.
Donatur dapat mendonasikan token XLM ke kampanye komunitas tertentu. Total volume donasi mereka dilacak secara real-time. Ketika total donasi yang belum diberi hadiah mencapai batas minimal **10 XLM**, donatur berhak mengklaim hadiah sebesar **5% dari total donasinya tersebut**. Pembayaran diproses secara instan dan otomatis oleh *smart contract*, lalu nominal volume donasinya di-reset menjadi 0 (riwayat akumulasi donasi seumur hidup tetap tersimpan utuh di blockchain).

---

### Informasi Smart Contract (Testnet)

- **Deployed Contract Address (ID)**: `CABKLAYMJR3WTCAAP4CYZHF7OKAAE47U62EHI2GIY276NNEUB4SGJVBD`
- **Lihat di Stellar Explorer**: [Tautan Kontrak di Stellar.Expert](https://stellar.expert/explorer/testnet/contract/CABKLAYMJR3WTCAAP4CYZHF7OKAAE47U62EHI2GIY276NNEUB4SGJVBD)
- **Asset/Token Address (Native XLM SAC)**: `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC`
- **Contoh Hash Transaksi (Contract Call)**: [`3524e594b555f10f1031d75611b0b55a93ef3f3eb3ace77d9c09b73daca58638`](https://stellar.expert/explorer/testnet/tx/3524e594b555f10f1031d75611b0b55a93ef3f3eb3ace77d9c09b73daca58638)

---

### Fitur Utama

#### Fitur Client (Donatur)

- **Kirim Donasi**: Kirim XLM dengan nominal bebas ke kampanye aktif.
- **Kategori Tab Pintar**: Navigasi mudah untuk melihat kampanye yang **Berjalan**, **Terkumpul Penuh**, atau **Dihentikan**.
- **Poin Loyalitas (Volume)**: Lacak volume donasi yang belum diklaim. Dapatkan persentase hadiah mutlak sebesar 5%.
- **Pencairan Instan**: Tarik hadiah 5% Anda secara seketika segera setelah volume mencapai ambang batas 10 XLM.
- **Integrasi Dompet**: Melihat saldo XLM Freighter yang terhubung secara otomatis.
- **Dukungan Multi-Bahasa**: Ubah bahasa UI antara Bahasa Indonesia dan Bahasa Inggris dengan mulus, dikendalikan oleh sistem lokalisasi kamus dinamis `i18n.js`.
- **Terjemahan Otomatis**: Integrasi Google Translate API untuk menerjemahkan judul dan deskripsi kampanye sesuai dengan preferensi bahasa Anda.
- **Pencarian & Pagination**: Cari kampanye berdasarkan ID atau Judul, dan navigasikan halaman dengan sistem _pagination_ yang rapi.

#### Fitur Owner (Administrator)

- **Dashboard Admin Premium**: Panel kontrol eksklusif di posisi atas untuk mengelola keseluruhan aplikasi.
- **Konfigurasi Smart Contract**: Terdapat tombol pengatur koneksi Smart Contract yang tertanam secara elegan di Dashboard Owner.
- **Buka Kampanye**: Tambahkan kampanye baru dengan ID unik, judul, deskripsi, dan target dana.
- **Edit Kampanye**: Perbarui detail kampanye yang sudah berjalan (seperti memperbaiki salah ketik, mengubah target, atau menonaktifkan kampanye).
- **Validasi Saldo**: Kontrak akan membatalkan transaksi otomatis jika saldo kas tidak mencukupi untuk membayar reward 5% milik donatur.

---

### 📖 Panduan Pengguna (Cara Menggunakan)

#### 🧑‍💻 Sebagai Klien / Donatur
1. **Hubungkan Dompet:** Klik tombol `Connect Freighter` di pojok kanan atas untuk menautkan dompet Stellar Anda. Pastikan jaringan berada di Testnet.
2. **Cari Kampanye:** Telusuri tab kampanye **Aktif**. Anda dapat menggunakan bilah pencarian untuk mencari kampanye tertentu.
3. **Donasi XLM:** Masukkan nominal (misal: `10.00`) di kotak input pada kartu kampanye dan klik **Donasi Sekarang**.
4. **Tanda Tangani Transaksi:** Setujui transaksi di ekstensi Freighter Anda. Volume donasi Anda akan tercatat langsung on-chain.
5. **Klaim Hadiah:** Setelah Anda mengakumulasi volume donasi sebesar **minimal 10 XLM**, buka bagian `Persetujuan Hadiah` di atas dan klik **Klaim Reward**.
6. **Pencairan Instan:** Klaim Anda diproses seketika! Hadiah sebesar 5% langsung dikirim ke dompet Anda tanpa menunggu admin, dan volume donasi untuk hadiah berikutnya di-reset.

#### 👑 Sebagai Pemilik / Admin
1. **Hubungkan Dompet Admin:** Hubungkan dompet Freighter yang memegang kunci pribadi (Private Key) dari Pemilik Kontrak. `Panel Pengaturan Admin` akan otomatis muncul.
2. **Atur ID Kontrak:** Anda dapat menghubungkan web ke Smart Contract lain menggunakan tombol **⚙️ Set Contract ID** secara permanen.
3. **Buat Kampanye:** Klik tombol **Buat Kampanye Baru** (ikon plus) untuk meluncurkan target penggalangan dana baru. Isi Judul, Deskripsi, dan Target XLM.
4. **Kelola Kampanye:** Klik ikon pensil hijau pada kampanye mana pun yang sudah ada untuk memperbarui detailnya atau menonaktifkannya.
5. **Tarik Dana Kas:** Gunakan tombol **Tarik Dana** di sebelah Saldo Kas (Treasury Balance) untuk mentransfer dana donasi yang terkumpul ke dompet Anda. Pastikan sisakan likuiditas agar donatur bisa mencairkan hadiah otomatisnya!

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
- **Kas Kurang (Treasury Deficit)**: Saldo kas *smart contract* saat ini kurang untuk membayar klaim 5% donatur yang sukses.
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
- `insufficient treasury balance to payout reward`: Pengamanan likuiditas kas jika terjadi *bank run*.
- `withdrawal amount must be positive`: Mencegah penarikan dana kas yang tidak valid.

---

### Teknologi yang Digunakan

- **Smart Contract**: Rust, Soroban SDK (v26)
- **Frontend Framework**: React (Vite)
- **Styling**: Tailwind CSS (Sistem Desain bergaya Apple iOS)
- **Wallet Connection**: `@stellar/freighter-api`
- **Notifikasi**: `sweetalert2`
- **Mesin Penerjemah**: Google Translate API (Client-side fetch)

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
