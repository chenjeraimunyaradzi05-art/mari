"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dv_safe_service_1 = __importDefault(require("../services/dv-safe.service"));
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Get safety settings
router.get('/settings', async (req, res, next) => {
    try {
        const settings = await dv_safe_service_1.default.getSafetySettings(req.user.id);
        res.json(settings);
    }
    catch (error) {
        next(error);
    }
});
// Update safety settings schema
const updateSettingsSchema = zod_1.z.object({
    isSafeMode: zod_1.z.boolean().optional(),
    hideFromSearch: zod_1.z.boolean().optional(),
    allowMessages: zod_1.z.boolean().optional(),
    safeExitEnabled: zod_1.z.boolean().optional(),
    safeExitUrl: zod_1.z.string().url().optional(),
    panicButtonEnabled: zod_1.z.boolean().optional(),
    activityLogEnabled: zod_1.z.boolean().optional(),
    disguisedAppIcon: zod_1.z.boolean().optional(),
    notificationsSafe: zod_1.z.boolean().optional(),
});
// Update safety settings
router.put('/settings', async (req, res, next) => {
    try {
        const updates = updateSettingsSchema.parse(req.body);
        const settings = await dv_safe_service_1.default.updateSafetySettings(req.user.id, updates);
        res.json(settings);
    }
    catch (error) {
        next(error);
    }
});
// Enable safe mode (enhanced privacy)
router.post('/safe-mode', async (req, res, next) => {
    try {
        const settings = await dv_safe_service_1.default.enableSafeMode(req.user.id);
        res.json({ message: 'Safe mode enabled', settings });
    }
    catch (error) {
        next(error);
    }
});
// Trigger panic button (emergency alert)
router.post('/panic', async (req, res, next) => {
    try {
        const result = await dv_safe_service_1.default.triggerPanicButton(req.user.id);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Emergency contacts schema
const emergencyContactSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    phone: zod_1.z.string().min(5).max(20),
    email: zod_1.z.string().email().optional(),
    relationship: zod_1.z.string().min(1).max(50),
    notifyOnPanic: zod_1.z.boolean().default(true),
});
// Add emergency contact
router.post('/emergency-contacts', async (req, res, next) => {
    try {
        const contact = emergencyContactSchema.parse(req.body);
        const result = await dv_safe_service_1.default.addEmergencyContact(req.user.id, contact);
        res.json({ message: 'Emergency contact added', contact: result });
    }
    catch (error) {
        next(error);
    }
});
// Remove emergency contact
router.delete('/emergency-contacts/:contactId', async (req, res, next) => {
    try {
        await dv_safe_service_1.default.removeEmergencyContact(req.user.id, req.params.contactId);
        res.json({ message: 'Emergency contact removed' });
    }
    catch (error) {
        next(error);
    }
});
// Block a user
router.post('/block/:userId', async (req, res, next) => {
    try {
        await dv_safe_service_1.default.blockUser(req.user.id, req.params.userId);
        res.json({ message: 'User blocked' });
    }
    catch (error) {
        next(error);
    }
});
// Check if user is visible to another user
router.get('/visibility/:viewerId', async (req, res, next) => {
    try {
        const isVisible = await dv_safe_service_1.default.isUserVisible(req.user.id, req.params.viewerId);
        res.json({ isVisible });
    }
    catch (error) {
        next(error);
    }
});
// Safe chats schema
const safeChatSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100),
    participants: zod_1.z.array(zod_1.z.string()).min(1),
});
// Create safe chat (encrypted, hidden)
router.post('/chats', async (req, res, next) => {
    try {
        const { name, participants } = safeChatSchema.parse(req.body);
        const chat = await dv_safe_service_1.default.createSafeChat(req.user.id, { name, participants });
        res.json(chat);
    }
    catch (error) {
        next(error);
    }
});
// Get all safe chats
router.get('/chats', async (req, res, next) => {
    try {
        const chats = await dv_safe_service_1.default.getSafeChats(req.user.id);
        res.json(chats);
    }
    catch (error) {
        next(error);
    }
});
const accessChatSchema = zod_1.z.object({
    pin: zod_1.z.string().min(4).max(10).optional(),
});
// Access a specific safe chat (with optional PIN)
router.post('/chats/:chatId/access', async (req, res, next) => {
    try {
        const { pin } = accessChatSchema.parse(req.body);
        const chat = await dv_safe_service_1.default.accessSafeChat(req.user.id, req.params.chatId, pin);
        res.json(chat);
    }
    catch (error) {
        next(error);
    }
});
const sendMessageSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(5000),
    autoDeleteMinutes: zod_1.z.number().min(1).max(10080).optional(), // max 1 week
});
// Send message in safe chat
router.post('/chats/:chatId/messages', async (req, res, next) => {
    try {
        const { content, autoDeleteMinutes } = sendMessageSchema.parse(req.body);
        const message = await dv_safe_service_1.default.sendSafeChatMessage(req.user.id, req.params.chatId, content, autoDeleteMinutes);
        res.json(message);
    }
    catch (error) {
        next(error);
    }
});
// Clear activity traces (browser history, cache, etc. - client-side support)
router.post('/clear-traces', async (req, res, next) => {
    try {
        await dv_safe_service_1.default.clearActivityTraces(req.user.id);
        res.json({
            message: 'Activity traces cleared',
            clientInstructions: {
                clearLocalStorage: true,
                clearSessionStorage: true,
                clearCookies: ['athena_session', 'athena_user'],
                replaceHistory: true,
            }
        });
    }
    catch (error) {
        next(error);
    }
});
// Get DV resources by region
router.get('/resources', async (req, res, next) => {
    try {
        const region = req.query.region;
        const resources = dv_safe_service_1.default.getDVResources(region);
        res.json(resources);
    }
    catch (error) {
        next(error);
    }
});
const safeNotificationSchema = zod_1.z.object({
    title: zod_1.z.string(),
    message: zod_1.z.string(),
});
// Get safe notification content (for displaying sensitive notifications safely)
router.post('/safe-notification', async (req, res, next) => {
    try {
        const { title, message } = safeNotificationSchema.parse(req.body);
        const settings = await dv_safe_service_1.default.getSafetySettings(req.user.id);
        const safeContent = dv_safe_service_1.default.getSafeNotificationContent(settings, title, message);
        res.json(safeContent);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=dv-safe.routes.js.map