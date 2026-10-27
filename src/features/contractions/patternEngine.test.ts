import { describe, it, expect } from "vitest";
import {
  calculateMean,
  calculateMedian,
  calculateStdDev,
  calculateCv,
  calculateSlope,
  computeTrend,
  groupIntoSessions,
  computeIntervals,
  classifyPattern,
  resolveThresholds,
} from "./patternEngine";
import type { Contraction } from "../../types";

function makeContraction(
  id: string,
  startAt: number,
  durationSec: number | null = 60,
  options?: Partial<Contraction>
): Contraction {
  return {
    id,
    sessionId: options?.sessionId ?? "session-test",
    startAt,
    endAt: durationSec !== null ? startAt + durationSec * 1000 : null,
    durationSec,
    intervalSec: options?.intervalSec ?? null,
    createdBy: "uid-wulan",
    ...options,
  };
}

describe("patternEngine — Fungsi Statistik Dasar", () => {
  it("calculateMean: menangani data kosong dan normal", () => {
    expect(calculateMean([])).toBeNull();
    expect(calculateMean([10])).toBe(10);
    expect(calculateMean([10, 20, 30])).toBe(20);
  });

  it("calculateMedian: menangani data kosong, ganjil, dan genap", () => {
    expect(calculateMedian([])).toBeNull();
    expect(calculateMedian([42])).toBe(42);
    // Ganjil tidak berurutan
    expect(calculateMedian([9, 1, 5])).toBe(5);
    // Genap
    expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
    expect(calculateMedian([10, 40, 20, 30])).toBe(25);
  });

  it("calculateStdDev: menangani data kosong, satu elemen, dan varians", () => {
    expect(calculateStdDev([])).toBeNull();
    expect(calculateStdDev([10])).toBe(0);
    expect(calculateStdDev([5, 5, 5])).toBe(0);
    // Populasi: mean 15, simpangan -5, +5, varians (25+25)/2 = 25 -> std = 5
    expect(calculateStdDev([10, 20], false)).toBe(5);
    // Sampel: varians 50/1 = 50 -> std = sqrt(50)
    expect(calculateStdDev([10, 20], true)).toBeCloseTo(Math.sqrt(50), 4);
  });

  it("calculateCv: menghitung rasio stdDev / mean", () => {
    expect(calculateCv([])).toBeNull();
    expect(calculateCv([10])).toBeNull(); // < 2 poin
    expect(calculateCv([0, 0])).toBeNull(); // mean 0
    // [10, 20]: mean 15, std 5 -> CV = 5/15 = 0.3333...
    expect(calculateCv([10, 20])).toBeCloseTo(1 / 3, 4);
    // seragam: std 0 -> CV = 0
    expect(calculateCv([100, 100, 100])).toBe(0);
  });

  it("calculateSlope: menghitung kemiringan regresi linier sederhana", () => {
    expect(calculateSlope([])).toBeNull();
    expect(calculateSlope([10])).toBeNull();
    // Garis datar
    expect(calculateSlope([300, 300, 300])).toBe(0);
    // Positif: naik 10 per step
    expect(calculateSlope([10, 20, 30])).toBe(10);
    // Negatif: turun 25 per step
    expect(calculateSlope([100, 75, 50, 25])).toBe(-25);
  });
});

describe("patternEngine — computeTrend (4 Kasus)", () => {
  it("unknown: jika interval kurang dari 4", () => {
    expect(computeTrend([])).toBe("unknown");
    expect(computeTrend([300, 290, 280])).toBe("unknown");
  });

  it("converging: interval makin pendek (relatif <= -3% per kontraksi)", () => {
    // 600, 550, 500, 450: turun 50 per kontraksi, rata-rata 525 -> slope/mean ~ -9.5%
    expect(computeTrend([600, 550, 500, 450])).toBe("converging");
  });

  it("diverging: interval makin panjang (relatif >= +3% per kontraksi)", () => {
    // 450, 500, 550, 600: naik 50 per kontraksi, rata-rata 525 -> slope/mean ~ +9.5%
    expect(computeTrend([450, 500, 550, 600])).toBe("diverging");
  });

  it("stable: perubahan interval di bawah 3%", () => {
    // Pola sangat stabil di sekitar 300 detik
    expect(computeTrend([300, 302, 298, 301, 300])).toBe("stable");
  });
});

describe("patternEngine — groupIntoSessions & computeIntervals", () => {
  const baseTime = 1_700_000_000_000;

  it("batas jeda tepat 60 menit vs 60 menit + 1 detik", () => {
    const c1 = makeContraction("c1", baseTime);
    // Tepat 60 menit (3.600.000 ms)
    const c2Exact = makeContraction("c2", baseTime + 60 * 60 * 1000);
    const groupsExact = groupIntoSessions([c1, c2Exact]);
    expect(groupsExact).toHaveLength(1);
    expect(groupsExact[0].contractions).toHaveLength(2);

    // 60 menit + 1 detik (3.601.000 ms)
    const c2Split = makeContraction("c2", baseTime + 60 * 60 * 1000 + 1000);
    const groupsSplit = groupIntoSessions([c1, c2Split]);
    expect(groupsSplit).toHaveLength(2);
    expect(groupsSplit[0].contractions).toHaveLength(1);
    expect(groupsSplit[1].contractions).toHaveLength(1);
  });

  it("computeIntervals: menghitung interval dan durasi dengan benar", () => {
    const c1 = makeContraction("c1", baseTime, 50);
    const c2 = makeContraction("c2", baseTime + 300 * 1000, null, {
      endAt: baseTime + 365 * 1000,
    });
    const c3 = makeContraction("c3", baseTime + 600 * 1000, null, { endAt: null });

    const evaluated = computeIntervals([c1, c2, c3]);
    expect(evaluated[0].intervalSec).toBeNull();
    expect(evaluated[0].durationSec).toBe(50);

    expect(evaluated[1].intervalSec).toBe(300);
    expect(evaluated[1].durationSec).toBe(65);

    expect(evaluated[2].intervalSec).toBe(300);
    expect(evaluated[2].durationSec).toBeNull(); // masih berlangsung
  });
});

describe("patternEngine — Invarian Immutability & Date.now", () => {
  it("input beku (Object.freeze) dan Date.now yang melempar error tidak menggagalkan fungsi", () => {
    const baseTime = 1_700_000_000_000;
    const items: Contraction[] = [];
    for (let i = 0; i < 6; i++) {
      items.push(
        Object.freeze(makeContraction(`c${i}`, baseTime + i * 300 * 1000, 60))
      );
    }
    const frozenList = Object.freeze(items);

    const originalDateNow = Date.now;
    try {
      Date.now = () => {
        throw new Error("Date.now() DILARANG dipanggil di dalam patternEngine!");
      };

      const now = baseTime + 6 * 300 * 1000;
      expect(() => groupIntoSessions(frozenList)).not.toThrow();
      expect(() => computeIntervals(frozenList)).not.toThrow();
      expect(() => computeTrend(frozenList)).not.toThrow();
      expect(() => classifyPattern(frozenList, now)).not.toThrow();
    } finally {
      Date.now = originalDateNow;
    }
  });

  it("input tidak berurutan menghasilkan output yang sama dengan input terurut", () => {
    const baseTime = 1_700_000_000_000;
    const sorted = [
      makeContraction("c1", baseTime + 0),
      makeContraction("c2", baseTime + 300_000),
      makeContraction("c3", baseTime + 600_000),
      makeContraction("c4", baseTime + 900_000),
      makeContraction("c5", baseTime + 1_200_000),
    ];
    // Acak urutan
    const shuffled = [sorted[3], sorted[0], sorted[4], sorted[1], sorted[2]];
    const now = baseTime + 1_300_000;

    const resSorted = classifyPattern(sorted, now);
    const resShuffled = classifyPattern(shuffled, now);

    expect(resShuffled).toEqual(resSorted);
  });
});

describe("patternEngine — Ambang Kustom & Validasi (resolveThresholds)", () => {
  it("melempar RangeError pada angka negatif atau nol", () => {
    expect(() => resolveThresholds({ ACTIVE_INTERVAL_MAX_SEC: -10 })).toThrow(RangeError);
    expect(() => resolveThresholds({ SESSION_GAP_MIN: 0 })).toThrow(RangeError);
  });

  it("melempar RangeError pada rasio toleransi > 1", () => {
    expect(() => resolveThresholds({ ACTIVE_TOLERANCE_RATIO: 1.05 })).toThrow(RangeError);
  });

  it("melempar RangeError jika toleransi interval < batas median interval", () => {
    expect(() =>
      resolveThresholds({
        ACTIVE_INTERVAL_MAX_SEC: 300,
        ACTIVE_INTERVAL_TOLERANCE_SEC: 250,
      })
    ).toThrow(RangeError);
  });

  it("skenario ambang diubah ke 4-1-1: interval 4.5 menit tidak lolos aktif", () => {
    const baseTime = 1_700_000_000_000;
    // 14 kontraksi dengan interval 4.5 menit (270 dtk), durasi 65 dtk selama 60 menit
    const contractions: Contraction[] = [];
    for (let i = 0; i < 14; i++) {
      contractions.push(
        makeContraction(`c${i}`, baseTime + i * 270 * 1000, 65)
      );
    }
    const lastStart = baseTime + 13 * 270 * 1000;
    const now = lastStart + 2 * 60 * 1000;

    // Pada 5-1-1 standar (max 300 dtk): 270 dtk lolos ACTIVE_511
    const res511 = classifyPattern(contractions, now);
    expect(res511.status).toBe("ACTIVE_511");
    expect(res511.reason).toBe("criteria_met");

    // Pada 4-1-1 (max 240 dtk, toleransi 300 dtk): median 270 dtk terlalu panjang
    const res411 = classifyPattern(contractions, now, {
      ACTIVE_INTERVAL_MAX_SEC: 4 * 60,
      ACTIVE_INTERVAL_TOLERANCE_SEC: 5 * 60,
    });
    expect(res411.status).toBe("REGULAR");
    expect(res411.reason).toBe("intervals_too_long");
  });
});

describe("patternEngine — Skenario Klasifikasi Lengkap", () => {
  const baseTime = 1_700_000_000_000;

  it("kurang dari 5 kontraksi: INSUFFICIENT dengan reason too_few_contractions", () => {
    const contractions = [
      makeContraction("c1", baseTime),
      makeContraction("c2", baseTime + 300_000),
      makeContraction("c3", baseTime + 600_000),
    ];
    const now = baseTime + 700_000;
    const res = classifyPattern(contractions, now);
    expect(res.status).toBe("INSUFFICIENT");
    expect(res.reason).toBe("too_few_contractions");
    expect(res.contractionCount).toBe(3);
  });

  it("tidak ada sesi aktif (kosong atau jeda > 60 menit)", () => {
    const now = baseTime + 1_000_000;
    expect(classifyPattern([], now).reason).toBe("no_active_session");

    const contractions = [
      makeContraction("c1", baseTime),
      makeContraction("c2", baseTime + 300_000),
    ];
    // Now adalah 61 menit setelah c2
    const expiredNow = baseTime + 300_000 + 61 * 60 * 1000;
    const res = classifyPattern(contractions, expiredNow);
    expect(res.status).toBe("INSUFFICIENT");
    expect(res.reason).toBe("no_active_session");
  });

  it("pola basi: tanpa kontraksi baru > 15 menit menjadi IRREGULAR (stale)", () => {
    const contractions: Contraction[] = [];
    for (let i = 0; i < 6; i++) {
      contractions.push(makeContraction(`c${i}`, baseTime + i * 300_000, 60));
    }
    const lastStart = baseTime + 5 * 300_000;
    // 16 menit setelah kontraksi terakhir
    const nowStale = lastStart + 16 * 60 * 1000;
    const res = classifyPattern(contractions, nowStale);
    expect(res.status).toBe("IRREGULAR");
    expect(res.reason).toBe("stale");
    expect(res.contractionCount).toBe(6);
  });

  it("kontraksi terakhir masih berlangsung (endAt null)", () => {
    const contractions: Contraction[] = [];
    for (let i = 0; i < 13; i++) {
      contractions.push(makeContraction(`c${i}`, baseTime + i * 270_000, 65));
    }
    // Kontraksi ke-14 sedang berlangsung
    const ongoingStart = baseTime + 13 * 270_000;
    contractions.push(
      makeContraction("c13", ongoingStart, null, { endAt: null })
    );

    const now = ongoingStart + 90 * 1000; // 90 detik sejak mulai
    const res = classifyPattern(contractions, now);
    expect(res.status).toBe("ACTIVE_511");
    expect(res.reason).toBe("criteria_met");
    // Median durasi tetap dihitung dari 13 kontraksi yang sudah selesai
    expect(res.medianDurationSec).toBe(65);
  });

  it("Braxton Hicks acak: interval tidak beraturan (CV > 0.25) -> IRREGULAR", () => {
    const intervals = [15 * 60, 4 * 60, 20 * 60, 5 * 60, 12 * 60];
    const contractions: Contraction[] = [];
    let curTime = baseTime;
    contractions.push(makeContraction("c0", curTime, 35));
    for (let i = 0; i < intervals.length; i++) {
      curTime += intervals[i] * 1000;
      contractions.push(makeContraction(`c${i + 1}`, curTime, 40));
    }
    const now = curTime + 2 * 60 * 1000;
    const res = classifyPattern(contractions, now);
    expect(res.status).toBe("IRREGULAR");
    expect(res.reason).toBe("irregular_intervals");
  });

  it("awal teratur: interval teratur 8 menit (CV <= 0.25, median <= 10m) -> REGULAR", () => {
    const intervals = [8 * 60, 8 * 60, 8 * 60 + 10, 8 * 60 - 10];
    const contractions: Contraction[] = [];
    let curTime = baseTime;
    contractions.push(makeContraction("c0", curTime, 45));
    for (let i = 0; i < intervals.length; i++) {
      curTime += intervals[i] * 1000;
      contractions.push(makeContraction(`c${i + 1}`, curTime, 45));
    }
    const now = curTime + 2 * 60 * 1000;
    const res = classifyPattern(contractions, now);
    expect(res.status).toBe("REGULAR");
    expect(res.reason).toBe("intervals_too_long");
    expect(res.medianIntervalSec).toBeCloseTo(480, 0);
  });

  it("5-1-1 penuh (60 menit sustained): ACTIVE_511 dengan criteria_met", () => {
    // 14 kontraksi tiap 4.5 menit (270 dtk), durasi 65 dtk
    // Rentang: 13 * 270 = 3510 dtk (58.5 menit >= 53 menit sustained)
    const contractions: Contraction[] = [];
    for (let i = 0; i < 14; i++) {
      contractions.push(
        makeContraction(`c${i}`, baseTime + i * 270 * 1000, 65)
      );
    }
    const lastStart = baseTime + 13 * 270 * 1000;
    const now = lastStart + 3 * 60 * 1000;

    const res = classifyPattern(contractions, now);
    expect(res.status).toBe("ACTIVE_511");
    expect(res.reason).toBe("criteria_met");
    expect(res.medianIntervalSec).toBe(270);
    expect(res.medianDurationSec).toBe(65);
    expect(res.trailingRunMinutes).toBeGreaterThanOrEqual(53);
  });

  it("interval <= 5 menit tetapi durasi < 60 detik -> REGULAR (durations_short)", () => {
    // 15 kontraksi tiap 4 menit (240 dtk) -> 14 * 240 = 3360 dtk (56 menit >= 53 menit)
    const contractions: Contraction[] = [];
    for (let i = 0; i < 15; i++) {
      contractions.push(
        makeContraction(`c${i}`, baseTime + i * 240 * 1000, 40)
      );
    }
    const lastStart = baseTime + 14 * 240 * 1000;
    const now = lastStart + 2 * 60 * 1000;

    const res = classifyPattern(contractions, now);
    expect(res.status).toBe("REGULAR");
    expect(res.reason).toBe("durations_short");
  });

  it("durasi tidak diketahui pada >= separuh kontraksi -> REGULAR (durations_unknown)", () => {
    // 15 kontraksi tiap 4 menit, hanya 2 yang memiliki durasi tercatat
    const contractions: Contraction[] = [];
    for (let i = 0; i < 15; i++) {
      const duration = i < 2 ? 65 : null;
      contractions.push(
        makeContraction(`c${i}`, baseTime + i * 240 * 1000, duration, {
          endAt: duration !== null ? baseTime + i * 240 * 1000 + duration * 1000 : null,
        })
      );
    }
    const lastStart = baseTime + 14 * 240 * 1000;
    const now = lastStart + 2 * 60 * 1000;

    const res = classifyPattern(contractions, now);
    expect(res.status).toBe("REGULAR");
    expect(res.reason).toBe("durations_unknown");
  });

  it("interval 5-1-1 tetapi belum mencapai 60 menit (53 mnt) -> REGULAR (not_sustained)", () => {
    // 5 kontraksi tiap 4 menit (total span 16 menit)
    const contractions: Contraction[] = [];
    for (let i = 0; i < 5; i++) {
      contractions.push(
        makeContraction(`c${i}`, baseTime + i * 240 * 1000, 65)
      );
    }
    const lastStart = baseTime + 4 * 240 * 1000;
    const now = lastStart + 2 * 60 * 1000;

    const res = classifyPattern(contractions, now);
    expect(res.status).toBe("REGULAR");
    expect(res.reason).toBe("not_sustained");
  });

  it("data bolong: ada jeda 25 menit yang merusak konsistensi interval", () => {
    // 6 kontraksi, c3 ke c4 jeda 25 menit
    const intervals = [4 * 60, 4 * 60, 25 * 60, 4 * 60, 4 * 60];
    const contractions: Contraction[] = [];
    let curTime = baseTime;
    contractions.push(makeContraction("c0", curTime, 65));
    for (let i = 0; i < intervals.length; i++) {
      curTime += intervals[i] * 1000;
      contractions.push(makeContraction(`c${i + 1}`, curTime, 65));
    }
    const now = curTime + 2 * 60 * 1000;
    const res = classifyPattern(contractions, now);
    // Karena ada interval 25 menit di tengah, CV interval melonjak
    expect(res.status).toBe("IRREGULAR");
    expect(res.reason).toBe("irregular_intervals");
  });

  it("sesi baru setelah jeda > 60 menit memisahkan histori", () => {
    // Sesi 1: 3 kontraksi
    const s1c1 = makeContraction("s1_1", baseTime);
    const s1c2 = makeContraction("s1_2", baseTime + 300_000);
    const s1c3 = makeContraction("s1_3", baseTime + 600_000);

    // Jeda 75 menit
    const s2Base = baseTime + 600_000 + 75 * 60 * 1000;
    // Sesi 2: 5 kontraksi
    const s2: Contraction[] = [];
    for (let i = 0; i < 5; i++) {
      s2.push(makeContraction(`s2_${i}`, s2Base + i * 300_000, 65));
    }

    const all = [s1c1, s1c2, s1c3, ...s2];
    const lastStart = s2Base + 4 * 300_000;
    const now = lastStart + 2 * 60 * 1000;

    const groups = groupIntoSessions(all);
    expect(groups).toHaveLength(2);
    expect(groups[0].contractions).toHaveLength(3);
    expect(groups[1].contractions).toHaveLength(5);

    // Evaluasi pola hanya menghitung sesi aktif (sesi 2)
    const res = classifyPattern(all, now);
    expect(res.contractionCount).toBe(5);
    expect(res.sessionStartedAt).toBe(s2Base);
  });
});
