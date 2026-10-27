"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.URGENT_REPEAT_INTERVAL_MS = void 0;
exports.decideContractionNotification = decideContractionNotification;
exports.shouldRepeatUrgent = shouldRepeatUrgent;
exports.URGENT_REPEAT_INTERVAL_MS = 15 * 60 * 1000;
function decideContractionNotification(state) {
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
function shouldRepeatUrgent(state, now, repeatIntervalMs) {
    return (state.notifiedLevel === 3 &&
        !state.acknowledged &&
        state.lastUrgentSentAt !== null &&
        now - state.lastUrgentSentAt >= repeatIntervalMs);
}
//# sourceMappingURL=notificationDecision.js.map