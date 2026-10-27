import { describe, expect, it } from "vitest";
import {
  decideContractionNotification,
  shouldRepeatUrgent,
} from "./notificationDecision";

describe("notification decisions", () => {
  it("raises only to the next applicable level and never downgrades", () => {
    expect(decideContractionNotification({
      notifiedLevel: 0,
      status: "INSUFFICIENT",
      hasContraction: true,
      urgentRequested: false,
      acknowledged: false,
      lastUrgentSentAt: null,
    })).toEqual({ level: 1, event: "info" });

    expect(decideContractionNotification({
      notifiedLevel: 2,
      status: "IRREGULAR",
      hasContraction: true,
      urgentRequested: false,
      acknowledged: false,
      lastUrgentSentAt: null,
    })).toEqual({ level: 2, event: "none" });
  });

  it("promotes regular and manual urgent conditions", () => {
    const base = {
      notifiedLevel: 1 as const,
      hasContraction: true,
      urgentRequested: false,
      acknowledged: false,
      lastUrgentSentAt: null,
    };
    expect(decideContractionNotification({ ...base, status: "REGULAR" }))
      .toEqual({ level: 2, event: "regular" });
    expect(decideContractionNotification({ ...base, status: "IRREGULAR", urgentRequested: true }))
      .toEqual({ level: 3, event: "urgent" });
  });

  it("repeats urgent only after 15 minutes and before acknowledgement", () => {
    const lastUrgentSentAt = 1_000_000;
    const state = { notifiedLevel: 3 as const, acknowledged: false, lastUrgentSentAt };
    expect(shouldRepeatUrgent(state, lastUrgentSentAt + 899_999, 900_000)).toBe(false);
    expect(shouldRepeatUrgent(state, lastUrgentSentAt + 900_000, 900_000)).toBe(true);
    expect(shouldRepeatUrgent({ ...state, acknowledged: true }, lastUrgentSentAt + 900_000, 900_000)).toBe(false);
  });
});