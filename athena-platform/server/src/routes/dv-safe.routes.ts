/**
 * DV-Safe routes: settings, emergency contacts, safe chats, the panic button,
 * trace clearing and support lines, for a member in a dangerous situation.
 * Everything is the signed-in member's own; nothing here reads another
 * person's data. Validation failures answer 400 with the reason, never 500.
 */

import { Router, Response, NextFunction } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import dvSafeService from '../services/dv-safe.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';

const router = Router();

router.use(authenticate);

function parse<T extends ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  try {
    return schema.parse(input ?? {});
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      throw new ApiError(400, issue ? `${issue.path.join('.') || 'input'}: ${issue.message}` : 'Invalid input');
    }
    throw error;
  }
}

const PIN = z.string().regex(/^\d{4,10}$/, 'must be 4 to 10 digits');

// ---------------------------------------------------------------- settings

router.get('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await dvSafeService.getSafetySettings(req.user!.id));
  } catch (error) {
    next(error);
  }
});

const updateSettingsSchema = z.object({
  isSafeMode: z.boolean().optional(),
  hideFromSearch: z.boolean().optional(),
  allowMessages: z.boolean().optional(),
  safeExitEnabled: z.boolean().optional(),
  safeExitUrl: z.string().url().max(2048).optional(),
  panicButtonEnabled: z.boolean().optional(),
  activityLogEnabled: z.boolean().optional(),
  disguisedAppIcon: z.boolean().optional(),
  notificationsSafe: z.boolean().optional(),
});

router.put('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updates = parse(updateSettingsSchema, req.body);
    res.json(await dvSafeService.updateSafetySettings(req.user!.id, updates));
  } catch (error) {
    next(error);
  }
});

router.post('/safe-mode', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await dvSafeService.enableSafeMode(req.user!.id);
    res.json({ message: 'Safe mode enabled', settings });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- panic

router.post('/panic', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await dvSafeService.triggerPanicButton(req.user!.id));
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- contacts

const emergencyContactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(5).max(20),
  email: z.string().trim().email().max(254).optional().or(z.literal('').transform(() => undefined)),
  relationship: z.string().trim().min(1).max(50),
  notifyOnPanic: z.boolean().default(true),
});

router.post('/emergency-contacts', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const contact = parse(emergencyContactSchema, req.body);
    const result = await dvSafeService.addEmergencyContact(req.user!.id, contact);
    res.status(201).json({ message: 'Emergency contact added', contact: result });
  } catch (error) {
    next(error);
  }
});

router.delete('/emergency-contacts/:contactId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const removed = await dvSafeService.removeEmergencyContact(req.user!.id, req.params.contactId);
    if (!removed) throw new ApiError(404, 'Contact not found');
    res.json({ message: 'Emergency contact removed' });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- blocks and visibility

router.post('/block/:userId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await dvSafeService.blockUser(req.user!.id, req.params.userId);
    res.json({ message: 'User blocked' });
  } catch (error) {
    next(error);
  }
});

router.get('/visibility/:viewerId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const isVisible = await dvSafeService.isUserVisible(req.user!.id, req.params.viewerId);
    res.json({ isVisible });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- safe chats

const safeChatSchema = z.object({
  name: z.string().trim().min(1).max(100),
  disguisedName: z.string().trim().min(1).max(60).optional(),
  participants: z.array(z.string().max(64)).max(20).optional(),
  accessPin: PIN.optional(),
});

router.post('/chats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const input = parse(safeChatSchema, req.body);
    res.status(201).json(await dvSafeService.createSafeChat(req.user!.id, input));
  } catch (error) {
    next(error);
  }
});

router.get('/chats', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await dvSafeService.getSafeChats(req.user!.id));
  } catch (error) {
    next(error);
  }
});

const pinBodySchema = z.object({ pin: PIN.optional() });

router.post('/chats/:chatId/access', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pin } = parse(pinBodySchema, req.body);
    res.json(await dvSafeService.accessSafeChat(req.user!.id, req.params.chatId, pin));
  } catch (error) {
    next(error);
  }
});

const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(5000),
  // Up to one week.
  autoDeleteMinutes: z.number().int().min(1).max(10080).optional(),
  pin: PIN.optional(),
});

router.post('/chats/:chatId/messages', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content, autoDeleteMinutes, pin } = parse(sendMessageSchema, req.body);
    const message = await dvSafeService.sendSafeChatMessage(req.user!.id, req.params.chatId, content, autoDeleteMinutes, pin);
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

router.delete('/chats/:chatId', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pin } = parse(pinBodySchema, { ...(req.query ?? {}), ...(req.body ?? {}) });
    await dvSafeService.deleteSafeChat(req.user!.id, req.params.chatId, pin);
    res.json({ message: 'Chat deleted' });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- traces and resources

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
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/resources', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const region = typeof req.query.region === 'string' ? req.query.region : undefined;
    res.json(dvSafeService.getDVResources(region));
  } catch (error) {
    next(error);
  }
});

const safeNotificationSchema = z.object({ title: z.string().max(200), message: z.string().max(2000) });

router.post('/safe-notification', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, message } = parse(safeNotificationSchema, req.body);
    const settings = await dvSafeService.getSafetySettings(req.user!.id);
    res.json(dvSafeService.getSafeNotificationContent(settings, title, message));
  } catch (error) {
    next(error);
  }
});

export default router;
