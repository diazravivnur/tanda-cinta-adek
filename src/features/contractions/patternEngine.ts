import {
  DEFAULT_THRESHOLDS,
  resolveThresholds,
  type ThresholdsConfig,
} from "../../config/thresholds";
import type {
  Contraction,
  ContractionSessionGroup,
  IntervalTrend,
  PatternEvaluation,
  PatternReason,
} from "../../types";

export { resolveThresholds };

/**
 * Menghitung nilai rata-rata (mean) aritmatika.
 * Mengembalikan null jika array kosong.
 */
export function calculateMean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return sum / values.length;
}

/**
 * Menghitung median (nilai tengah).
 * Mengembalikan null jika array kosong.
 */
export function calculateMedian(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Menghitung standar deviasi data.
 * Default menggunakan varians populasi (N). Bila useSample = true, menggunakan (N - 1).
 * Mengembalikan 0 untuk array berisi 1 elemen, dan null jika array kosong.
 */
export function calculateStdDev(
  values: readonly number[],
  useSample: boolean = false
): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return 0;
  const mean = calculateMean(values);
  if (mean === null) return null;

  const sumSquares = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  const divisor = useSample ? values.length - 1 : values.length;
  if (divisor <= 0) return 0;
  return Math.sqrt(sumSquares / divisor);
}

/**
 * Menghitung Coefficient of Variation (CV = stdDev / mean).
 * Memerlukan minimal 2 data poin; mengembalikan null jika < 2 atau mean = 0.
 */
export function calculateCv(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = calculateMean(values);
  if (mean === null || mean === 0) return null;
  const std = calculateStdDev(values);
  if (std === null) return null;
  return std / mean;
}

/**
 * Menghitung slope (kemiringan) regresi linier sederhana terhadap indeks (x = 0, 1, ..., n-1).
 * Mengembalikan null jika data < 2 poin.
 */
export function calculateSlope(values: readonly number[]): number | null {
  const n = values.length;
  if (n < 2) return null;

  const xMean = (n - 1) / 2;
  const yMean = calculateMean(values);
  if (yMean === null) return null;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean;
    const yDiff = values[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Pure function untuk mengelompokkan kontraksi ke dalam sesi terpisah.
 * Jeda diukur antar-AWAL kontraksi (startAt).
 * Jeda tepat SESSION_GAP_MIN (60 menit) TIDAK memisah sesi; lebih dari itu memisah.
 */
export function groupIntoSessions(
  contractions: readonly Contraction[],
  sessionGapMin?: number
): ContractionSessionGroup[] {
  if (contractions.length === 0) {
    return [];
  }

  const gapLimitMs = (sessionGapMin ?? DEFAULT_THRESHOLDS.SESSION_GAP_MIN) * 60 * 1000;
  const sorted = [...contractions].sort((a, b) => a.startAt - b.startAt);

  const groups: ContractionSessionGroup[] = [];
  let currentGroup: Contraction[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const c = sorted[i];

    if (currentGroup.length === 0) {
      currentGroup.push(c);
      continue;
    }

    const prev = currentGroup[currentGroup.length - 1];
    const gapMs = c.startAt - prev.startAt;

    if (gapMs > gapLimitMs) {
      const first = currentGroup[0];
      const last = currentGroup[currentGroup.length - 1];
      groups.push({
        sessionId: first.sessionId || `session-${first.startAt}`,
        startedAt: first.startAt,
        lastContractionAt: last.startAt,
        contractions: currentGroup,
      });
      currentGroup = [c];
    } else {
      currentGroup.push(c);
    }
  }

  if (currentGroup.length > 0) {
    const first = currentGroup[0];
    const last = currentGroup[currentGroup.length - 1];
    groups.push({
      sessionId: first.sessionId || `session-${first.startAt}`,
      startedAt: first.startAt,
      lastContractionAt: last.startAt,
      contractions: currentGroup,
    });
  }

  return groups;
}

/**
 * Pure function menghitung intervalSec untuk tiap kontraksi berdasarkan
 * selisih startAt dengan kontraksi sebelumnya dalam satu sesi yang sama.
 * Juga mengalkulasi durationSec dari endAt jika durationSec belum terisi.
 */
export function computeIntervals(
  contractions: readonly Contraction[],
  sessionGapMin?: number
): Contraction[] {
  if (contractions.length === 0) {
    return [];
  }

  const gapLimitMs = (sessionGapMin ?? DEFAULT_THRESHOLDS.SESSION_GAP_MIN) * 60 * 1000;
  const sorted = [...contractions].sort((a, b) => a.startAt - b.startAt);

  return sorted.map((c, idx) => {
    let intervalSec: number | null = null;
    if (idx > 0) {
      const prev = sorted[idx - 1];
      const gapMs = c.startAt - prev.startAt;
      if (gapMs <= gapLimitMs) {
        intervalSec = Math.round(gapMs / 1000);
      }
    }

    const durationSec =
      c.durationSec ??
      (c.endAt !== null && c.endAt >= c.startAt
        ? Math.round((c.endAt - c.startAt) / 1000)
        : null);

    return {
      ...c,
      intervalSec,
      durationSec,
    };
  });
}

/**
 * Pure function menghitung tren interval dari 8 interval terakhir.
 * Kemiringan relatif >= 3% per kontraksi:
 * - converging: interval makin pendek (kontraksi makin rapat)
 * - diverging: interval makin panjang (kontraksi makin renggang)
 * - stable: perubahan di bawah ambang batas 3%
 * - unknown: interval kurang dari 4
 */
export function computeTrend(
  input: readonly Contraction[] | readonly number[],
  customThresholds?: Partial<ThresholdsConfig>
): IntervalTrend {
  const cfg = resolveThresholds(customThresholds);

  let intervals: number[];
  if (input.length > 0 && typeof input[0] === "object") {
    const contractions = input as readonly Contraction[];
    const sorted = [...contractions].sort((a, b) => a.startAt - b.startAt);
    intervals = computeIntervals(sorted, cfg.SESSION_GAP_MIN)
      .map((c) => c.intervalSec)
      .filter((i): i is number => i !== null && i > 0);
  } else {
    intervals = [...(input as readonly number[])];
  }

  const recent = intervals.slice(-cfg.TREND_MAX_INTERVALS);
  if (recent.length < cfg.TREND_MIN_INTERVALS) {
    return "unknown";
  }

  const slope = calculateSlope(recent);
  const mean = calculateMean(recent);
  if (slope === null || mean === null || mean === 0) {
    return "stable";
  }

  const relativeSlope = slope / mean;

  if (relativeSlope <= -cfg.TREND_RELATIVE_SLOPE_THRESHOLD) {
    return "converging";
  }
  if (relativeSlope >= cfg.TREND_RELATIVE_SLOPE_THRESHOLD) {
    return "diverging";
  }
  return "stable";
}

/**
 * Menghitung durasi (dalam menit) pola rapat berturut-turut pada ujung sesi aktif.
 */
function computeTrailingRunMinutes(
  contractions: readonly Contraction[],
  toleranceSec: number
): number {
  if (contractions.length < 2) return 0;

  let runStartIndex = contractions.length - 1;

  for (let i = contractions.length - 1; i >= 1; i--) {
    const c = contractions[i];
    if (c.intervalSec !== null && c.intervalSec <= toleranceSec) {
      runStartIndex = i - 1;
    } else {
      break;
    }
  }

  if (runStartIndex === contractions.length - 1) {
    return 0;
  }

  const runStartMs = contractions[runStartIndex].startAt;
  const lastMs = contractions[contractions.length - 1].startAt;
  return Math.round((lastMs - runStartMs) / 60000);
}

/**
 * Pure function klasifikasi pola kontraksi.
 * Waktu sekarang (now) wajib disertakan sebagai parameter epoch milidetik.
 * Tidak memakai Date.now() di dalam fungsi.
 */
export function classifyPattern(
  contractions: readonly Contraction[],
  now: number,
  customThresholds?: Partial<ThresholdsConfig>
): PatternEvaluation {
  const cfg = resolveThresholds(customThresholds);

  if (contractions.length === 0) {
    return {
      status: "INSUFFICIENT",
      reason: "no_active_session",
      contractionCount: 0,
      medianIntervalSec: null,
      medianDurationSec: null,
      intervalCv: null,
      trend: "unknown",
      trailingRunMinutes: 0,
      sustainedTargetMinutes: cfg.ACTIVE_SUSTAINED_MIN,
      sessionStartedAt: null,
    };
  }

  const groups = groupIntoSessions(contractions, cfg.SESSION_GAP_MIN);
  if (groups.length === 0) {
    return {
      status: "INSUFFICIENT",
      reason: "no_active_session",
      contractionCount: 0,
      medianIntervalSec: null,
      medianDurationSec: null,
      intervalCv: null,
      trend: "unknown",
      trailingRunMinutes: 0,
      sustainedTargetMinutes: cfg.ACTIVE_SUSTAINED_MIN,
      sessionStartedAt: null,
    };
  }

  // Sesi aktif = sesi terakhir; null bila kontraksi terakhir lebih tua dari SESSION_GAP_MIN dibanding now
  const activeGroup = groups[groups.length - 1];
  const lastContraction = activeGroup.contractions[activeGroup.contractions.length - 1];
  const gapFromLastMs = now - lastContraction.startAt;
  const sessionGapLimitMs = cfg.SESSION_GAP_MIN * 60 * 1000;

  if (gapFromLastMs > sessionGapLimitMs) {
    return {
      status: "INSUFFICIENT",
      reason: "no_active_session",
      contractionCount: 0,
      medianIntervalSec: null,
      medianDurationSec: null,
      intervalCv: null,
      trend: "unknown",
      trailingRunMinutes: 0,
      sustainedTargetMinutes: cfg.ACTIVE_SUSTAINED_MIN,
      sessionStartedAt: null,
    };
  }

  const sessionContractions = computeIntervals(activeGroup.contractions, cfg.SESSION_GAP_MIN);
  const count = sessionContractions.length;
  const sessionStartedAt = activeGroup.startedAt;

  const sessionIntervals = sessionContractions
    .map((c) => c.intervalSec)
    .filter((i): i is number => i !== null && i > 0);

  const sessionDurations = sessionContractions
    .map((c) => c.durationSec)
    .filter((d): d is number => d !== null && d > 0);

  const trend = computeTrend(sessionIntervals, cfg);
  const trailingRunMinutes = computeTrailingRunMinutes(
    sessionContractions,
    cfg.ACTIVE_INTERVAL_TOLERANCE_SEC
  );

  // 1. Cek jumlah kontraksi minimum
  if (count < cfg.INSUFFICIENT_MIN_COUNT) {
    return {
      status: "INSUFFICIENT",
      reason: "too_few_contractions",
      contractionCount: count,
      medianIntervalSec: calculateMedian(sessionIntervals),
      medianDurationSec: calculateMedian(sessionDurations),
      intervalCv: calculateCv(sessionIntervals),
      trend,
      trailingRunMinutes,
      sustainedTargetMinutes: cfg.ACTIVE_SUSTAINED_MIN,
      sessionStartedAt,
    };
  }

  // 2. Cek basi (stale): tanpa kontraksi baru > 15 menit
  if (gapFromLastMs > cfg.STALE_AFTER_SEC * 1000) {
    return {
      status: "IRREGULAR",
      reason: "stale",
      contractionCount: count,
      medianIntervalSec: calculateMedian(sessionIntervals),
      medianDurationSec: calculateMedian(sessionDurations),
      intervalCv: calculateCv(sessionIntervals),
      trend,
      trailingRunMinutes,
      sustainedTargetMinutes: cfg.ACTIVE_SUSTAINED_MIN,
      sessionStartedAt,
    };
  }

  // 3. Evaluasi ACTIVE_511:
  // Jendela 60 menit mundur dari awal kontraksi terakhir
  const windowStartMs = lastContraction.startAt - cfg.ACTIVE_SUSTAINED_MIN * 60 * 1000;
  const windowContractions = sessionContractions.filter((c) => c.startAt >= windowStartMs);
  const windowIntervals = windowContractions
    .map((c) => c.intervalSec)
    .filter((i): i is number => i !== null && i > 0);
  const windowDurations = windowContractions
    .map((c) => c.durationSec)
    .filter((d): d is number => d !== null && d > 0);

  // Sesi harus sudah berjalan >= 60 menit dikurangi toleransi interval (7 menit)
  const minSustainedMs =
    (cfg.ACTIVE_SUSTAINED_MIN * 60 - cfg.ACTIVE_INTERVAL_TOLERANCE_SEC) * 1000;
  const sessionSpanMs = lastContraction.startAt - sessionStartedAt;
  const isSustained = sessionSpanMs >= minSustainedMs;

  const hasEnoughIntervals = windowIntervals.length >= cfg.ACTIVE_MIN_INTERVALS;
  const windowMedianInterval = calculateMedian(windowIntervals);
  const isIntervalShortEnough =
    windowMedianInterval !== null && windowMedianInterval <= cfg.ACTIVE_INTERVAL_MAX_SEC;

  const toleranceCount = windowIntervals.filter(
    (i) => i <= cfg.ACTIVE_INTERVAL_TOLERANCE_SEC
  ).length;
  const isWithinToleranceRatio =
    windowIntervals.length > 0 &&
    toleranceCount / windowIntervals.length >= cfg.ACTIVE_TOLERANCE_RATIO;

  // Durasi diketahui pada >= separuh kontraksi (minimal 3)
  const hasEnoughKnownDurations =
    windowDurations.length >= cfg.ACTIVE_MIN_KNOWN_DURATIONS &&
    windowDurations.length >= Math.ceil(windowContractions.length / 2);

  const windowMedianDuration = calculateMedian(windowDurations);
  const isDurationLongEnough =
    windowMedianDuration !== null && windowMedianDuration >= cfg.ACTIVE_DURATION_MIN_SEC;

  if (
    isSustained &&
    hasEnoughIntervals &&
    isIntervalShortEnough &&
    isWithinToleranceRatio &&
    hasEnoughKnownDurations &&
    isDurationLongEnough
  ) {
    return {
      status: "ACTIVE_511",
      reason: "criteria_met",
      contractionCount: count,
      medianIntervalSec: windowMedianInterval,
      medianDurationSec: windowMedianDuration,
      intervalCv: calculateCv(windowIntervals),
      trend,
      trailingRunMinutes,
      sustainedTargetMinutes: cfg.ACTIVE_SUSTAINED_MIN,
      sessionStartedAt,
    };
  }

  // 4. Evaluasi REGULAR:
  // 4 interval terakhir, CV <= 0.25, median <= 600 dtk
  const last4Intervals = sessionIntervals.slice(-cfg.REGULAR_MIN_COUNT);
  const has4Intervals = last4Intervals.length >= cfg.REGULAR_MIN_COUNT;
  const last4Median = calculateMedian(last4Intervals);
  const last4Cv = calculateCv(last4Intervals);

  const isRegular =
    has4Intervals &&
    last4Cv !== null &&
    last4Cv <= cfg.REGULAR_MAX_CV &&
    last4Median !== null &&
    last4Median <= cfg.REGULAR_INTERVAL_MAX_SEC;

  if (isRegular) {
    let reason: PatternReason = "criteria_met";
    if (!isIntervalShortEnough || !isWithinToleranceRatio) {
      reason = "intervals_too_long";
    } else if (!isSustained || !hasEnoughIntervals) {
      reason = "not_sustained";
    } else if (!hasEnoughKnownDurations) {
      reason = "durations_unknown";
    } else if (!isDurationLongEnough) {
      reason = "durations_short";
    }

    return {
      status: "REGULAR",
      reason,
      contractionCount: count,
      medianIntervalSec: calculateMedian(sessionIntervals),
      medianDurationSec: calculateMedian(sessionDurations),
      intervalCv: calculateCv(sessionIntervals),
      trend,
      trailingRunMinutes,
      sustainedTargetMinutes: cfg.ACTIVE_SUSTAINED_MIN,
      sessionStartedAt,
    };
  }

  // 5. Pola belum teratur (IRREGULAR)
  let irregularReason: PatternReason = "irregular_intervals";
  if (last4Median !== null && last4Median > cfg.REGULAR_INTERVAL_MAX_SEC) {
    irregularReason = "intervals_too_long";
  }

  return {
    status: "IRREGULAR",
    reason: irregularReason,
    contractionCount: count,
    medianIntervalSec: calculateMedian(sessionIntervals),
    medianDurationSec: calculateMedian(sessionDurations),
    intervalCv: calculateCv(sessionIntervals),
    trend,
    trailingRunMinutes,
    sustainedTargetMinutes: cfg.ACTIVE_SUSTAINED_MIN,
    sessionStartedAt,
  };
}

