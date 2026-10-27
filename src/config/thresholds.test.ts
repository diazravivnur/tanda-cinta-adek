import { describe, it, expect } from "vitest";
import { THRESHOLDS, resolveThresholds } from "./thresholds";

describe("Ambang Batas 5-1-1 (THRESHOLDS)", () => {
  it("harus memiliki nilai aturan 5-1-1 yang benar", () => {
    // 5 menit interval
    expect(THRESHOLDS.ACTIVE_INTERVAL_MAX_SEC).toBe(300);
    // 1 menit durasi
    expect(THRESHOLDS.ACTIVE_DURATION_MIN_SEC).toBe(60);
    // 1 jam sustained
    expect(THRESHOLDS.ACTIVE_SUSTAINED_MIN).toBe(60);
  });

  it("harus memiliki parameter sesi dan keteraturan yang valid", () => {
    expect(THRESHOLDS.SESSION_GAP_MIN).toBe(60);
    expect(THRESHOLDS.STALE_AFTER_SEC).toBe(900); // 15 menit
    expect(THRESHOLDS.INSUFFICIENT_MIN_COUNT).toBe(5);
    expect(THRESHOLDS.ACTIVE_INTERVAL_TOLERANCE_SEC).toBe(420); // 7 menit
    expect(THRESHOLDS.ACTIVE_TOLERANCE_RATIO).toBe(0.8);
    expect(THRESHOLDS.ACTIVE_MIN_INTERVALS).toBe(6);
    expect(THRESHOLDS.ACTIVE_MIN_KNOWN_DURATIONS).toBe(3);
    expect(THRESHOLDS.REGULAR_MIN_COUNT).toBe(4);
    expect(THRESHOLDS.REGULAR_MAX_CV).toBe(0.25);
    expect(THRESHOLDS.REGULAR_INTERVAL_MAX_SEC).toBe(600); // 10 menit
    expect(THRESHOLDS.TREND_MIN_INTERVALS).toBe(4);
    expect(THRESHOLDS.TREND_MAX_INTERVALS).toBe(8);
    expect(THRESHOLDS.TREND_RELATIVE_SLOPE_THRESHOLD).toBe(0.03);
  });
});

describe("resolveThresholds", () => {
  it("mengembalikan konfigurasi default jika tanpa argumen", () => {
    const config = resolveThresholds();
    expect(config).toEqual(THRESHOLDS);
  });

  it("menggabungkan konfigurasi parsial valid", () => {
    const custom = resolveThresholds({
      ACTIVE_INTERVAL_MAX_SEC: 240, // 4 menit
      ACTIVE_INTERVAL_TOLERANCE_SEC: 300, // 5 menit
    });
    expect(custom.ACTIVE_INTERVAL_MAX_SEC).toBe(240);
    expect(custom.ACTIVE_INTERVAL_TOLERANCE_SEC).toBe(300);
    expect(custom.SESSION_GAP_MIN).toBe(60); // default dipertahankan
  });

  it("melempar RangeError jika ada nilai negatif, nol, atau NaN", () => {
    expect(() => resolveThresholds({ ACTIVE_INTERVAL_MAX_SEC: -1 })).toThrow(RangeError);
    expect(() => resolveThresholds({ ACTIVE_INTERVAL_MAX_SEC: 0 })).toThrow(RangeError);
    expect(() => resolveThresholds({ ACTIVE_INTERVAL_MAX_SEC: NaN })).toThrow(RangeError);
  });

  it("melempar RangeError jika rasio toleransi > 1", () => {
    expect(() => resolveThresholds({ ACTIVE_TOLERANCE_RATIO: 1.1 })).toThrow(RangeError);
  });

  it("melempar RangeError jika toleransi interval < batas median interval", () => {
    expect(() =>
      resolveThresholds({
        ACTIVE_INTERVAL_MAX_SEC: 300,
        ACTIVE_INTERVAL_TOLERANCE_SEC: 200,
      })
    ).toThrow(RangeError);
  });
});
