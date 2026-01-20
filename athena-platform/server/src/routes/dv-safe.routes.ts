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

import { Router, Response, NextFunction } from 'express';
import dvSafeService from '../services/dv-safe.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

// Get safety settings
router.get('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await dvSafeService.getSafetySettings(req.user!.id);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// Update safety settings schema
const updateSettingsSchema = z.object({
  isSafeMode: z.boolean().optional(),
  hideFromSearch: z.boolean().optional(),
  allowMessages: z.boolean().optional(),
  safeExitEnabled: z.boolean().optional(),
  safeExitUrl: z.string().url().optional(),
  panicButtonEnabled: z.boolean().optional(),
  activityLogEnabled: z.boolean().optional(),
  disguisedAppIcon: z.boolean().optional(),
  notificationsSafe: z.boolean().optional(),
});

// Update safety settings
router.put('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updates = updateSettingsSchema.parse(req.body);
    const settings = await dvSafeService.updateSafetySettings(req.user!.id, updates);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

// Enable safe mode (enhanced privacy)
router.post('/safe-mode', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await dvSafeService.enableSafeMode(req.user!.id);
    res.json({ message: 'Safe mode enabled', settings });
  } catch (error) {
    next(error);
  }
});

// Trigger panic button (emergency alert)
router.post('/panic', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await dvSafeService.triggerPanicButton(req.user!.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Emergency contacts schema
const emergencyContactSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(5).max(20),
  email: z.string().email().optional(),
  relationship: z.string().min(1).max(50),
  notifyOnPanic: z.boolean().default(true),
});

// Add emergency contact
router.post('/emergency-contacts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contact = emergencyContactSchema.parse(req.body);
    const result = await dvSafeService.addEmergencyContact(req.user!.id, contact);
    res.json({ message: 'Emergency contact added', contact: result });
  } catch (error) {
    next(error);
  }
});

// Remove emergency contact
router.delete('/emergency-contacts/:contactId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await dvSafeService.removeEmergencyContact(req.user!.id, req.params.contactId);
    res.json({ message: 'Emergency contact removed' });
  } catch (error) {
    next(error);
  }
});

// Block a user
router.post('/block/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await dvSafeService.blockUser(req.user!.id, req.params.userId);
    res.json({ message: 'User blocked' });
  } catch (error) {
    next(error);
  }
});

// Check if user is visible to another user
router.get('/visibility/:viewerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const isVisible = await dvSafeService.isUserVisible(req.user!.id, req.params.viewerId);
    res.json({ isVisible });
  } catch (error) {
    next(error);
  }
});

// Safe chats schema
const safeChatSchema = z.object({
  name: z.string().min(1).max(100),
  participants: z.array(z.string()).min(1),
});

// Create safe chat (encrypted, hidden)
router.post('/chats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, participants } = safeChatSchema.parse(req.body);
    const chat = await dvSafeService.createSafeChat(req.user!.id, { name, participants });
    res.json(chat);
  } catch (error) {
    next(error);
  }
});

// Get all safe chats
router.get('/chats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const chats = await dvSafeService.getSafeChats(req.user!.id);
    res.json(chats);
  } catch (error) {
    next(error);
  }
});

const accessChatSchema = z.object({
  pin: z.string().min(4).max(10).optional(),
});

// Access a specific safe chat (with optional PIN)
router.post('/chats/:chatId/access', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pin } = accessChatSchema.parse(req.body);
    const chat = await dvSafeService.accessSafeChat(req.user!.id, req.params.chatId, pin);
    res.json(chat);
  } catch (error) {
    next(error);
  }
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
  autoDeleteMinutes: z.number().min(1).max(10080).optional(), // max 1 week
});

// Send message in safe chat
router.post('/chats/:chatId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content, autoDeleteMinutes } = sendMessageSchema.parse(req.body);
    const message = await dvSafeService.sendSafeChatMessage(
      req.user!.id,
      req.params.chatId,
      content,
      autoDeleteMinutes
    );
    res.json(message);
  } catch (error) {
    next(error);
  }
});

// Clear activity traces (browser history, cache, etc. - client-side support)
router.post('/clear-traces', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await dvSafeService.clearActivityTraces(req.user!.id);
    res.json({ 
      message: 'Activity traces cleared',
      clientInstructions: {
        clearLocalStorage: true,
        clearSessionStorage: true,
        clearCookies: ['athena_session', 'athena_user'],
        replaceHistory: true,
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get DV resources by region
router.get('/resources', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const region = req.query.region as string | undefined;
    const resources = dvSafeService.getDVResources(region);
    res.json(resources);
  } catch (error) {
    next(error);
  }
});

const safeNotificationSchema = z.object({
  title: z.string(),
  message: z.string(),
});

// Get safe notification content (for displaying sensitive notifications safely)
router.post('/safe-notification', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, message } = safeNotificationSchema.parse(req.body);
    const settings = await dvSafeService.getSafetySettings(req.user!.id);
    const safeContent = dvSafeService.getSafeNotificationContent(settings, title, message);
    res.json(safeContent);
  } catch (error) {
    next(error);
  }
});

export default router;
