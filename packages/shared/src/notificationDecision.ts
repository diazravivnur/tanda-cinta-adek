import type { PatternStatus } from "../../../src/types";

export type NotificationLevel = 0 | 1 | 2 | 3;
export type NotificationEvent = "none" | "info" | "regular" | "urgent";
export const URGENT_REPEAT_INTERVAL_MS = 15 * 60 * 1000;

export interface NotificationState {
  notifiedLevel: NotificationLevel;
  status: PatternStatus;
  hasContraction: boolean;
  urgentRequested: boolean;
  acknowledged: boolean;
  lastUrgentSentAt: number | null;
}

export function decideContractionNotification(state: NotificationState): {
  level: NotificationLevel;
  event: NotificationEvent;
} {
  if (state.urgentRequested || state.status === "ACTIVE_511") {
    return state.notifiedLevel < 3
      ? { level: 3, event: "urgent" }
      : { level: state.notifiedLevel, event: "none" };
  }

  if (state.status === "REGULAR" && state.notifiedLevel < 2) {
    return { level: 2, event: "regular" };
  }

  if (state.hasContraction && state.notifiedLevel < 1) {
    return { level: 1, event: "info" };
  }

  return { level: state.notifiedLevel, event: "none" };
}

export function shouldRepeatUrgent(
  state: Pick<NotificationState, "notifiedLevel" | "acknowledged" | "lastUrgentSentAt">,
  now: number,
  repeatIntervalMs: number
): boolean {
  return (
    state.notifiedLevel === 3 &&
    !state.acknowledged &&
    state.lastUrgentSentAt !== null &&
    now - state.lastUrgentSentAt >= repeatIntervalMs
  );
}