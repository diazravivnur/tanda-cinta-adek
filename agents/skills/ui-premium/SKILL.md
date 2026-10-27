---
name: ui-premium
description: Panduan desain UI untuk PWA pencatat kontraksi dan tendangan bayi (iPhone, kontras tinggi). Gunakan setiap kali membuat atau mengubah layar, komponen, gaya CSS, ikon, animasi, atau teks antarmuka agar hasilnya terlihat profesional, tenang, dan tidak generik.
---

# UI Premium — Panduan Desain

Tujuan: terasa seperti app kesehatan premium buatan tim desain, bukan template. Dipakai oleh ibu hamil yang sedang tegang atau kesakitan dan oleh suami yang panik. Jelas dan tenang lebih penting daripada hiasan.

## Prinsip
1. **Satu aksi utama per layar.** Tombol utama selalu paling dominan.
2. **Kontras tinggi, tenang, banyak ruang kosong.** Tidak ada elemen dekoratif yang tidak punya fungsi.
3. **Terasa native iOS:** font sistem (`system-ui` = SF Pro di iPhone), tab bar bawah, sheet dari bawah, gestur swipe.
4. Setiap keputusan visual harus bisa dijelaskan dengan fungsi, bukan "biar bagus".

## Dilarang (tanda-tanda "buatan AI")
- Gradasi ungu/biru-pink, blob blur, glassmorphism berlebihan, neon glow.
- Emoji sebagai ikon UI. Gunakan SATU set ikon SVG (Lucide, stroke 2px) di seluruh app.
- Semua elemen berupa kartu `rounded-2xl` dengan bayangan tebal yang sama.
- Layar serba rata tengah dengan judul besar + subjudul generik.
- Teks generik: "Selamat datang di aplikasi...", "Terjadi kesalahan", lorem ipsum, tanda seru berlebihan.
- Animasi memantul (bounce), animasi terus-menerus tanpa fungsi.
- Warna hardcode di komponen. Semua warna harus lewat token CSS.

## Design tokens (satu sumber: `src/styles/tokens.css`)
Gunakan token warna dari SPEC.md bagian 8 (`--bg`, `--text`, `--primary`, `--secondary`, `--ok`, `--warn`, `--danger`) untuk mode terang dan gelap. Tambahkan:
- `--surface` (kartu), `--surface-2` (lapisan kedua), `--border` (garis 1px kontras rendah), `--text-muted`.
- **Spacing** skala 4px: 4, 8, 12, 16, 24, 32, 48.
- **Radius**: 12 (kontrol), 20 (kartu/sheet), 999 (tombol utama & badge).
- **Elevation**: utamakan border 1px; bayangan hanya untuk sheet/modal dan sangat halus.
- **Durasi**: 120ms (tekan), 200ms (transisi), 320ms (sheet). Easing `cubic-bezier(0.2, 0, 0, 1)`.
- Hormati `prefers-reduced-motion` (matikan semua animasi non-esensial).

## Tipografi
- Font: `system-ui, -apple-system, "SF Pro Text", sans-serif`. Jangan memuat font eksternal.
- Skala: timer 80–96px (berat 600, `font-variant-numeric: tabular-nums`, letter-spacing -0.02em), judul layar 28px/600, judul kartu 20px/600, isi 18px/400, keterangan 15px/400 (jangan lebih kecil).
- Line-height 1.4 untuk isi, 1.1 untuk angka besar.

## Komponen inti (buat dulu sebelum layar, di `src/components/ui/`)
`Button` (primary/secondary/danger/ghost, tinggi min 56px), `BigRecordButton` (bulat ≥ 220px, state idle/running dengan cincin halus yang berdenyut pelan saat berjalan, tekan = scale 0.97), `Card`, `StatusBadge` (ikon + teks, tidak hanya warna), `TabBar` (bawah, 3–4 item, ikon + label), `Sheet` (bottom sheet), `Stat` (angka besar + label), `Banner` (info/warn/danger), `Skeleton`, `EmptyState`.
Semua layar disusun dari komponen ini. Tidak boleh ada gaya ad-hoc yang menduplikasi komponen.

## Detail khusus PWA iPhone
- `viewport-fit=cover`; pakai `env(safe-area-inset-top/bottom)` untuk header dan TabBar.
- Target sentuh ≥ 56px; `touch-action: manipulation`; `-webkit-tap-highlight-color: transparent`; `user-select: none` pada tombol; `overscroll-behavior: none`.
- `theme-color` dan `background_color` manifest sama dengan `--bg` agar tidak ada kilatan putih saat dibuka.
- Input teks min 16px agar iOS tidak zoom otomatis.
- Tidak mengandalkan hover.

## Isi & gaya bahasa (Bahasa Indonesia)
- Hangat, singkat, menenangkan, tanpa jargon. Contoh: "Pola belum teratur. Coba minum dan ganti posisi." bukan "Status: IRREGULAR".
- Istilah konsisten: "Kontraksi", "Tendangan", "Ayah Diaz", "Ibu Wulan".
- Pesan error menjelaskan apa yang bisa dilakukan berikutnya.
- Ilustrasi untuk empty state: SVG sederhana buatan sendiri satu gaya (garis, 2 warna token), bukan stok.

## Setiap layar wajib punya state
loading (skeleton), kosong, error, offline, dan data normal. Cek mode terang dan gelap.

## Sebelum menyatakan selesai
1. Jalankan app pada viewport 390×844 dan periksa tampilan.
2. Periksa kontras teks (WCAG AA minimal) dan ukuran sentuh.
3. Cocokkan dengan daftar "Dilarang" di atas dan perbaiki yang melanggar.
4. Ringkas keputusan desain yang diambil dalam 3–5 poin.
