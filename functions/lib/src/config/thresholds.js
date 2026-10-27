"use strict";
/**
 * Ambang batas klasifikasi kontraksi & sesi.
 * ATURAN: Semua angka/parameter ambang 5-1-1 hanya didefinisikan di file ini
 * agar konsisten dan mudah disesuaikan bila dokter/bidan memberikan rekomendasi khusus.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.THRESHOLDS = exports.DEFAULT_THRESHOLDS = void 0;
exports.resolveThresholds = resolveThresholds;
exports.DEFAULT_THRESHOLDS = {
    /** Jeda waktu (menit) dari kontraksi terakhir sebelum dianggap sesi baru */
    SESSION_GAP_MIN: 60,
    /** Batas waktu (detik) tanpa kontraksi baru sebelum pola dianggap basi (stale) */
    STALE_AFTER_SEC: 15 * 60,
    /** Jumlah kontraksi minimum dalam sesi sebelum dapat diklasifikasikan (menghindari alarm palsu awal) */
    INSUFFICIENT_MIN_COUNT: 5,
    /** Aturan 5-1-1: Interval maksimal (detik) antar awal kontraksi (5 menit) */
    ACTIVE_INTERVAL_MAX_SEC: 5 * 60,
    /** Aturan 5-1-1: Durasi minimal kontraksi (detik) (1 menit / 60 detik) */
    ACTIVE_DURATION_MIN_SEC: 60,
    /** Aturan 5-1-1: Rentang durasi pemantauan berkelanjutan (menit) (1 jam) */
    ACTIVE_SUSTAINED_MIN: 60,
    /** Toleransi batas atas per interval (detik) untuk memperhitungkan variasi alami (7 menit) */
    ACTIVE_INTERVAL_TOLERANCE_SEC: 7 * 60,
    /** Rasio minimum interval yang harus memenuhi toleransi (80%) */
    ACTIVE_TOLERANCE_RATIO: 0.8,
    /** Jumlah interval minimum dalam jendela aktif untuk evaluasi 5-1-1 */
    ACTIVE_MIN_INTERVALS: 6,
    /** Jumlah minimum durasi yang diketahui untuk statistik durasi 5-1-1 */
    ACTIVE_MIN_KNOWN_DURATIONS: 3,
    /** Jumlah interval minimum untuk mengevaluasi keteraturan pola */
    REGULAR_MIN_COUNT: 4,
    /** Batas atas Coefficient of Variation (standar deviasi / rata-rata) untuk status teratur */
    REGULAR_MAX_CV: 0.25,
    /** Batas interval maksimal (detik) untuk status teratur (10 menit) */
    REGULAR_INTERVAL_MAX_SEC: 10 * 60,
    /** Jumlah interval minimum untuk menghitung tren kemiringan */
    TREND_MIN_INTERVALS: 4,
    /** Jumlah maksimal interval terakhir yang dianalisis untuk tren */
    TREND_MAX_INTERVALS: 8,
    /** Ambang batas kemiringan relatif per kontraksi untuk mendeteksi converging/diverging (3%) */
    TREND_RELATIVE_SLOPE_THRESHOLD: 0.03,
};
exports.THRESHOLDS = exports.DEFAULT_THRESHOLDS;
/**
 * Menggabungkan ambang bawaan dengan konfigurasi parsial (kustom)
 * dan memvalidasi nilainya:
 * - Semua nilai harus berupa angka positif (> 0)
 * - Rasio toleransi harus <= 1
 * - Toleransi interval harus >= interval median maksimal
 *
 * @throws {RangeError} jika ada nilai yang tidak valid
 */
function resolveThresholds(partial) {
    if (!partial) {
        return { ...exports.DEFAULT_THRESHOLDS };
    }
    const merged = { ...exports.DEFAULT_THRESHOLDS, ...partial };
    for (const [key, val] of Object.entries(merged)) {
        if (typeof val !== "number" || Number.isNaN(val) || val <= 0) {
            throw new RangeError(`Nilai ambang '${key}' harus berupa angka positif: ${val}`);
        }
    }
    if (merged.ACTIVE_TOLERANCE_RATIO > 1) {
        throw new RangeError(`ACTIVE_TOLERANCE_RATIO tidak boleh lebih dari 1: ${merged.ACTIVE_TOLERANCE_RATIO}`);
    }
    if (merged.ACTIVE_INTERVAL_TOLERANCE_SEC < merged.ACTIVE_INTERVAL_MAX_SEC) {
        throw new RangeError(`ACTIVE_INTERVAL_TOLERANCE_SEC (${merged.ACTIVE_INTERVAL_TOLERANCE_SEC}) tidak boleh lebih kecil dari ACTIVE_INTERVAL_MAX_SEC (${merged.ACTIVE_INTERVAL_MAX_SEC})`);
    }
    return merged;
}
//# sourceMappingURL=thresholds.js.map