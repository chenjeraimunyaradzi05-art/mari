/**
 * DV-Safe Routes
 * Safety-first features for users in vulnerable situations
 *
 * Available service functions:
 * - getSafetySettings(userId)
 * - updateSafetySettings(userId, updates)
 * - enableSafeMode(userId)
 * - createSafeChat(userId, name, participants)
 * - getSafeChats(userId)
 * - accessSafeChat(userId, chatId, pin?)
 * - sendSafeChatMessage(userId, chatId, content, autoDeleteMinutes?)
 * - triggerPanicButton(userId)
 * - addEmergencyContact(userId, contact)
 * - removeEmergencyContact(userId, contactId)
 * - blockUser(userId, blockedUserId)
 * - isUserVisible(userId, viewerId)
 * - getSafeNotificationContent(userId, notification)
 * - clearActivityTraces(userId)
 * - getDVResources(region?)
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=dv-safe.routes.d.ts.map