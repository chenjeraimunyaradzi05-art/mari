import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth'; // Assuming this exists
import * as FormationService from '../services/formation.service';
import * as Abr from '../services/abr.service';
import { BusinessType, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { ApiError } from '../middleware/errorHandler';
import { startingAPayment } from '../middleware/moneyLimits';
import { zodBody } from '../middleware/validate';
import { publicFormationFees } from '../config/price-book';
import { isGstRegistered } from '../services/invoice.service';
import { generateFormationDocuments, type FormationDocument } from '../services/strategy/formation-documents.service';

const router = Router();

type StoredDocuments = { generatedAt: string; items: FormationDocument[] } | null;
const storedDocuments = (value: unknown): StoredDocuments => {
  const v = value as { generatedAt?: unknown; items?: unknown } | null;
  return v && typeof v.generatedAt === 'string' && Array.isArray(v.items) ? (v as { generatedAt: string; items: FormationDocument[] }) : null;
};

// What the fee is and what it is for, before anyone has an account. Open, and
// registered ahead of the guard below: the formation landing page is public and
// has to say what a registration costs before it asks anyone to start one, and
// the figures are the ones the payment step charges (config/price-book).
router.get('/fees', (_req, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: publicFormationFees(isGstRegistered()) });
  } catch (error) {
    next(error);
  }
});

// Protect all routes
router.use(authenticate);

// The Australian Business Register, live when ABR_GUID is set; the ASIC register by link.
router.get('/lookup/abn/:abn', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const abn = Abr.digitsOnly(req.params.abn);
    const valid = Abr.isValidAbn(abn);
    const entity = valid && Abr.isConfigured() ? await Abr.lookupAbn(abn) : null;
    res.json({ success: true, data: { abn, formatted: valid ? Abr.formatAbn(abn) : null, valid, configured: Abr.isConfigured(), entity, lookupUrl: Abr.ABR_LOOKUP_URL } });
  } catch (error) {
    next(error);
  }
});

router.get('/lookup/acn/:acn', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const acn = Abr.digitsOnly(req.params.acn);
    const valid = Abr.isValidAcn(acn);
    res.json({ success: true, data: { acn, formatted: valid ? Abr.formatAcn(acn) : null, valid, registerUrl: Abr.ASIC_CONNECT_SEARCH_URL } });
  } catch (error) {
    next(error);
  }
});

router.get('/lookup/name', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    if (!Abr.isConfigured()) {
      return res.json({ success: true, data: { configured: false, matches: [], lookupUrl: Abr.ABR_LOOKUP_URL } });
    }
    const matches = await Abr.searchNames(q);
    res.json({ success: true, data: { configured: true, matches, lookupUrl: Abr.ABR_LOOKUP_URL } });
  } catch (error) {
    next(error);
  }
});

// Get all registrations
router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registrations = await FormationService.getUserRegistrations(req.user!.id);
    res.json(registrations);
  } catch (error) {
    next(error);
  }
});

// Create registration
// The type was checked and the name was not: `businessName` went to Prisma as
// whatever it was, so a number was a 500 and a string had no length.
const createRegistrationBody = z.object({
  type: z.nativeEnum(BusinessType, { errorMap: () => ({ message: 'Invalid business type' }) }),
  businessName: z.string().trim().min(1, 'businessName is required').max(200),
}).strict();

router.post('/', zodBody(createRegistrationBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { type, businessName } = req.body as z.output<typeof createRegistrationBody>;

    const registration = await FormationService.createRegistration(
      req.user!.id,
      type,
      businessName
    );
    res.status(201).json(registration);
  } catch (error) {
    next(error);
  }
});

// The documents a registration needs, drawn from its details. Generating
// keeps them on the registration; the list shows what is there and what
// would be produced; a single document downloads as Markdown.
router.get('/:id/documents', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.getRegistration(req.user!.id, req.params.id);
    const stored = storedDocuments(registration.documents);
    const available = generateFormationDocuments(registration).map(({ key, title, purpose }) => ({ key, title, purpose }));
    res.json({ success: true, data: { generatedAt: stored?.generatedAt ?? null, items: (stored?.items ?? []).map(({ key, title, purpose }) => ({ key, title, purpose })), available } });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/documents', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.getRegistration(req.user!.id, req.params.id);
    const items = generateFormationDocuments(registration);
    const generatedAt = new Date().toISOString();
    await prisma.businessRegistration.update({ where: { id: registration.id }, data: { documents: { generatedAt, items } as unknown as Prisma.InputJsonValue } });
    res.status(201).json({ success: true, data: { generatedAt, items: items.map(({ key, title, purpose }) => ({ key, title, purpose })) } });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/documents/:key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.getRegistration(req.user!.id, req.params.id);
    const stored = storedDocuments(registration.documents);
    const item = (stored?.items ?? generateFormationDocuments(registration)).find((d) => d.key === req.params.key);
    if (!item) throw new ApiError(404, 'No document with that name for this registration');
    res.type('text/markdown').attachment(`${(registration.businessName || 'business').replace(/[^\w-]+/g, '-').toLowerCase()}-${item.key}.md`).send(item.content);
  } catch (error) {
    next(error);
  }
});

// Get single registration
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.getRegistration(
      req.user!.id,
      req.params.id
    );
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

// Update registration data
// The registration's answers are kept as one JSON document, so the form is free to
// grow fields and this does not list them. What it does fix is the three the
// service reads by name (a name that was not text was a 500, an ABN or ACN of
// any length went to the checksum) and the size of the whole: the service stores
// the body as it is, and the parser's limit is the only other ceiling on it.
const MAX_REGISTRATION_BYTES = 100_000;
const updateRegistrationBody = z
  .object({
    businessName: z.string().trim().min(1).max(200).optional(),
    abn: z.union([z.string().max(30), z.number()]).nullable().optional(),
    acn: z.union([z.string().max(30), z.number()]).nullable().optional(),
  })
  .passthrough()
  .refine((body) => JSON.stringify(body).length <= MAX_REGISTRATION_BYTES, {
    message: 'That registration is too large to save',
  });

router.patch('/:id', zodBody(updateRegistrationBody), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.updateRegistration(
      req.user!.id,
      req.params.id,
      req.body
    );
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

// Submit registration. Submitting is where the fee's payment intent is made, so
// it carries the same ceiling as fetching it again (below): a script that
// registers and submits in a loop is making an intent per pass to try cards on.
router.post('/:id/submit', startingAPayment, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.submitRegistration(
      req.user!.id,
      req.params.id
    );
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

// Answer a reviewer's question. The way out of ADDITIONAL_INFO_REQUIRED: the
// applicant edits with PATCH as usual, then sends it back with this. It is
// not /submit, because the fee is already paid and submitting would mint a
// second payment intent.
router.post('/:id/provide-info', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const registration = await FormationService.provideAdditionalInfo(req.user!.id, req.params.id);
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

// Fetch the payment details for a registration that is awaiting payment.
// Submitting already returns these, but an applicant who abandoned checkout
// needs a way back to the same intent without re-submitting.
router.post('/:id/payment-intent', startingAPayment, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payment = await FormationService.getFormationPayment(req.user!.id, req.params.id);
    res.json(payment);
  } catch (error) {
    next(error);
  }
});

// Confirm payment from the browser after Stripe checkout. The webhook is the
// authoritative path; this exists so the applicant is not left looking at a
// PAYMENT_PENDING screen while the webhook is in flight.
// validated: paymentIntentId must be non-empty text of at most 256 characters.
router.post('/:id/confirm-payment', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { paymentIntentId } = req.body;

    if (typeof paymentIntentId !== 'string' || paymentIntentId.trim().length === 0 || paymentIntentId.length > 256) {
      res.status(400).json({ error: 'paymentIntentId is required' });
      return;
    }

    const registration = await FormationService.confirmFormationPayment(
      req.user!.id,
      req.params.id,
      paymentIntentId.trim()
    );
    res.json(registration);
  } catch (error) {
    next(error);
  }
});

export default router;
