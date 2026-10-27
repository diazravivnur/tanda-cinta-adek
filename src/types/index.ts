/**
 * Definisi Model Data & Tipe Domain
 * Sesuai dengan spesifikasi data Firestore di SPEC.md §9
 */

export type UserRole = "ibu" | "ayah";

export type PatternStatus = "INSUFFICIENT" | "IRREGULAR" | "REGULAR" | "ACTIVE_511";

export type IntervalTrend = "converging" | "diverging" | "stable" | "unknown";

export type PatternReason =
  | "not_sustained"
  | "intervals_too_long"
  | "durations_short"
  | "durations_unknown"
  | "stale"
  | "irregular_intervals"
  | "too_few_contractions"
  | "no_active_session"
  | "criteria_met";

export interface PatternEvaluation {
  status: PatternStatus;
  reason: PatternReason;
  contractionCount: number;
  medianIntervalSec: number | null;
  medianDurationSec: number | null;
  intervalCv: number | null;
  trend: IntervalTrend;
  trailingRunMinutes: number;
  sustainedTargetMinutes: number;
  sessionStartedAt: number | null;
}

export interface ContractionSessionGroup {
  sessionId: string;
  startedAt: number;
  lastContractionAt: number;
  contractions: Contraction[];
}

export interface FCMTokenEntry {
  token: string;
  ua: string;
  updatedAt: number; // millisecond timestamp
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  coupleId: string;
  fcmTokens?: FCMTokenEntry[];
}

export interface CouplePhones {
  ayah: string;
  ibu: string;
}

export interface CoupleDocument {
  id: string;
  members: string[]; // [uidWulan, uidDiaz]
  roles: Record<string, UserRole>; // { [uid]: "ibu" | "ayah" }
  hplDate: string; // ISO date string / Timestamp representation
  gestationWeeksAtSetup: number;
  phones: CouplePhones;
  thresholds?: Record<string, number>;
}

export interface Contraction {
  id: string;
  sessionId: string;
  startAt: number; // millisecond timestamp
  endAt: number | null; // null jika sedang berlangsung
  durationSec: number | null;
  intervalSec: number | null;
  intensity?: 1 | 2 | 3;
  note?: string;
  createdBy: string; // uid
}

export interface ContractionSession {
  sessionId: string;
  startedAt: number;
  lastContractionAt: number;
  status: PatternStatus;
  notifiedLevel: 0 | 1 | 2 | 3;
  lastUrgentSentAt?: number;
  ackBy?: string; // uid Diaz
  ackAt?: number;
}

export interface KickSession {
  id: string;
  startAt: number;
  taps: number[]; // array of millisecond timestamps
  count: number;
  reachedTenAt: number | null;
  durationSec: number | null;
  timedOut: boolean;
  createdBy: string;
}

export interface DailySummary {
  date: string; // yyyy-mm-dd
  sessions: number;
  avgSecTo10: number | null;
  flags: string[];
  sentAt: number;
}
