# StelDot — Platform Donasi Penghargaan Loyalitas Terdesentralisasi (Donate-to-Earn)

[English Version available in README.md](./README.md)

---

## 🇮🇩 Versi Bahasa Indonesia

### Deskripsi

StelDot adalah Aplikasi Terdesentralisasi (dApp) yang dibangun di atas jaringan Stellar menggunakan smart contract Soroban. Proyek ini menerapkan model loyalitas **Donate-to-Earn**.
Donatur dapat mendonasikan token XLM ke kampanye komunitas tertentu. Setiap kali donasi dikirimkan (berapapun jumlahnya), donatur mendapatkan **1 Poin Loyalitas**. Ketika poin mencapai 10, donatur dapat mengklaim reward sebesar **1.00 XLM**. Poin aktif akan di-reset menjadi 0 setelah disetujui admin, namun riwayat donasi historis akan tetap tercatat di blockchain selamanya. Klaim ganda dicegah dengan mengunci status klaim menjadi "Pending" hingga disetujui owner.

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
- **Poin Loyalitas**: Kumpulkan 1 poin per donasi, pantau poin aktif secara real-time.
- **Klaim Reward**: Ajukan penarikan 1.00 XLM jika poin mencapai >= 10.
- **Integrasi Dompet**: Melihat saldo XLM Freighter yang terhubung secara otomatis.
- **Pencegahan Double Claim**: Tombol klaim terkunci saat status pending.
- **Dukungan Multi-Bahasa**: Ubah bahasa UI antara Bahasa Indonesia dan Bahasa Inggris dengan satu klik.
- **Terjemahan Otomatis**: Integrasi Google Translate API untuk menerjemahkan judul dan deskripsi kampanye sesuai dengan preferensi bahasa Anda.
- **Pencarian & Pagination**: Cari kampanye berdasarkan ID atau Judul, dan navigasikan halaman dengan sistem _pagination_ yang rapi.

#### Fitur Owner (Administrator)

- **Dashboard Admin Premium**: Panel kontrol eksklusif di posisi atas untuk mengelola keseluruhan aplikasi.
- **Buka Kampanye**: Tambahkan kampanye baru dengan ID unik, judul, deskripsi, dan target dana.
- **Edit Kampanye**: Perbarui detail kampanye yang sudah berjalan (seperti memperbaiki salah ketik, mengubah target, atau menonaktifkan kampanye).
- **Otorisasi Klaim**: Pantau antrean donatur dan setujui pencairan dana 1.00 XLM.
- **Validasi Saldo**: Kontrak akan membatalkan transaksi jika saldo kas di bawah 1.00 XLM, mencegah penarikan defisit.

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
