# SPEC — "Nanti Kita Ketemu" (nama sementara) — PWA Pencatat Kontraksi & Tendangan Bayi

Aplikasi pribadi untuk **Ibu Wulan Asri Septia** dan **Ayah Diaz Raviv Nur**.
Tujuan: memudahkan ibu hamil mencatat kontraksi & tendangan bayi, menilai apakah pola kontraksi sudah mengarah ke persalinan aktif, dan memberi tahu suami secara otomatis.

> **Disclaimer wajib di app (halaman Pengaturan + onboarding):** App ini alat bantu pencatat, bukan pengganti penilaian bidan/dokter. Perdarahan, ketuban pecah, nyeri hebat terus-menerus, atau gerakan bayi berkurang drastis → **langsung hubungi tenaga kesehatan / ke RS**, tanpa menunggu pola 5-1-1.

---

## 1. Keputusan yang sudah dikunci

| Topik | Keputusan |
|---|---|
| Perangkat | Keduanya **iPhone (iOS)**. PWA wajib di-install ke Home Screen agar push berfungsi; iOS minimal 16.4, disarankan 18.4+ (lihat §10 Catatan khusus iOS) |
| Frontend | React + Vite + TypeScript, `vite-plugin-pwa` |
| Auth | Firebase Authentication — Google Sign-In saja |
| Database | Cloud Firestore (offline persistence aktif) |
| Notifikasi | FCM Web Push + Cloud Functions (2nd gen), Firebase paket **Blaze** + budget alert |
| Usia kehamilan | 37 minggu per 24 Okt 2026 → **sudah cukup bulan**, tidak perlu label "prematur". Estimasi HPL ≈ 14 Nov 2026 (bisa diubah di Pengaturan) |
| Alert kontraksi | Aturan 5-1-1, notifikasi bertahap (Info → Waspada → URGENT) |
| Notifikasi tendangan | **Tidak ada push per kejadian.** Suami menerima **ringkasan harian** saja |
| Nomor darurat | Hanya nomor Ayah Diaz (tombol "Telepon Ayah" di app Ibu Wulan) |
| Gaya visual | Kontras tinggi, minimalis, tombol sangat besar, dark mode otomatis malam |
| Ekspor | Riwayat bisa diekspor ke PDF (via print stylesheet / jsPDF) |
| Bahasa UI | Indonesia |

---

## 2. Pengguna & Peran

- **Wulan (role: `ibu`)**: mencatat kontraksi & tendangan, melihat status pola, menelepon suami, mengatur HPL.
- **Diaz (role: `ayah`)**: menerima notifikasi, dashboard live, bisa membantu mencatat, tombol "Saya menuju" (acknowledge).
- Akses **dikunci ke 2 email**. Akun Google lain tidak boleh membaca/menulis data apa pun.

---

## 3. Arsitektur

```
[PWA Wulan] ─┐                          ┌─> FCM ─> [PWA Diaz]
             ├─> Firestore ─(trigger)─> Cloud Functions
[PWA Diaz]  ─┘                          └─> FCM ─> [PWA Wulan] (ack "Ayah menuju")
                                  scheduled fn (20:00 WIB) ─> ringkasan harian ke Diaz
```

### Struktur proyek

```
/
├─ src/
│  ├─ app/            (router, providers, auth guard)
│  ├─ features/
│  │   ├─ contractions/   (timer, list, patternEngine.ts, hooks)
│  │   ├─ kicks/          (counter, session, hooks)
│  │   ├─ history/        (timeline, charts, exportPdf)
│  │   ├─ dashboard/      (tampilan live suami)
│  │   └─ settings/
│  ├─ lib/ (firebase.ts, messaging.ts, wakeLock.ts, haptics.ts, time.ts)
│  ├─ config/thresholds.ts   ← semua angka 5-1-1 di sini, mudah diubah
│  └─ sw (firebase-messaging-sw.js)
├─ functions/  (TypeScript)
│  ├─ onContractionWrite.ts
│  ├─ onUrgentCall.ts
│  ├─ dailyKickSummary.ts
│  └─ joinCouple.ts   (callable, allowlist email)
├─ firestore.rules
├─ firebase.json
└─ SPEC.md
```

---

## 4. Fitur 1 — Pencatat Kontraksi

### 4.1 Interaksi
- Satu tombol bulat besar (≥ 220 px) di tengah layar: **MULAI** ⇄ **SELESAI**.
- Saat berjalan: timer detik besar, umpan balik saat mulai/selesai berupa perubahan warna layar penuh + bunyi klik singkat (Web Audio, bisa dimatikan; `navigator.vibrate` tidak didukung iOS), layar dijaga menyala (Wake Lock API; andal untuk PWA terinstall mulai iOS 18.4).
- Setelah **SELESAI**: sheet opsional (bisa diabaikan, auto-hilang 5 detik): intensitas 1–3 + catatan singkat.
- Di bawah tombol: status pola terkini (kartu berwarna + teks besar), lalu daftar 10 kontraksi terakhir (mulai, durasi, interval).
- Tombol sekunder permanen: **"Telepon Ayah Diaz"** (`tel:`), dan **"Saya perlu ke RS sekarang"** (konfirmasi 1 ketukan lalu kirim URGENT).
- Hapus/koreksi: swipe pada item untuk menghapus entri yang salah tekan.

### 4.2 Data & sesi
- Dokumen kontraksi dibuat saat **MULAI** (`endAt = null`), di-update saat **SELESAI**.
- **Sesi** baru dimulai jika jeda dari kontraksi terakhir > **60 menit** (`SESSION_GAP_MIN`).
- `interval` = selisih `startAt` kontraksi ini dengan `startAt` kontraksi sebelumnya (dalam sesi yang sama).
- Offline: tulis ke Firestore tetap berjalan (cache lokal), sinkron saat online. Timestamp memakai waktu perangkat saat ditekan.

### 4.3 Mesin klasifikasi pola (`patternEngine.ts`)

Konstanta di `config/thresholds.ts` dan bisa diubah dari Pengaturan (karena sebagian dokter memakai 4-1-1 / 3-1-1 / 10 menit untuk ibu tertentu):

```ts
export const THRESHOLDS = {
  SESSION_GAP_MIN: 60,
  ACTIVE_INTERVAL_MAX_SEC: 5 * 60,     // "5"
  ACTIVE_DURATION_MIN_SEC: 60,         // "1"
  ACTIVE_SUSTAINED_MIN: 60,            // "1" jam
  ACTIVE_INTERVAL_TOLERANCE_SEC: 7 * 60, // toleransi per interval
  ACTIVE_TOLERANCE_RATIO: 0.8,         // 80% interval harus ≤ toleransi
  REGULAR_MIN_COUNT: 4,                // jumlah interval minimum
  REGULAR_MAX_CV: 0.25,                // coefficient of variation (keteraturan)
  REGULAR_INTERVAL_MAX_SEC: 10 * 60,
};
```

Output `PatternStatus`:

| Status | Kondisi (input: kontraksi dalam sesi aktif) | Pesan UI |
|---|---|---|
| `INSUFFICIENT` | < 3 kontraksi | "Terus catat. Butuh beberapa kontraksi untuk melihat pola." |
| `IRREGULAR` | Tidak memenuhi `REGULAR` | "Pola belum teratur — kemungkinan kontraksi palsu. Coba minum, ganti posisi, istirahat." |
| `REGULAR` | ≥ 4 interval terakhir, CV ≤ 0.25, median interval ≤ 10 menit | "Pola mulai teratur. Tetap pantau." |
| `ACTIVE_511` | Dalam ≥ 60 menit terakhir: median interval ≤ 5 menit, ≥ 80% interval ≤ 7 menit, median durasi ≥ 60 detik | "Pola 5-1-1 terpenuhi. Saatnya hubungi bidan/dokter & berangkat ke RS." |

Tambahan: hitung **tren** (slope interval; makin menurun = makin rapat) dan tampilkan ikon panah naik/turun sebagai petunjuk, bukan penentu klasifikasi.
Engine harus **pure function** + unit test (Vitest) dengan skenario: Braxton Hicks acak, awal teratur, 5-1-1 penuh, data bolong, sesi baru setelah jeda.

### 4.4 Notifikasi ke suami (di Cloud Functions, bukan di client)

Satu sesi punya `notifiedLevel` (0..3) yang **hanya naik**, sehingga tidak ada spam.

| Level | Trigger | Judul | Perilaku |
|---|---|---|---|
| 1 INFO | Kontraksi pertama sesi baru dibuat | "Wulan mulai mencatat kontraksi" | Prioritas normal |
| 2 WASPADA | Status naik ke `REGULAR` | "Kontraksi Wulan mulai teratur (tiap ±X mnt)" | Prioritas tinggi |
| 3 URGENT | Status `ACTIVE_511` **atau** tombol manual "ke RS" | "SEGERA: Pola 5-1-1 terpenuhi" | Prioritas tertinggi + bunyi notifikasi. Tap notifikasi membuka layar URGENT dengan tombol besar **Telepon Wulan** & **Saya menuju** (iOS tidak mendukung tombol aksi di dalam notifikasi) |

- Pengulangan URGENT: ulangi maksimal tiap **15 menit** selama belum ada acknowledge dari Diaz.
- **Acknowledge**: tombol "Saya menuju" di layar URGENT (terbuka dari notifikasi) atau di dashboard menulis `ackBy/ackAt` pada sesi, lalu Wulan menerima push "Ayah Diaz sedang menuju" dan pengulangan berhenti.
- Payload memakai `webpush.headers.Urgency = high` dan `TTL` pendek (≤ 10 menit), supaya cepat sampai.
- **iOS:** setiap push wajib memunculkan notifikasi yang terlihat (tidak boleh silent push, kalau tidak langganan push bisa dicabut iOS). Service worker selalu memanggil `showNotification`.
- **Cadangan:** jika URGENT belum di-acknowledge dalam 5 menit, app Wulan menampilkan banner "Ayah belum menanggapi — telepon sekarang" dengan tombol telepon.

---

## 5. Fitur 2 — Pencatat Tendangan

Karena usia 37 minggu, fitur ini aktif sejak hari pertama.

- Tombol besar **"Bayi menendang"**; tiap ketukan = 1 hitungan (+ umpan balik visual & bunyi klik singkat).
- **Metode hitung sampai 10**: sesi dimulai pada ketukan pertama; otomatis selesai di 10 dan menyimpan durasi total.
- Peringatan di app Wulan (bukan push ke suami): jika 2 jam berlalu tanpa mencapai 10 → banner merah "Gerakan bayi terasa kurang. Hubungi bidan/dokter," dengan tombol telepon Ayah Diaz dan tombol "Kirim kabar ke Ayah" (opsional, manual).
- Anjuran UI: lakukan di jam yang sama tiap hari, posisi miring kiri / istirahat.
- Riwayat: daftar sesi per hari, grafik "waktu mencapai 10" 14 hari terakhir.
- Pengingat harian opsional (lokal via notifikasi terjadwal dari Cloud Function ke Wulan, jam default 19:00).
- Koreksi: tombol "Batalkan ketukan terakhir".

### 5.1 Ringkasan harian ke suami (`dailyKickSummary`)
- Scheduled function, **setiap hari 20:00 WIB** (`Asia/Jakarta`).
- Isi: jumlah sesi hari ini, waktu mencapai 10 tiap sesi, rata-rata, bendera ⚠️ jika ada sesi yang tidak mencapai 10 dalam 2 jam, atau "belum ada pencatatan hari ini".
- Dikirim sebagai push + tersimpan di `dailySummaries/{yyyy-mm-dd}` agar bisa dilihat di dashboard.

---

## 6. Dashboard Suami (live)

Memakai Firestore realtime listener:
- Kartu status: "Tidak ada kontraksi aktif" / "Kontraksi berlangsung (timer)" / status pola + interval median terakhir.
- Kartu tendangan hari ini: jumlah sesi & hasil.
- Tombol: **Telepon Wulan**, **Saya menuju**.
- Daftar kontraksi sesi aktif (read-only atau bisa dikoreksi).

---

## 7. Layar

1. **Login** — logo, satu tombol "Masuk dengan Google", teks disclaimer kecil.
2. **Onboarding (sekali)** — panduan instal iOS (Safari → Bagikan → Tambah ke Layar Utama, lalu buka dari ikon), tombol "Aktifkan notifikasi" (izin harus diminta lewat ketukan di dalam app yang sudah terinstall), panduan Fokus/Jangan Ganggu (izinkan app ini), saran matikan Low Power Mode saat persalinan, baca disclaimer.
3. **Beranda** — countdown HPL, dua kartu besar (Kontraksi, Tendangan), status terakhir.
4. **Kontraksi** — lihat §4.1.
5. **Tendangan** — lihat §5.
6. **Riwayat** — tab Kontraksi / Tendangan, filter tanggal, tombol **Ekspor PDF**.
7. **Dashboard Ayah** — lihat §6 (beranda default untuk role `ayah`).
8. **Pengaturan** — HPL, nomor telepon Diaz (& Wulan), ambang 5-1-1, jam ringkasan, status izin notifikasi, tema (otomatis/terang/gelap), keluar.

### Ekspor PDF
Halaman print-friendly (`@media print`) berisi: identitas ibu, HPL, tabel kontraksi per sesi (mulai, durasi, interval), ringkasan pola, tabel sesi tendangan, tanggal cetak. Awalnya cukup tombol "Cetak / Simpan PDF" lewat `window.print()`; jsPDF opsional di fase berikutnya.

---

## 8. Desain Visual (kontras tinggi)

- **Prinsip:** terbaca saat sedang sakit, tegang, atau gelap. Satu aksi utama per layar.
- Teks min 18 px; tombol utama ≥ 220 px diameter; target sentuh sekunder ≥ 56 px.
- Warna (token CSS), kontras WCAG AA minimal (target AAA untuk teks utama):

| Token | Terang | Gelap |
|---|---|---|
| `--bg` | `#FFFFFF` | `#0A0A0F` |
| `--text` | `#0A0A0F` | `#FFFFFF` |
| `--primary` (kontraksi) | `#C2185B` | `#FF5C8A` |
| `--secondary` (tendangan) | `#0057B8` | `#5CA8FF` |
| `--ok` | `#0B6B2E` | `#4ADE80` |
| `--warn` | `#8A5A00` | `#FFC24A` |
| `--danger` | `#B00020` | `#FF6B6B` |

- Dark mode otomatis: mengikuti `prefers-color-scheme` **dan** otomatis gelap 19:00–05:00 (bisa dimatikan).
- Status pola tidak hanya warna: selalu ada ikon + teks.
- Animasi minimal; hormati `prefers-reduced-motion`.
- Font sistem (cepat, offline): `system-ui`, angka timer memakai `font-variant-numeric: tabular-nums`.

---

## 9. Model Data (Firestore)

```
couples/{coupleId}                    // satu dokumen untuk pasangan ini
  members: [uidWulan, uidDiaz]
  roles: { uidWulan: "ibu", uidDiaz: "ayah" }
  hplDate: Timestamp
  gestationWeeksAtSetup: 37
  phones: { ayah: "+62...", ibu: "+62..." }      // diisi di Pengaturan
  thresholds: {...}                              // override opsional
  /contractions/{id}
      startAt, endAt|null, durationSec|null, intervalSec|null
      sessionId, intensity?, note?, createdBy
  /contractionSessions/{sessionId}
      startedAt, lastContractionAt, status(pattern), notifiedLevel,
      lastUrgentSentAt, ackBy?, ackAt?
  /kickSessions/{id}
      startAt, taps: [Timestamp], count, reachedTenAt|null, durationSec|null,
      timedOut(bool), createdBy
  /dailySummaries/{yyyy-mm-dd}  sessions, avgSecTo10, flags[], sentAt
users/{uid}
  displayName, email, role, coupleId, fcmTokens: [{token, ua, updatedAt}]
```

Indeks komposit: `contractions` (sessionId ASC, startAt ASC), `kickSessions` (startAt DESC).

### Akses & allowlist
- Cloud Function **callable `joinCouple`**: dipanggil setelah login pertama. Memeriksa email pengguna terhadap env var `ALLOWED_EMAILS` (dua email) → menambahkan `uid` ke `members` dan menetapkan role. Email lain ditolak. (Tidak memakai blocking function agar tidak perlu upgrade ke Identity Platform.)
- `.env` functions (jangan commit): `ALLOWED_EMAILS=<email_wulan>,<email_diaz>`.

### `firestore.rules` (acuan)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function isMember(coupleId) {
      return request.auth != null &&
        request.auth.uid in get(/databases/$(db)/documents/couples/$(coupleId)).data.members;
    }
    match /couples/{coupleId} {
      allow read: if isMember(coupleId);
      allow update: if isMember(coupleId);           // client tak boleh mengubah members/roles
      allow create, delete: if false;                 // dibuat via Admin/Functions
      match /{sub=**} { allow read, write: if isMember(coupleId); }
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

> Penguatan: tambahkan validasi bahwa `update` pada `couples/{id}` tidak menyentuh `members`/`roles` (`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`).

---

## 10. Persyaratan PWA

- Manifest: nama, ikon 192/512 + maskable, `display: standalone`, `theme_color`, `lang: id`, orientation portrait.
- Service worker: precache aset (Workbox), `firebase-messaging-sw.js` untuk background push (satu SW atau digabung dengan benar — jangan dua SW saling menimpa).
- Offline-first: Firestore `persistentLocalCache`; indikator "Offline — tersimpan di HP, akan terkirim saat online".
- Panduan instal iOS di onboarding (iOS tidak punya `beforeinstallprompt`). Deteksi `display-mode: standalone`; selama belum terinstall, fitur notifikasi dikunci dan layar menampilkan panduan. Tambahkan `apple-touch-icon` 180×180 dan meta `apple-mobile-web-app-capable`.
- Token FCM disimpan per perangkat, dibersihkan saat gagal kirim (`messaging/registration-token-not-registered`).
- Hosting: Firebase Hosting (HTTPS wajib untuk service worker & push).

### Catatan khusus iOS (batasan & mitigasi)

| Batasan iOS | Mitigasi di desain |
|---|---|
| Web push hanya jalan jika PWA terinstall ke Home Screen (iOS 16.4+) dan izin diminta lewat gestur pengguna | Onboarding langkah demi langkah, fitur notifikasi dikunci sampai mode standalone terdeteksi |
| Tombol aksi di notifikasi tidak didukung | Tap notifikasi → deep link `/urgent/:sessionId` berisi tombol besar Telepon & "Saya menuju" |
| `navigator.vibrate` tidak didukung | Umpan balik visual + bunyi klik |
| Fokus / Jangan Ganggu / Sleep dapat membisukan notifikasi (risiko tinggi saat persalinan malam hari). Jangan mengandalkan level "Time Sensitive" untuk web push | Onboarding wajib: Pengaturan → Fokus → Izinkan App → tambahkan PWA ini, di kedua iPhone |
| Low Power Mode dapat menunda aktivitas latar belakang | Saran di onboarding: matikan saat persalinan dan jaga baterai > 30% |
| Wake Lock di PWA terinstall baru andal mulai iOS 18.4 | Di versi lebih lama tampilkan saran: atur Auto-Lock ke "Tidak Pernah" selama mencatat |
| `signInWithPopup` sering bermasalah di mode standalone | Pakai `signInWithRedirect` dengan `authDomain` di domain Hosting sendiri; wajib diuji di mode standalone iPhone |
| Reliabilitas push di iOS lebih rendah dibanding native | Banner cadangan 5 menit + tombol telepon (§4.4), dan uji nyata sebelum hari-H |

---

## 11. Biaya & Setup Firebase

1. Buat proyek Firebase, aktifkan **Authentication → Google**.
2. Buat **Firestore** (region `asia-southeast2` Jakarta), deploy `firestore.rules` & indeks.
3. Upgrade ke **Blaze** (wajib untuk Cloud Functions) → pasang **Budget alert** (mis. Rp20.000, notifikasi email).
4. **Cloud Messaging**: buat Web Push certificate (VAPID key) → `VITE_FIREBASE_VAPID_KEY`.
5. Deploy Hosting + Functions (`firebase deploy`). Atur timezone scheduled function ke `Asia/Jakarta`.
6. Isi env `ALLOWED_EMAILS` dan nomor telepon di Pengaturan setelah login.
7. Di kedua iPhone: buka URL di Safari → Bagikan → Tambah ke Layar Utama, buka dari ikon, izinkan notifikasi, tambahkan app ke daftar yang diizinkan di Fokus, uji kirim notifikasi dengan layar terkunci dan Fokus aktif.

Estimasi biaya: 2 pengguna ≈ ribuan operasi per hari, jauh di bawah kuota gratis Firestore/Functions/FCM → praktis Rp0.

---

## 12. Rencana Pengerjaan (prompt per milestone untuk Antigravity)

**M0 — Scaffold & Firebase**
> Buat proyek Vite + React + TS + `vite-plugin-pwa`. Pasang Firebase SDK (Auth, Firestore dengan persistentLocalCache, Messaging). Siapkan struktur folder sesuai SPEC.md §3, ESLint, Prettier, Vitest, `.env.example`.

**M1 — Auth & akses**
> Implementasi Google Sign-In (pakai `signInWithRedirect`, teruji di mode standalone iOS), auth guard, callable function `joinCouple` dengan allowlist email, dan `firestore.rules` sesuai §9. Tes dengan Firebase Emulator Suite, termasuk skenario email tidak diizinkan.

**M2 — Mesin pola kontraksi**
> Implementasi `patternEngine.ts` pure function sesuai §4.3 + unit test lengkap. Tidak ada UI dulu.

**M3 — UI Kontraksi**
> Layar Kontraksi (§4.1): tombol besar, timer, Wake Lock, haptics, daftar terakhir, koreksi, tombol telepon & "ke RS". Tema kontras tinggi sesuai §8.

**M4 — Notifikasi**
> FCM: registrasi token, service worker, Cloud Functions `onContractionWrite` (level 1–3, anti-spam, ulang 15 menit), acknowledge "Saya menuju", payload high priority. Uji di iPhone sungguhan (PWA terinstall, layar terkunci, Fokus aktif).

**M5 — Tendangan**
> Layar Tendangan (§5), banner 2 jam, `dailyKickSummary` 20:00 WIB, pengingat harian.

**M6 — Dashboard Ayah & Riwayat**
> Dashboard live (§6), riwayat + grafik, halaman print-friendly untuk ekspor PDF.

**M7 — Polish & uji lapangan**
> Onboarding, panduan instal iOS, offline indicator, aksesibilitas (kontras, ukuran, reduced-motion), uji skenario penuh dengan data simulasi, uji baterai/notifikasi layar terkunci.

---

## 13. Kriteria Penerimaan

- Mencatat kontraksi dengan **≤ 2 ketukan** per kontraksi, bekerja offline.
- Notifikasi Level 3 sampai ke HP Ayah dalam **< 10 detik** pada koneksi normal, walau app tertutup dan layar terkunci (diuji di iPhone, PWA terinstall).
- Tap notifikasi URGENT langsung membuka layar dengan tombol Telepon & "Saya menuju".
- Hanya 2 email yang bisa masuk dan membaca data (diuji dengan akun ketiga).
- Pola 5-1-1 disimulasikan → URGENT terkirim sekali, ulangan tiap 15 menit sampai "Saya menuju".
- Ringkasan harian terkirim pukul 20:00 WIB, termasuk kasus "tidak ada pencatatan".
- Lighthouse: PWA installable, kontras lulus, Accessibility ≥ 95.
- Disclaimer medis tampil di onboarding dan Pengaturan.

---

## 14. Yang perlu diisi sebelum mulai coding

- [ ] Email Google Wulan & Diaz (untuk `ALLOWED_EMAILS`)
- [ ] Nomor telepon Ayah Diaz (disimpan di Pengaturan, bukan di kode)
- [ ] Konfirmasi tanggal HPL dari dokter/bidan (estimasi sementara 14 Nov 2026)
- [ ] Apakah dokter/bidan memberi ambang khusus selain 5-1-1 (mis. 4-1-1 / 3-1-1)?
- [ ] Nama aplikasi dan ikon final
- [ ] Versi iOS kedua iPhone (minimal 16.4, disarankan 18.4+)
