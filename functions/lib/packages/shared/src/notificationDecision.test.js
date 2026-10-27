"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const notificationDecision_1 = require("./notificationDecision");
(0, vitest_1.describe)("notification decisions", () => {
    (0, vitest_1.it)("raises only to the next applicable level and never downgrades", () => {
        (0, vitest_1.expect)((0, notificationDecision_1.decideContractionNotification)({
            notifiedLevel: 0,
            status: "INSUFFICIENT",
            hasContraction: true,
            urgentRequested: false,
            acknowledged: false,
            lastUrgentSentAt: null,
        })).toEqual({ level: 1, event: "info" });
        (0, vitest_1.expect)((0, notificationDecision_1.decideContractionNotification)({
            notifiedLevel: 2,
            status: "IRREGULAR",
            hasContraction: true,
            urgentRequested: false,
            acknowledged: false,
            lastUrgentSentAt: null,
        })).toEqual({ level: 2, event: "none" });
    });
    (0, vitest_1.it)("promotes regular and manual urgent conditions", () => {
        const base = {
            notifiedLevel: 1,
            hasContraction: true,
            urgentRequested: false,
            acknowledged: false,
            lastUrgentSentAt: null,
        };
        (0, vitest_1.expect)((0, notificationDecision_1.decideContractionNotification)({ ...base, status: "REGULAR" }))
            .toEqual({ level: 2, event: "regular" });
        (0, vitest_1.expect)((0, notificationDecision_1.decideContractionNotification)({ ...base, status: "IRREGULAR", urgentRequested: true }))
            .toEqual({ level: 3, event: "urgent" });
    });
    (0, vitest_1.it)("repeats urgent only after 15 minutes and before acknowledgement", () => {
        const lastUrgentSentAt = 1_000_000;
        const state = { notifiedLevel: 3, acknowledged: false, lastUrgentSentAt };
        (0, vitest_1.expect)((0, notificationDecision_1.shouldRepeatUrgent)(state, lastUrgentSentAt + 899_999, 900_000)).toBe(false);
        (0, vitest_1.expect)((0, notificationDecision_1.shouldRepeatUrgent)(state, lastUrgentSentAt + 900_000, 900_000)).toBe(true);
        (0, vitest_1.expect)((0, notificationDecision_1.shouldRepeatUrgent)({ ...state, acknowledged: true }, lastUrgentSentAt + 900_000, 900_000)).toBe(false);
    });
});
//# sourceMappingURL=notificationDecision.test.js.map