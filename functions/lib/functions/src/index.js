"use strict";
/**
 * Cloud Functions for Firebase
 * Region: asia-southeast2 (Jakarta)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.repeatUrgentNotifications = exports.onContractionWrite = exports.onContractionSessionWrite = exports.acknowledgeUrgent = exports.joinCouple = void 0;
const app_1 = require("firebase-admin/app");
(0, app_1.initializeApp)();
var joinCouple_1 = require("./joinCouple");
Object.defineProperty(exports, "joinCouple", { enumerable: true, get: function () { return joinCouple_1.joinCouple; } });
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "acknowledgeUrgent", { enumerable: true, get: function () { return notifications_1.acknowledgeUrgent; } });
Object.defineProperty(exports, "onContractionSessionWrite", { enumerable: true, get: function () { return notifications_1.onContractionSessionWrite; } });
Object.defineProperty(exports, "onContractionWrite", { enumerable: true, get: function () { return notifications_1.onContractionWrite; } });
Object.defineProperty(exports, "repeatUrgentNotifications", { enumerable: true, get: function () { return notifications_1.repeatUrgentNotifications; } });
//# sourceMappingURL=index.js.map