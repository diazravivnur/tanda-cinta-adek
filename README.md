# Nanti Kita Ketemu — PWA Pencatat Kontraksi & Tendangan Bayi

Aplikasi web progresif (PWA) untuk **Ibu Wulan** dan **Ayah Diaz** untuk mencatat kontraksi, memantau tendangan bayi, serta memberikan notifikasi otomatis saat pola kontraksi mengarah ke persalinan aktif (aturan 5-1-1).

---

## Prasyarat
- Node.js >= 20
- npm >= 10
- Java Runtime Environment (JRE) >= 11 (diperlukan oleh Firestore Emulator lokal)
- Firebase CLI (`firebase-tools`)

---

## Setup & Instalasi

1. **Salin file environment template:**
   ```bash
   cp .env.example .env
   cp functions/.env.example functions/.env
   cp .firebaserc.example .firebaserc
   ```
   > ⚠️ **PENTING:** Jangan pernah menuliskan atau meng-commit email asli, nomor telepon, atau kredensial ke repositori git.

2. **Instal dependensi root dan functions:**
   ```bash
   npm install
   npm --prefix functions install
   ```

---

## Konfigurasi Khusus Auth Google & iOS PWA Standalone

Di iPhone dengan mode PWA standalone (Home Screen), `signInWithPopup` tidak didukung dengan baik karena jendela popup terisolasi. Aplikasi ini menggunakan `signInWithRedirect` dengan konfigurasi domain custom:

1. **Konfigurasi `VITE_FIREBASE_AUTH_DOMAIN`**:
   Isi variabel ini di `.env` dengan domain Firebase Hosting aplikasi Anda (misal `your-project.web.app`), bukan hanya `your-project.firebaseapp.com`.
2. **Authorized Domains di Firebase Console**:
   Buka **Firebase Console -> Authentication -> Settings -> Authorized domains**, lalu tambahkan domain hosting Anda.
3. **Authorized Redirect URIs di Google Cloud Console**:
   Buka **Google Cloud Console -> APIs & Services -> Credentials**, edit OAuth 2.0 Client ID jenis Web application, lalu tambahkan URI berikut ke bagian **Authorized redirect URIs**:
   ```
   https://<domain-hosting>/__/auth/handler
   ```
4. **Persistence Akun**:
   Aplikasi secara eksplisit mengonfigurasi `indexedDBLocalPersistence` agar sesi login tetap bertahan ketika pengguna menutup atau membuka kembali PWA dari Layar Utama iOS.

---

## Menjalankan Aplikasi & Pengujian

- **Menjalankan Pengujian Emulator Suite (M1):**
   ```bash
   npm run test:emulator
   ```
   Perintah ini akan secara otomatis:
   - Melakukan kompilasi TypeScript untuk Cloud Functions (`functions/lib`).
   - Menjalankan Firebase Emulator Suite (Auth, Firestore, Functions, Hosting) menggunakan `firebase emulators:exec`.
   - Menjalankan suite pengujian integration test `tests/m1-auth-access.test.ts` (menggunakan dummy email yang terisolasi).
   - Mematikan emulator kembali secara otomatis setelah seluruh pengujian selesai.

- **Menjalankan Unit Test Frontend:**
   ```bash
   npm test
   ```

- **Menjalankan Emulator Secara Interaktif (Lokal Dev):**
   ```bash
   npx firebase emulators:start
   ```
   Emulator yang aktif:
   - Auth: `http://localhost:9099`
   - Firestore: `http://localhost:8080`
   - Functions: `http://localhost:5001`
   - Hosting: `http://localhost:5000`
   - Emulator UI: `http://localhost:4000`

- **Mode Pengembangan Frontend (Vite):**
   ```bash
   npm run dev
   ```

- **Linter & Format Check:**
   ```bash
   npm run lint
   npm run format:check
   ```

- **Build Produksi:**
   ```bash
   npm run build
   ```

---

## Arsitektur Keamanan & Otorisasi

### 1. Firestore Security Rules
- **Akses Dokumen Couple (`couples/{coupleId}`)**:
  - Hanya pengguna yang `uid`-nya tercatat dalam array `members` dokumen couple yang diizinkan membaca (`allow read`).
  - Update hanya diizinkan untuk data operasional umum (misal nomor telepon, preferensi).
  - Klien dilarang keras mengubah anggota atau mapping peran:
    ```
    !request.resource.data.diff(resource.data).affectedKeys().hasAny(['members', 'roles'])
    ```
  - Pembuatan dan penghapusan dokumen `couples` ditutup total untuk klien (`allow create, delete: if false`) dan hanya dapat dibuat oleh Cloud Functions via Admin SDK.
- **Akses Subkoleksi (`couples/{coupleId}/**`)**:
  - Seluruh subkoleksi (`contractions`, `contractionSessions`, `kickSessions`, dll.) hanya dapat dibaca dan ditulis oleh member couple terkait.
- **Akses Dokumen Pengguna (`users/{uid}`)**:
  - Klien tidak dapat membuat dokumen profil `users` baru sendiri secara langsung.
  - Klien hanya dapat memperbarui `fcmTokens`, `displayName`, dan `updatedAt` miliknya. Field `role` dan `coupleId` dikunci dari modifikasi sisi klien.

### 2. Catatan Penting Keamanan Notifikasi & Peran
> **PERINGATAN ARSITEKTUR:**
> Penyebab dan penerima notifikasi (pada Cloud Functions / trigger notifikasi) **HARUS selalu ditentukan dari `couples/{coupleId}.members` dan `couples/{coupleId}.roles`**, **BUKAN** dari field `role` di dokumen `users/{uid}`.
>
> Hal ini menjamin bahwa seluruh alur pengiriman pesan darurat dan push notification selalu terikat pada state pasangan resmi yang divalidasi oleh database, bukan dari metadata pengguna.
