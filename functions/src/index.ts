/**
 * Cloud Functions for Firebase
 * Region: asia-southeast2 (Jakarta)
 */

import { initializeApp } from "firebase-admin/app";

initializeApp();

export { joinCouple } from "./joinCouple";
export {
	acknowledgeUrgent,
	onContractionSessionWrite,
	onContractionWrite,
	repeatUrgentNotifications,
} from "./notifications";
