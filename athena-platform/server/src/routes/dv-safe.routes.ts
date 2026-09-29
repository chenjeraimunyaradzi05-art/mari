/**
 * DV-Safe routes: settings, emergency contacts, safe chats, the panic button,
 * trace clearing and support lines, for a member in a dangerous situation.
 * The support lines are public and the same for everyone; everything else is
 * the signed-in member's own, and nothing here reads another person's data.
 * Validation failures answer 400 with the reason, never 500.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { httpUrl } from '../utils/http-url';
import dvSafeService from '../services/dv-safe.service';
import { withdrawPresence } from '../services/presence.service';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ApiError } from '../middleware/errorHandler';
import { createRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// ---------------------------------------------------------------- support lines (public)

/**
 * The support lines, before the sign-in wall rather than behind it.
 *
 * This sat under router.use(authenticate), so the one list on this router a
 * woman might need before she has an account — or on a device where she has
 * signed out on purpose — answered 401. Nothing in it is hers: it is the same
 * published and staff-checked numbers for everyone, so it needs no account.
 */
router.get('/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const region = typeof req.query.region === 'string' ? req.query.region.slice(0, 8) : undefined;
    res.json(await dvSafeService.getDVResources(region));
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);

/**
 * Opening, writing to and deleting a safe chat all take its PIN, and the
 * service locks a chat after five wrong ones. This caps how fast anyone can
 * knock on those doors at all, per member, so a script holding her session
 * cannot sweep across several chats' lockouts in parallel either.
 */
const safeChatLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => `dv-chat:${(req as AuthRequest).user?.id ?? req.ip}`,
  handler: (_req: Request, res: Response) =>
    res.status(429).json({ success: false, message: 'Too many requests to your safe chats. Please wait a few minutes.' }),
});

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
  safeExitUrl: httpUrl(2048).optional(),
  panicButtonEnabled: z.boolean().optional(),
  activityLogEnabled: z.boolean().optional(),
  disguisedAppIcon: z.boolean().optional(),
  notificationsSafe: z.boolean().optional(),
});

/*
 * Safe Mode hides her presence, but the people in her threads were told she
 * was online a moment before she switched it on, and would go on reading
 * "Active now" until they reloaded. Turning it on therefore takes that back
 * as well. withdrawPresence tells only the counterparts who already saw her
 * online, so it reveals nothing new, and it never throws: the switch is saved
 * whether or not the notice reaches anyone.
 */
router.put('/settings', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const updates = parse(updateSettingsSchema, req.body);
    const settings = await dvSafeService.updateSafetySettings(req.user!.id, updates);
    if (updates.isSafeMode === true) {
      void withdrawPresence(req.user!.id);
    }
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

router.post('/safe-mode', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await dvSafeService.enableSafeMode(req.user!.id);
    void withdrawPresence(req.user!.id);
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

// No participants: a safe chat is private notes only its owner can open (see
// dv-safe.service), and a field that suggested otherwise is no longer taken.
const safeChatSchema = z.object({
  name: z.string().trim().min(1).max(100),
  disguisedName: z.string().trim().min(1).max(60).optional(),
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

router.post('/chats/:chatId/access', safeChatLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
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

router.post('/chats/:chatId/messages', safeChatLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { content, autoDeleteMinutes, pin } = parse(sendMessageSchema, req.body);
    const message = await dvSafeService.sendSafeChatMessage(req.user!.id, req.params.chatId, content, autoDeleteMinutes, pin);
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

router.delete('/chats/:chatId', safeChatLimiter, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { pin } = parse(pinBodySchema, { ...(req.query ?? {}), ...(req.body ?? {}) });
    await dvSafeService.deleteSafeChat(req.user!.id, req.params.chatId, pin);
    res.json({ message: 'Chat deleted' });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------- traces

/**
 * What the client can actually clear, and nothing it cannot.
 *
 * This used to tell the client to clear two cookies, athena_session and
 * athena_user, that exist nowhere in this codebase, and to "replace history",
 * which a page can only do for its own current entry — the browser's history
 * list is out of reach of any website. The page then said traces were cleared.
 *
 * It also answered "Activity traces cleared" for a deletion that never
 * happened on this side, and logged her user id against the words "Activity
 * traces cleared for safety": the one server-side trace of her using the
 * tool was the record the tool made of itself. The server keeps nothing about
 * her browsing, so there is nothing here to delete, and it now says exactly
 * that and records nothing at all.
 *
 * The web Safety page no longer calls this — it clears the device itself, and
 * a request here would only put one more line in an access log. The route
 * stays so an app build that still calls it gets a true answer rather than a
 * 404, and the instructions still name only the two stores a page really can
 * empty.
 */
router.post('/clear-traces', (_req: AuthRequest, res: Response) => {
  res.json({
    message:
      "Nothing about your browsing is kept on ATHENA's servers, so there was nothing to clear here. What this device holds has to be cleared on the device itself.",
    serverTracesKept: false,
    clientInstructions: {
      clearLocalStorage: true,
      clearSessionStorage: true,
    },
  });
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
